import os
import re
import secrets
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from bson import ObjectId
from flask import Flask, jsonify, redirect, request, send_from_directory, session
from pymongo import ASCENDING, MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash, generate_password_hash

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://95.216.45.31:27017")
MONGO_DB = os.environ.get("MONGO_DB", "femmevoice")
LEGACY_MONGO_DB = os.environ.get("LEGACY_MONGO_DB", "voice_luova_club")
LEGACY_AUTH_BASE = os.environ.get("LEGACY_AUTH_BASE") or os.environ.get("LUOVA_AUTH_BASE", "https://auth.luova.club")
LEGACY_AUTH_APP_ID = os.environ.get("LEGACY_AUTH_APP_ID") or os.environ.get("LUOVA_AUTH_APP_ID", "")
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "https://voice.luova.club")
MIGRATION_DEADLINE = datetime(2026, 8, 1, 23, 59, 59, tzinfo=timezone.utc)
DEVICE_RE = re.compile(r"^[A-Za-z0-9_-]{16,80}$")
USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{2,31}$")
PASSWORD_MIN_LENGTH = 15
PASSWORD_MAX_LENGTH = 128
LOGIN_WINDOW_SECONDS = 15 * 60
LOGIN_MAX_ATTEMPTS = 8
login_attempts = {}

app = Flask(__name__, static_folder=str(DIST), static_url_path="")
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)
app.secret_key = os.environ.get("SECRET_KEY", secrets.token_hex(32))
app.config.update(
    SESSION_COOKIE_NAME="femmevoice_session",
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    PERMANENT_SESSION_LIFETIME=timedelta(days=14),
)
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
db = client[MONGO_DB]
legacy_db = client[LEGACY_MONGO_DB]
progress_collection = db["progress"]
legacy_progress_collection = legacy_db["progress"]
users_collection = db["users"]
progress_collection.create_index([("device_id", ASCENDING)])
progress_collection.create_index([("storage_key", ASCENDING)], unique=True)
users_collection.create_index([("username_normalized", ASCENDING)], unique=True)


@app.after_request
def apply_security_headers(response):
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; connect-src 'self'; img-src 'self' data:; media-src 'self'; "
        "style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; "
        "frame-ancestors 'none'; form-action 'self'"
    )
    response.headers["Permissions-Policy"] = "camera=(), geolocation=(), microphone=(self)"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    if request.path.startswith("/api/auth/"):
        response.headers["Cache-Control"] = "no-store"
    return response


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def validate_device_id(device_id):
    return bool(DEVICE_RE.match(device_id or ""))


def csrf_token():
    token = session.get("csrf_token")
    if not token:
        token = secrets.token_urlsafe(32)
        session["csrf_token"] = token
    return token


def csrf_required():
    supplied = request.headers.get("X-CSRF-Token", "")
    expected = session.get("csrf_token", "")
    return bool(expected and secrets.compare_digest(supplied, expected))


def auth_error(message, status=400):
    return jsonify({"error": message}), status


def migration_open():
    return bool(LEGACY_AUTH_APP_ID) and datetime.now(timezone.utc) <= MIGRATION_DEADLINE


def login_limited():
    ip = request.remote_addr or "unknown"
    now = datetime.now(timezone.utc).timestamp()
    attempts = [timestamp for timestamp in login_attempts.get(ip, []) if now - timestamp < LOGIN_WINDOW_SECONDS]
    login_attempts[ip] = attempts
    return len(attempts) >= LOGIN_MAX_ATTEMPTS


def record_failed_login():
    ip = request.remote_addr or "unknown"
    login_attempts.setdefault(ip, []).append(datetime.now(timezone.utc).timestamp())


def user_from_request():
    user_id = session.get("user_id")
    if not user_id:
        return None
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    except Exception:
        session.clear()
        return None
    if not user:
        session.clear()
        return None
    return {
        "key": f"account:{user['_id']}",
        "id": str(user["_id"]),
        "username": user["username"],
        "display_name": user.get("display_name") or user["username"],
    }


def storage_key(device_id):
    user = user_from_request()
    if user:
        return user["key"], "account", user
    return f"device:{device_id}", "device", None


def migrate_progress(legacy_username, account_key, account_user):
    legacy_key = f"luovaauth:{legacy_username}"
    legacy = progress_collection.find_one({"storage_key": legacy_key})
    if not legacy:
        legacy = legacy_progress_collection.find_one({"storage_key": legacy_key})
    if not legacy or not isinstance(legacy.get("progress"), dict):
        return False
    timestamp = now_iso()
    progress_collection.update_one(
        {"storage_key": account_key},
        {"$set": {
            "storage_key": account_key,
            "device_id": legacy.get("device_id"),
            "account_type": "account",
            "username": account_user["username"],
            "progress": legacy["progress"],
            "updated_at": timestamp,
            "migrated_at": timestamp,
        }, "$setOnInsert": {"created_at": timestamp}},
        upsert=True,
    )
    return True


@app.get("/api/health")
def health():
    client.admin.command("ping")
    return jsonify({"ok": True, "auth": "first-party"})


@app.get("/api/auth/csrf")
def get_csrf():
    return jsonify({"csrf_token": csrf_token()})


@app.get("/api/auth/migration-status")
def migration_status():
    return jsonify({"available": migration_open(), "ready": bool(session.get("migration_username")), "deadline": "2026-08-01"})


@app.get("/api/auth/migration")
def start_migration():
    if not migration_open():
        return auth_error("Account transfer is no longer available.", 410)
    session["migration_pending"] = True
    callback = f"{PUBLIC_BASE_URL}/auth_callback"
    params = urllib.parse.urlencode({"app_id": LEGACY_AUTH_APP_ID, "next": callback, "scope": "login"})
    return redirect(f"{LEGACY_AUTH_BASE}/authorize?{params}")


@app.get("/auth_callback")
def finish_migration_identity():
    if not session.get("migration_pending") or not migration_open():
        return redirect("/")
    token = request.args.get("token", "")
    if not token:
        return redirect("/?transfer=failed")
    request_data = b'{"token":"' + token.encode().replace(b'"', b"") + b'"}'
    try:
        with urllib.request.urlopen(urllib.request.Request(
            f"{LEGACY_AUTH_BASE}/user_info", data=request_data,
            headers={"Content-Type": "application/json", "Accept": "application/json"}, method="POST",
        ), timeout=5) as response:
            import json
            payload = json.loads(response.read().decode("utf-8"))
        username = (payload.get("user_info") or {}).get("username") if payload.get("status_machine") == "OK" else None
    except Exception:
        username = None
    session.pop("migration_pending", None)
    if not username:
        return redirect("/?transfer=failed")
    session["migration_username"] = username
    return redirect("/?transfer=ready")


@app.post("/api/auth/register")
def register():
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username", "")).strip()
    password = payload.get("password")
    confirmation = payload.get("confirmation")
    normalized = username.lower()
    if not USERNAME_RE.fullmatch(normalized):
        return auth_error("Use 3-32 lowercase letters, numbers, hyphens, or underscores.")
    if not isinstance(password, str) or not PASSWORD_MIN_LENGTH <= len(password) <= PASSWORD_MAX_LENGTH:
        return auth_error(f"Use a passphrase between {PASSWORD_MIN_LENGTH} and {PASSWORD_MAX_LENGTH} characters.")
    if password != confirmation:
        return auth_error("Passphrases do not match.")
    timestamp = now_iso()
    try:
        result = users_collection.insert_one({
            "username": username,
            "username_normalized": normalized,
            "display_name": username,
            "password_hash": generate_password_hash(password, method="scrypt"),
            "created_at": timestamp,
            "last_login_at": timestamp,
        })
    except DuplicateKeyError:
        return auth_error("That username is unavailable.", 409)
    legacy_username = session.get("migration_username")
    account_user = {"id": str(result.inserted_id), "username": username, "display_name": username}
    session.clear()
    session["user_id"] = str(result.inserted_id)
    session.permanent = True
    csrf_token()
    migrated = migrate_progress(legacy_username, f"account:{result.inserted_id}", account_user) if legacy_username else False
    return jsonify({"authenticated": True, "user": account_user, "migrated": migrated}), 201


@app.post("/api/auth/login")
def login():
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    if login_limited():
        return auth_error("Too many attempts. Please wait and try again.", 429)
    payload = request.get_json(silent=True) or {}
    identifier = str(payload.get("username", "")).strip().lower()
    password = payload.get("password")
    user = users_collection.find_one({"username_normalized": identifier})
    if not user or not isinstance(password, str) or not check_password_hash(user["password_hash"], password):
        record_failed_login()
        return auth_error("Invalid username or passphrase.", 401)
    session.clear()
    session["user_id"] = str(user["_id"])
    session.permanent = True
    csrf_token()
    users_collection.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": now_iso()}})
    return jsonify({"authenticated": True, "user": {"id": str(user["_id"]), "username": user["username"], "display_name": user.get("display_name") or user["username"]}})


@app.post("/api/auth/logout")
def logout():
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    session.clear()
    response = jsonify({"ok": True})
    response.headers["Clear-Site-Data"] = '"cache"'
    return response


@app.get("/api/me")
def me():
    user = user_from_request()
    return jsonify({"authenticated": bool(user), "user": user})


@app.get("/api/progress/<device_id>")
def get_progress(device_id):
    if not validate_device_id(device_id):
        return jsonify({"error": "invalid device id"}), 400
    key, account_type, user = storage_key(device_id)
    document = progress_collection.find_one({"storage_key": key}, {"_id": 0})
    if not document:
        return jsonify({"progress": None, "account_type": account_type, "user": user})
    return jsonify({
        "progress": document.get("progress"),
        "updated_at": document.get("updated_at"),
        "account_type": account_type,
        "user": user,
    })


@app.put("/api/progress/<device_id>")
def put_progress(device_id):
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    if not validate_device_id(device_id):
        return jsonify({"error": "invalid device id"}), 400
    payload = request.get_json(silent=True) or {}
    progress = payload.get("progress")
    if not isinstance(progress, dict) or progress.get("version") != 1:
        return jsonify({"error": "invalid progress payload"}), 400
    if len(str(progress)) > 200_000:
        return jsonify({"error": "progress payload too large"}), 413

    timestamp = now_iso()
    key, account_type, user = storage_key(device_id)
    try:
        progress_collection.update_one(
            {"storage_key": key},
            {
                "$set": {
                    "storage_key": key,
                    "device_id": device_id,
                    "account_type": account_type,
                    "username": user["username"] if user else None,
                    "progress": progress,
                    "updated_at": timestamp,
                },
                "$setOnInsert": {"created_at": timestamp},
            },
            upsert=True,
        )
    except PyMongoError as exc:
        return jsonify({"error": "database unavailable", "detail": exc.__class__.__name__}), 503
    return jsonify({"ok": True, "updated_at": timestamp})


@app.get("/")
def index():
    return send_from_directory(DIST, "index.html")


@app.get("/<path:path>")
def static_or_spa(path):
    candidate = DIST / path
    if candidate.is_file():
        return send_from_directory(DIST, path)
    return send_from_directory(DIST, "index.html")
