import os
import re
import secrets
import hashlib
import smtplib
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path

from bson import ObjectId
from flask import Flask, Response, jsonify, redirect, request, send_from_directory, session
from gridfs import GridFSBucket
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
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
MAIL_FROM = os.environ.get("MAIL_FROM", SMTP_USERNAME)
LOGIN_WINDOW_SECONDS = 15 * 60
LOGIN_MAX_ATTEMPTS = 8
FREE_RECORDING_LIMIT_BYTES = 100 * 1024 * 1024
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
email_tokens_collection = db["email_tokens"]
feedback_collection = db["feedback"]
recordings_collection = db["private_recordings"]
recordings_bucket = GridFSBucket(db, bucket_name="private_recordings")
progress_collection.create_index([("device_id", ASCENDING)])
progress_collection.create_index([("storage_key", ASCENDING)], unique=True)
users_collection.create_index([("username_normalized", ASCENDING)], unique=True)
users_collection.create_index([("email_normalized", ASCENDING)], unique=True, sparse=True)
email_tokens_collection.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
feedback_collection.create_index([("created_at", ASCENDING)], expireAfterSeconds=60 * 60 * 24 * 365)
recordings_collection.create_index([("user_id", ASCENDING), ("recording_id", ASCENDING)], unique=True)


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
    if request.path.startswith("/api/auth/") or request.path.startswith("/api/privacy/") or request.path.startswith("/api/recordings"):
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


def email_token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def send_email(recipient, subject, body):
    if not all([SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, MAIL_FROM]):
        raise RuntimeError("Email delivery is not configured.")
    message = EmailMessage()
    message["From"] = MAIL_FROM
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as smtp:
        smtp.starttls()
        smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
        smtp.send_message(message)


def issue_email_token(kind, user, email):
    token = secrets.token_urlsafe(32)
    email_tokens_collection.delete_many({"kind": kind, "user_id": user["id"]})
    email_tokens_collection.insert_one({
        "kind": kind,
        "user_id": user["id"],
        "email": email,
        "token_hash": email_token_hash(token),
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
    })
    return token


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
        "email": user.get("email"),
        "email_verified": bool(user.get("email_verified_at")),
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


@app.post("/api/account/email")
def request_email_verification():
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    user = user_from_request()
    if not user:
        return auth_error("Sign in to add an email address.", 401)
    email = str((request.get_json(silent=True) or {}).get("email", "")).strip().lower()
    if not EMAIL_RE.fullmatch(email):
        return auth_error("Enter a valid email address.")
    if users_collection.find_one({"email_normalized": email, "_id": {"$ne": ObjectId(user["id"])}}):
        return auth_error("That email address is already in use.", 409)
    token = issue_email_token("verify-email", user, email)
    try:
        send_email(email, "Verify your FemmeVoice email", f"Verify your email address:\n\n{PUBLIC_BASE_URL}/api/account/verify-email?token={token}\n\nThis link expires in one hour.")
    except Exception:
        return auth_error("We could not send a verification email. Please try again later.", 503)
    return jsonify({"ok": True})


@app.get("/api/account/verify-email")
def verify_email():
    token = request.args.get("token", "")
    record = email_tokens_collection.find_one({"kind": "verify-email", "token_hash": email_token_hash(token)})
    if not record:
        return redirect("/?email=invalid#account")
    users_collection.update_one({"_id": ObjectId(record["user_id"])}, {"$set": {"email": record["email"], "email_normalized": record["email"], "email_verified_at": now_iso()}})
    email_tokens_collection.delete_one({"_id": record["_id"]})
    return redirect("/?email=verified#account")


@app.get("/api/privacy/export")
def export_personal_data():
    user = user_from_request()
    if not user:
        return auth_error("Sign in to export your data.", 401)
    document = progress_collection.find_one({"storage_key": user["key"]}, {"_id": 0})
    recordings = list(recordings_collection.find({"user_id": user["id"]}, {"_id": 0, "file_id": 0, "user_id": 0}))
    response = jsonify({
        "exported_at": now_iso(),
        "account": {"username": user["username"], "display_name": user["display_name"]},
        "progress": document.get("progress") if document else None,
        "private_recordings": recordings,
        "notice": "This export does not include a passphrase hash. Private recording files are encrypted in your browser before upload and are not included in this JSON export.",
    })
    response.headers["Content-Disposition"] = "attachment; filename=femmevoice-data-export.json"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.delete("/api/privacy/account")
def delete_personal_data():
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    user = user_from_request()
    if not user:
        return auth_error("Sign in to delete your data.", 401)
    legacy_key = f"luovaauth:{user['username']}"
    progress_collection.delete_many({"storage_key": {"$in": [user["key"], legacy_key]}})
    legacy_progress_collection.delete_many({"storage_key": legacy_key})
    feedback_collection.delete_many({"user_id": user["id"]})
    for recording in recordings_collection.find({"user_id": user["id"]}):
        try:
            recordings_bucket.delete(recording["file_id"])
        except Exception:
            pass
    recordings_collection.delete_many({"user_id": user["id"]})
    users_collection.delete_one({"_id": ObjectId(user["id"])})
    session.clear()
    response = jsonify({"ok": True})
    response.headers["Clear-Site-Data"] = '"cache", "storage"'
    return response


@app.post("/api/feedback")
def submit_feedback():
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    payload = request.get_json(silent=True) or {}
    category = str(payload.get("category", "")).strip().lower()
    message = str(payload.get("message", "")).strip()
    if category not in {"idea", "bug", "resource", "safety", "other"}:
        return auth_error("Choose a feedback category.")
    if not 10 <= len(message) <= 4000:
        return auth_error("Feedback must be between 10 and 4,000 characters.")
    user = user_from_request()
    feedback_collection.insert_one({
        "category": category,
        "message": message,
        "user_id": user["id"] if user else None,
        "created_at": datetime.now(timezone.utc),
    })
    return jsonify({"ok": True})


@app.get("/api/recordings")
def list_recordings():
    user = user_from_request()
    if not user:
        return auth_error("Sign in to use private recordings.", 401)
    recordings = list(recordings_collection.find({"user_id": user["id"]}, {"_id": 0, "file_id": 0}).sort("created_at", -1).limit(100))
    usage = sum(recording.get("byte_size", 0) for recording in recordings)
    return jsonify({"recordings": recordings, "usage_bytes": usage, "limit_bytes": FREE_RECORDING_LIMIT_BYTES, "plan": "Free"})


@app.post("/api/recordings")
def upload_recording():
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    user = user_from_request()
    if not user:
        return auth_error("Sign in to save a private recording.", 401)
    recording_id = str(request.form.get("id", ""))
    label = str(request.form.get("label", "")).strip()[:80]
    mime_type = str(request.form.get("mime_type", "audio/webm"))[:80]
    try:
        uuid.UUID(recording_id)
        duration_ms = max(0, min(int(request.form.get("duration_ms", "0")), 10 * 60 * 1000))
        iv = request.form.get("iv", "")
        if len(iv) > 180 or not label:
            raise ValueError
    except (ValueError, TypeError):
        return auth_error("That recording information is invalid.")
    encrypted_file = request.files.get("audio")
    if not encrypted_file:
        return auth_error("Choose a recording to save.")
    encrypted_bytes = encrypted_file.read(12 * 1024 * 1024 + 1)
    if not encrypted_bytes or len(encrypted_bytes) > 12 * 1024 * 1024:
        return auth_error("Private recordings must be under 12 MB.", 413)
    if recordings_collection.count_documents({"user_id": user["id"]}) >= 100:
        return auth_error("Your private vault has room for 100 recordings. Delete one before saving another.", 413)
    usage = sum(recording.get("byte_size", 0) for recording in recordings_collection.find({"user_id": user["id"]}, {"byte_size": 1}))
    if usage + len(encrypted_bytes) > FREE_RECORDING_LIMIT_BYTES:
        return auth_error("Your free private vault has reached its 100 MB limit. Delete a recording or choose not to save this take.", 413)
    try:
        file_id = recordings_bucket.upload_from_stream(recording_id, encrypted_bytes, metadata={"user_id": user["id"]})
        document = {
            "user_id": user["id"], "recording_id": recording_id, "file_id": file_id,
            "label": label, "duration_ms": duration_ms, "mime_type": mime_type,
            "iv": iv, "byte_size": len(encrypted_bytes), "created_at": now_iso(),
        }
        recordings_collection.insert_one(document)
    except DuplicateKeyError:
        return auth_error("That recording is already saved.", 409)
    except Exception:
        return auth_error("We could not save that private recording.", 503)
    return jsonify({"recording": {key: value for key, value in document.items() if key not in {"_id", "file_id", "user_id"}}})


@app.get("/api/recordings/<recording_id>")
def download_recording(recording_id):
    user = user_from_request()
    if not user:
        return auth_error("Sign in to open private recordings.", 401)
    record = recordings_collection.find_one({"user_id": user["id"], "recording_id": recording_id})
    if not record:
        return auth_error("That private recording was not found.", 404)
    try:
        encrypted_bytes = recordings_bucket.open_download_stream(record["file_id"]).read()
    except Exception:
        return auth_error("That private recording is unavailable.", 404)
    response = Response(encrypted_bytes, mimetype="application/octet-stream")
    response.headers["X-FemmeVoice-IV"] = record["iv"]
    response.headers["X-FemmeVoice-Mime"] = record["mime_type"]
    return response


@app.delete("/api/recordings/<recording_id>")
def delete_recording(recording_id):
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    user = user_from_request()
    if not user:
        return auth_error("Sign in to delete private recordings.", 401)
    record = recordings_collection.find_one_and_delete({"user_id": user["id"], "recording_id": recording_id})
    if record:
        try:
            recordings_bucket.delete(record["file_id"])
        except Exception:
            pass
    return jsonify({"ok": True})


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
