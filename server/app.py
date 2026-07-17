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
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from bson import ObjectId
from flask import Flask, Response, jsonify, redirect, request, send_from_directory, session
from gridfs import GridFSBucket
from gridfs.errors import NoFile
from pymongo import ASCENDING, MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash, generate_password_hash
from academy_history import normalize_academy_history
from academy_content import build_public_catalogue, can_submit_for_review, resolve_published_lesson_refs, review_result_status, validate_course_document, validate_lesson_document, validate_review
from academy_media import build_public_media_manifest, media_review_result_status, validate_media_asset, validate_media_review
from reminder_logic import VALID_REMINDER_TONES, normalize_reminder_days

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
REMINDER_TIME_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
MAIL_FROM = os.environ.get("MAIL_FROM", SMTP_USERNAME)
LOGIN_WINDOW_SECONDS = 15 * 60
LOGIN_MAX_ATTEMPTS = 8
FEEDBACK_WINDOW_SECONDS = 60 * 60
FEEDBACK_MAX_SUBMISSIONS = 12
FREE_RECORDING_LIMIT_BYTES = 100 * 1024 * 1024
ADMIN_USERNAMES = frozenset(
    username.strip().lower()
    for username in os.environ.get("FEMMEVOICE_ADMIN_USERNAMES", "").split(",")
    if username.strip()
)
ACADEMY_ROLE_USERS = {
    role: frozenset(username.strip().lower() for username in os.environ.get(f"FEMMEVOICE_ACADEMY_{role.upper()}_USERNAMES", "").split(",") if username.strip())
    for role in ("author", "reviewer", "publisher")
}
login_attempts = {}
feedback_attempts = {}

app = Flask(__name__, static_folder=str(DIST), static_url_path="")
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)
app.secret_key = os.environ.get("SECRET_KEY", secrets.token_hex(32))
session_cookie_secure = os.environ.get("SESSION_COOKIE_SECURE", "true").strip().lower() not in {"0", "false", "no"}
app.config.update(
    SESSION_COOKIE_NAME="femmevoice_session",
    SESSION_COOKIE_SECURE=session_cookie_secure,
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
academy_history_collection = db["academy_history"]
academy_lessons_collection = db["academy_lessons"]
academy_courses_collection = db["academy_courses"]
academy_media_collection = db["academy_media"]
recordings_bucket = GridFSBucket(db, bucket_name="private_recordings")
progress_collection.create_index([("device_id", ASCENDING)])
progress_collection.create_index([("storage_key", ASCENDING)], unique=True)
users_collection.create_index([("username_normalized", ASCENDING)], unique=True)
users_collection.create_index([("email_normalized", ASCENDING)], unique=True, sparse=True)
email_tokens_collection.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
feedback_collection.create_index([("created_at", ASCENDING)], expireAfterSeconds=60 * 60 * 24 * 365)
recordings_collection.create_index([("user_id", ASCENDING), ("recording_id", ASCENDING)], unique=True)
academy_history_collection.create_index([("user_id", ASCENDING)], unique=True)
academy_lessons_collection.create_index([("lesson_id", ASCENDING), ("version", ASCENDING)], unique=True)
academy_lessons_collection.create_index([("status", ASCENDING), ("updated_at", ASCENDING)])
academy_courses_collection.create_index([("course_id", ASCENDING), ("version", ASCENDING)], unique=True)
academy_media_collection.create_index([("asset_id", ASCENDING), ("version", ASCENDING), ("locale", ASCENDING)], unique=True)
academy_media_collection.create_index([("status", ASCENDING), ("updated_at", ASCENDING)])


@app.after_request
def apply_security_headers(response):
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; connect-src 'self'; img-src 'self' data:; media-src 'self' blob:; "
        "style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; "
        "frame-ancestors 'none'; form-action 'self'"
    )
    response.headers["Permissions-Policy"] = "camera=(), geolocation=(), microphone=(self)"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    if request.is_secure:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    public_academy_paths = {"/api/academy/content", "/api/academy/media"}
    if response.mimetype == "text/html":
        response.headers["Cache-Control"] = "no-cache"
    elif request.path.startswith("/api/auth/") or request.path.startswith("/api/privacy/") or request.path.startswith("/api/recordings") or request.path.startswith("/api/admin/") or (request.path.startswith("/api/academy/") and request.path not in public_academy_paths) or request.path.startswith("/api/account/academy-history"):
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


def feedback_limited():
    ip = request.remote_addr or "unknown"
    now = datetime.now(timezone.utc).timestamp()
    attempts = [timestamp for timestamp in feedback_attempts.get(ip, []) if now - timestamp < FEEDBACK_WINDOW_SECONDS]
    feedback_attempts[ip] = attempts
    return len(attempts) >= FEEDBACK_MAX_SUBMISSIONS


def record_feedback_submission():
    ip = request.remote_addr or "unknown"
    feedback_attempts.setdefault(ip, []).append(datetime.now(timezone.utc).timestamp())


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
    roles = academy_roles_for(user["username_normalized"])
    return {
        "key": f"account:{user['_id']}",
        "id": str(user["_id"]),
        "username": user["username"],
        "display_name": user.get("display_name") or user["username"],
        "email": user.get("email"),
        "email_verified": bool(user.get("email_verified_at")),
        "is_admin": user.get("username_normalized") in ADMIN_USERNAMES,
        "academy_roles": sorted(roles),
    }


def admin_from_request():
    user = user_from_request()
    if not user or not user["is_admin"]:
        return None
    return user


def academy_roles_for(username):
    if username in ADMIN_USERNAMES:
        return {"author", "reviewer", "publisher", "admin"}
    return {role for role, users in ACADEMY_ROLE_USERS.items() if username in users}


def academy_user_with_role(role):
    user = user_from_request()
    if not user or role not in user["academy_roles"]:
        return None
    return user


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
    session.clear()
    session["user_id"] = str(result.inserted_id)
    session.permanent = True
    csrf_token()
    account_user = user_from_request()
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
    return jsonify({"authenticated": True, "user": user_from_request()})


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


def reminder_settings_for(user):
    reminder = user.get("reminder") or {}
    try:
        days = normalize_reminder_days(reminder.get("days"))
    except ValueError:
        days = list(range(7))
    return {
        "enabled": bool(reminder.get("enabled")),
        "time": reminder.get("time") if REMINDER_TIME_RE.fullmatch(str(reminder.get("time", ""))) else "18:00",
        "timezone": reminder.get("timezone") or "UTC",
        "days": days,
        "tone": reminder.get("tone") if reminder.get("tone") in VALID_REMINDER_TONES else "gentle",
    }


@app.get("/api/account/reminder")
def get_reminder_settings():
    user = user_from_request()
    if not user:
        return auth_error("Sign in to manage practice reminders.", 401)
    document = users_collection.find_one({"_id": ObjectId(user["id"])}, {"reminder": 1}) or {}
    return jsonify(reminder_settings_for(document))


@app.put("/api/account/reminder")
def update_reminder_settings():
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    user = user_from_request()
    if not user:
        return auth_error("Sign in to manage practice reminders.", 401)
    payload = request.get_json(silent=True) or {}
    enabled = payload.get("enabled")
    time = str(payload.get("time", "")).strip()
    timezone_name = str(payload.get("timezone", "")).strip()
    tone = str(payload.get("tone", "gentle")).strip()
    if not isinstance(enabled, bool) or not REMINDER_TIME_RE.fullmatch(time):
        return auth_error("Choose a valid reminder time.")
    try:
        days = normalize_reminder_days(payload.get("days"))
    except ValueError as error:
        return auth_error(str(error))
    if tone not in VALID_REMINDER_TONES:
        return auth_error("Choose a valid reminder style.")
    try:
        ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        return auth_error("Choose a valid time zone.")
    if enabled and not user["email_verified"]:
        return auth_error("Verify an email address before enabling practice reminders.")
    settings = {"enabled": enabled, "time": time, "timezone": timezone_name, "days": days, "tone": tone, "updated_at": now_iso()}
    users_collection.update_one({"_id": ObjectId(user["id"])}, {"$set": {"reminder": settings}})
    return jsonify({key: settings[key] for key in ("enabled", "time", "timezone", "days", "tone")})


@app.get("/api/privacy/export")
def export_personal_data():
    user = user_from_request()
    if not user:
        return auth_error("Sign in to export your data.", 401)
    document = progress_collection.find_one({"storage_key": user["key"]}, {"_id": 0})
    academy_history = academy_history_collection.find_one({"user_id": user["id"]}, {"_id": 0, "user_id": 0})
    recordings = list(recordings_collection.find({"user_id": user["id"]}, {"_id": 0, "file_id": 0, "user_id": 0}))
    response = jsonify({
        "exported_at": now_iso(),
        "account": {"username": user["username"], "display_name": user["display_name"]},
        "progress": document.get("progress") if document else None,
        "academy_history": academy_history.get("history") if academy_history else None,
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
    recordings = list(recordings_collection.find({"user_id": user["id"]}))
    try:
        for recording in recordings:
            try:
                recordings_bucket.delete(recording["file_id"])
            except NoFile:
                pass
    except Exception:
        return auth_error("We could not delete every private recording. Nothing else was deleted; please try again.", 503)
    legacy_key = f"luovaauth:{user['username']}"
    progress_collection.delete_many({"storage_key": {"$in": [user["key"], legacy_key]}})
    legacy_progress_collection.delete_many({"storage_key": legacy_key})
    feedback_collection.delete_many({"user_id": user["id"]})
    recordings_collection.delete_many({"user_id": user["id"]})
    academy_history_collection.delete_many({"user_id": user["id"]})
    users_collection.delete_one({"_id": ObjectId(user["id"])})
    session.clear()
    response = jsonify({"ok": True})
    response.headers["Clear-Site-Data"] = '"cache", "storage"'
    return response


@app.get("/api/academy/content")
def public_academy_content():
    """Expose only complete, published course revisions to anonymous learners."""
    lessons = list(academy_lessons_collection.find({"status": "published"}, {"_id": 0, "lesson": 1, "version": 1, "updated_at": 1}))
    courses = list(academy_courses_collection.find({"status": "published"}, {"_id": 0, "course": 1, "version": 1, "published_lesson_refs": 1, "published_at": 1, "updated_at": 1}).sort("updated_at", -1).limit(100))
    response = jsonify(build_public_catalogue(courses, lessons))
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    return response


@app.get("/api/academy/media")
def public_academy_media():
    records = list(academy_media_collection.find({"status": "published"}, {"_id": 0, "asset": 1, "published_at": 1}).limit(1000))
    response = jsonify(build_public_media_manifest(records))
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=3600"
    return response


@app.get("/api/admin/academy/media")
def list_academy_media_for_admin():
    user = user_from_request()
    if not user or not user["academy_roles"]:
        return auth_error("Academy media access is required.", 403)
    records = list(academy_media_collection.find({}, {"_id": 0, "asset": 0}).sort("updated_at", -1).limit(1000))
    return jsonify({"roles": user["academy_roles"], "assets": records})


@app.get("/api/admin/academy/media/<asset_id>/<int:version>/<locale>")
def get_academy_media_for_admin(asset_id, version, locale):
    user = user_from_request()
    if not user or not user["academy_roles"]:
        return auth_error("Academy media access is required.", 403)
    record = academy_media_collection.find_one({"asset_id": asset_id, "version": version, "locale": locale}, {"_id": 0})
    if not record:
        return auth_error("Academy media revision was not found.", 404)
    return jsonify(record)


@app.put("/api/admin/academy/media/<asset_id>/<int:version>/<locale>")
def save_academy_media_draft(asset_id, version, locale):
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    user = academy_user_with_role("author")
    if not user:
        return auth_error("Academy author access is required.", 403)
    if request.content_length and request.content_length > 100_000:
        return auth_error("Media metadata is too large.", 413)
    try:
        asset = validate_media_asset((request.get_json(silent=True) or {}).get("asset"), require_review=False, publication_ready=False)
    except ValueError as error:
        return auth_error(str(error))
    if asset["id"] != asset_id or asset["version"] != version or asset["locale"] != locale:
        return auth_error("Media path must match the asset id, version, and locale.")
    existing = academy_media_collection.find_one({"asset_id": asset_id, "version": version, "locale": locale})
    if existing and existing.get("status") == "published":
        return auth_error("Published media revisions are immutable. Create a new version or localization.", 409)
    timestamp = now_iso()
    academy_media_collection.update_one(
        {"asset_id": asset_id, "version": version, "locale": locale},
        {"$set": {"asset_id": asset_id, "version": version, "locale": locale, "title": asset["title"], "kind": asset["kind"], "asset": asset, "status": "draft", "updated_at": timestamp, "authored_by": user["username"]}, "$setOnInsert": {"created_at": timestamp}},
        upsert=True,
    )
    return jsonify({"ok": True, "status": "draft", "updated_at": timestamp})


@app.put("/api/admin/academy/media/<asset_id>/<int:version>/<locale>/submit-review")
def submit_academy_media_for_review(asset_id, version, locale):
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    user = academy_user_with_role("author")
    record = academy_media_collection.find_one({"asset_id": asset_id, "version": version, "locale": locale})
    if not user:
        return auth_error("Academy author access is required.", 403)
    if not record:
        return auth_error("Save the media draft before requesting review.", 404)
    if not can_submit_for_review(record.get("status")):
        return auth_error("Only a draft media revision can be submitted for review.", 409)
    try:
        validate_media_asset(record["asset"], require_review=False)
    except ValueError as error:
        return auth_error(str(error))
    academy_media_collection.update_one({"_id": record["_id"]}, {"$set": {"status": "review_requested", "review_requested_at": now_iso(), "review_requested_by": user["username"], "updated_at": now_iso()}})
    return jsonify({"ok": True, "status": "review_requested"})


@app.put("/api/admin/academy/media/<asset_id>/<int:version>/<locale>/review")
def review_academy_media(asset_id, version, locale):
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    user = academy_user_with_role("reviewer")
    record = academy_media_collection.find_one({"asset_id": asset_id, "version": version, "locale": locale})
    if not user:
        return auth_error("Academy reviewer access is required.", 403)
    if not record:
        return auth_error("Academy media revision was not found.", 404)
    if record.get("status") != "review_requested":
        return auth_error("An author must submit this media revision for review first.", 409)
    try:
        review = validate_media_review((request.get_json(silent=True) or {}).get("review"), require_approved=True)
    except ValueError as error:
        return auth_error(str(error))
    review.update({"reviewed_by": user["username"], "reviewed_at": now_iso()})
    asset = {**record["asset"], "review": {key: review[key] for key in ("decision", "content_checked", "research_checked", "accessibility_checked", "note")}}
    status = media_review_result_status(review["decision"])
    academy_media_collection.update_one({"_id": record["_id"]}, {"$set": {"asset": asset, "status": status, "review": review, "updated_at": now_iso()}})
    return jsonify({"ok": True, "status": status, "review": review})


@app.put("/api/admin/academy/media/<asset_id>/<int:version>/<locale>/publish")
def publish_academy_media(asset_id, version, locale):
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    user = academy_user_with_role("publisher")
    record = academy_media_collection.find_one({"asset_id": asset_id, "version": version, "locale": locale})
    if not user:
        return auth_error("Academy publisher access is required.", 403)
    if not record:
        return auth_error("Academy media revision was not found.", 404)
    if record.get("status") != "in_review" or record.get("review", {}).get("decision") != "approved":
        return auth_error("An approved media review is required before publishing.", 409)
    try:
        validate_media_asset(record["asset"], require_review=True)
    except ValueError as error:
        return auth_error(str(error), 409)
    academy_media_collection.update_one({"_id": record["_id"]}, {"$set": {"status": "published", "published_at": now_iso(), "published_by": user["username"], "updated_at": now_iso()}})
    return jsonify({"ok": True, "status": "published"})


@app.get("/api/admin/academy/lessons")
def list_academy_lessons_for_admin():
    user = user_from_request()
    if not user or not user["academy_roles"]:
        return auth_error("Academy authoring access is required.", 403)
    records = list(academy_lessons_collection.find({}, {"lesson": 0}).sort("updated_at", -1).limit(500))
    return jsonify({"roles": user["academy_roles"], "lessons": [{
        "lesson_id": item["lesson_id"], "version": item["version"], "status": item["status"], "title": item.get("title"),
        "slug": item.get("slug"), "locale": item.get("locale"), "updated_at": item.get("updated_at"), "review": item.get("review"),
    } for item in records]})


@app.get("/api/admin/academy/courses")
def list_academy_courses_for_admin():
    user = user_from_request()
    if not user or not user["academy_roles"]:
        return auth_error("Academy authoring access is required.", 403)
    records = list(academy_courses_collection.find({}, {"_id": 0}).sort("updated_at", -1).limit(100))
    for record in records:
        record["version"] = record.get("version", record.get("course", {}).get("version", 1))
        if isinstance(record.get("course"), dict):
            record["course"]["version"] = record["version"]
    return jsonify({"courses": records})


@app.put("/api/admin/academy/courses/<course_id>/<int:version>")
def save_academy_course_draft(course_id, version):
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    user = academy_user_with_role("author")
    if not user:
        return auth_error("Academy author access is required.", 403)
    try:
        course = validate_course_document((request.get_json(silent=True) or {}).get("course"))
    except ValueError as error:
        return auth_error(str(error))
    if course["id"] != course_id or course["version"] != version:
        return auth_error("Course path must match the course id and version.")
    existing = academy_courses_collection.find_one({"course_id": course_id, "version": version})
    if existing and existing.get("status") == "published":
        return auth_error("Published courses are immutable. Create a new course revision before changing it.", 409)
    timestamp = now_iso()
    try:
        academy_courses_collection.update_one({"course_id": course_id, "version": version}, {"$set": {"course_id": course_id, "version": version, "course": course, "status": "draft", "updated_at": timestamp, "authored_by": user["username"]}, "$setOnInsert": {"created_at": timestamp}}, upsert=True)
    except DuplicateKeyError:
        return auth_error("Course revision storage needs the documented version-index migration before another version can be saved.", 409)
    return jsonify({"ok": True, "status": "draft", "updated_at": timestamp})


@app.put("/api/admin/academy/courses/<course_id>/<int:version>/submit-review")
def submit_academy_course_for_review(course_id, version):
    if not csrf_required(): return auth_error("Your session expired. Refresh and try again.", 403)
    user = academy_user_with_role("author")
    record = academy_courses_collection.find_one({"course_id": course_id, "version": version})
    if not user: return auth_error("Academy author access is required.", 403)
    if not record: return auth_error("Save the course draft before requesting review.", 404)
    if not can_submit_for_review(record.get("status")): return auth_error("Only a draft course can be submitted for review.", 409)
    academy_courses_collection.update_one({"_id": record["_id"]}, {"$set": {"status": "review_requested", "review_requested_at": now_iso(), "review_requested_by": user["username"], "updated_at": now_iso()}})
    return jsonify({"ok": True, "status": "review_requested"})


@app.put("/api/admin/academy/courses/<course_id>/<int:version>/review")
def review_academy_course(course_id, version):
    if not csrf_required(): return auth_error("Your session expired. Refresh and try again.", 403)
    user = academy_user_with_role("reviewer")
    record = academy_courses_collection.find_one({"course_id": course_id, "version": version})
    if not user: return auth_error("Academy reviewer access is required.", 403)
    if not record: return auth_error("Academy course was not found.", 404)
    if record.get("status") != "review_requested": return auth_error("An author must submit this course for review first.", 409)
    try: review = validate_review((request.get_json(silent=True) or {}).get("review"))
    except ValueError as error: return auth_error(str(error))
    review.update({"reviewed_by": user["username"], "reviewed_at": now_iso()})
    status = review_result_status(review["decision"])
    academy_courses_collection.update_one({"_id": record["_id"]}, {"$set": {"status": status, "review": review, "updated_at": now_iso()}})
    return jsonify({"ok": True, "status": status, "review": review})


@app.put("/api/admin/academy/courses/<course_id>/<int:version>/publish")
def publish_academy_course(course_id, version):
    if not csrf_required(): return auth_error("Your session expired. Refresh and try again.", 403)
    user = academy_user_with_role("publisher")
    record = academy_courses_collection.find_one({"course_id": course_id, "version": version})
    if not user: return auth_error("Academy publisher access is required.", 403)
    if not record: return auth_error("Academy course was not found.", 404)
    if record.get("status") != "in_review" or record.get("review", {}).get("decision") != "approved": return auth_error("An approved course review is required before publishing.", 409)
    try:
        lesson_refs = resolve_published_lesson_refs(record["course"], academy_lessons_collection.find({"status": "published"}, {"_id": 0, "lesson": 1, "version": 1}))
    except ValueError as error:
        return auth_error(str(error), 409)
    academy_courses_collection.update_one({"_id": record["_id"]}, {"$set": {"status": "published", "published_lesson_refs": lesson_refs, "published_at": now_iso(), "published_by": user["username"], "updated_at": now_iso()}})
    return jsonify({"ok": True, "status": "published"})


@app.get("/api/admin/academy/lessons/<lesson_id>/<int:version>")
def get_academy_lesson_for_admin(lesson_id, version):
    user = user_from_request()
    if not user or not user["academy_roles"]:
        return auth_error("Academy authoring access is required.", 403)
    record = academy_lessons_collection.find_one({"lesson_id": lesson_id, "version": version}, {"_id": 0})
    if not record:
        return auth_error("Academy lesson revision was not found.", 404)
    return jsonify({"lesson": record["lesson"], "status": record["status"], "review": record.get("review"), "change_note": record.get("change_note", "")})


@app.put("/api/admin/academy/lessons/<lesson_id>/<int:version>")
def save_academy_lesson_draft(lesson_id, version):
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    user = academy_user_with_role("author")
    if not user:
        return auth_error("Academy author access is required.", 403)
    if request.content_length and request.content_length > 1_000_000:
        return auth_error("Lesson draft is too large.", 413)
    payload = request.get_json(silent=True) or {}
    try:
        lesson = validate_lesson_document(payload.get("lesson"))
    except ValueError as error:
        return auth_error(str(error))
    if lesson["id"] != lesson_id or lesson["version"] != version:
        return auth_error("Lesson path must match the lesson id and version.")
    change_note = str(payload.get("change_note", "")).strip()
    if len(change_note) > 4000:
        return auth_error("Change note is too long.")
    existing = academy_lessons_collection.find_one({"lesson_id": lesson_id, "version": version})
    if existing and existing.get("status") == "published":
        return auth_error("Published revisions are immutable. Create a new lesson version.", 409)
    timestamp = now_iso()
    academy_lessons_collection.update_one(
        {"lesson_id": lesson_id, "version": version},
        {"$set": {"lesson": lesson, "lesson_id": lesson_id, "version": version, "title": lesson["title"], "slug": lesson["slug"], "locale": lesson["locale"], "status": "draft", "change_note": change_note, "updated_at": timestamp, "authored_by": user["username"]}, "$setOnInsert": {"created_at": timestamp}},
        upsert=True,
    )
    return jsonify({"ok": True, "status": "draft", "updated_at": timestamp})


@app.put("/api/admin/academy/lessons/<lesson_id>/<int:version>/review")
def review_academy_lesson(lesson_id, version):
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    user = academy_user_with_role("reviewer")
    if not user:
        return auth_error("Academy reviewer access is required.", 403)
    record = academy_lessons_collection.find_one({"lesson_id": lesson_id, "version": version})
    if not record:
        return auth_error("Academy lesson revision was not found.", 404)
    if record.get("status") != "review_requested":
        return auth_error("An author must submit this draft for review before it can be reviewed.", 409)
    try:
        review = validate_review((request.get_json(silent=True) or {}).get("review"))
    except ValueError as error:
        return auth_error(str(error))
    review.update({"reviewed_by": user["username"], "reviewed_at": now_iso()})
    status = review_result_status(review["decision"])
    academy_lessons_collection.update_one({"_id": record["_id"]}, {"$set": {"status": status, "review": review, "updated_at": now_iso()}})
    return jsonify({"ok": True, "status": status, "review": review})


@app.put("/api/admin/academy/lessons/<lesson_id>/<int:version>/submit-review")
def submit_academy_lesson_for_review(lesson_id, version):
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    user = academy_user_with_role("author")
    if not user:
        return auth_error("Academy author access is required.", 403)
    record = academy_lessons_collection.find_one({"lesson_id": lesson_id, "version": version})
    if not record:
        return auth_error("Save the lesson draft before requesting review.", 404)
    if not can_submit_for_review(record.get("status")):
        return auth_error("Only a draft revision can be submitted for review. Create a new version for published content.", 409)
    academy_lessons_collection.update_one({"_id": record["_id"]}, {"$set": {"status": "review_requested", "review_requested_at": now_iso(), "review_requested_by": user["username"], "updated_at": now_iso()}})
    return jsonify({"ok": True, "status": "review_requested"})


@app.put("/api/admin/academy/lessons/<lesson_id>/<int:version>/publish")
def publish_academy_lesson(lesson_id, version):
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    user = academy_user_with_role("publisher")
    if not user:
        return auth_error("Academy publisher access is required.", 403)
    record = academy_lessons_collection.find_one({"lesson_id": lesson_id, "version": version})
    if not record:
        return auth_error("Academy lesson revision was not found.", 404)
    if record.get("review", {}).get("decision") != "approved" or record.get("status") != "in_review":
        return auth_error("An approved content, research, and accessibility review is required before publishing.", 409)
    academy_lessons_collection.update_one({"_id": record["_id"]}, {"$set": {"status": "published", "published_at": now_iso(), "published_by": user["username"], "updated_at": now_iso()}})
    return jsonify({"ok": True, "status": "published"})


@app.get("/api/account/academy-history-sync")
def get_academy_history_sync_settings():
    user = user_from_request()
    if not user:
        return auth_error("Sign in to manage Academy history sync.", 401)
    document = users_collection.find_one({"_id": ObjectId(user["id"])}, {"academy_history_sync_enabled": 1}) or {}
    return jsonify({"enabled": document.get("academy_history_sync_enabled") is True})


@app.put("/api/account/academy-history-sync")
def update_academy_history_sync_settings():
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    user = user_from_request()
    if not user:
        return auth_error("Sign in to manage Academy history sync.", 401)
    payload = request.get_json(silent=True) or {}
    enabled = payload.get("enabled")
    if not isinstance(enabled, bool):
        return auth_error("Choose whether to sync Academy history.")
    users_collection.update_one({"_id": ObjectId(user["id"])}, {"$set": {"academy_history_sync_enabled": enabled}})
    if not enabled:
        academy_history_collection.delete_many({"user_id": user["id"]})
    return jsonify({"enabled": enabled, "deleted_synced_history": not enabled})


@app.get("/api/academy/history")
def get_academy_history():
    user = user_from_request()
    if not user:
        return auth_error("Sign in to access synced Academy history.", 401)
    document = users_collection.find_one({"_id": ObjectId(user["id"])}, {"academy_history_sync_enabled": 1}) or {}
    if document.get("academy_history_sync_enabled") is not True:
        return jsonify({"enabled": False, "history": None})
    history = academy_history_collection.find_one({"user_id": user["id"]}, {"_id": 0, "user_id": 0})
    return jsonify({"enabled": True, "history": history.get("history") if history else None})


@app.put("/api/academy/history")
def put_academy_history():
    if not csrf_required():
        return auth_error("Your session expired. Refresh and try again.", 403)
    user = user_from_request()
    if not user:
        return auth_error("Sign in to sync Academy history.", 401)
    document = users_collection.find_one({"_id": ObjectId(user["id"])}, {"academy_history_sync_enabled": 1}) or {}
    if document.get("academy_history_sync_enabled") is not True:
        return auth_error("Turn on Academy history sync before saving history.", 409)
    if request.content_length and request.content_length > 1_000_000:
        return auth_error("Academy history is too large.", 413)
    payload = request.get_json(silent=True) or {}
    try:
        history = normalize_academy_history(payload.get("history"))
    except ValueError as error:
        return auth_error(str(error))
    if len(str(history)) > 1_000_000:
        return auth_error("Academy history is too large.", 413)
    timestamp = now_iso()
    try:
        academy_history_collection.update_one(
            {"user_id": user["id"]},
            {"$set": {"user_id": user["id"], "history": history, "updated_at": timestamp}, "$setOnInsert": {"created_at": timestamp}},
            upsert=True,
        )
    except PyMongoError as exc:
        return jsonify({"error": "database unavailable", "detail": exc.__class__.__name__}), 503
    return jsonify({"ok": True, "updated_at": timestamp})


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
    if feedback_limited():
        return auth_error("Too many feedback messages from this connection. Please wait an hour and try again.", 429)
    user = user_from_request()
    feedback_collection.insert_one({
        "category": category,
        "message": message,
        "user_id": user["id"] if user else None,
        "created_at": datetime.now(timezone.utc),
    })
    record_feedback_submission()
    return jsonify({"ok": True})


@app.get("/api/admin/feedback")
def list_feedback_for_admin():
    if not admin_from_request():
        return auth_error("Administrator access is required.", 403)
    records = list(feedback_collection.find(
        {}, {"_id": 1, "category": 1, "message": 1, "created_at": 1}
    ).sort("created_at", -1).limit(100))
    return jsonify({"feedback": [
        {
            "id": str(record["_id"]),
            "category": record["category"],
            "message": record["message"],
            "created_at": record["created_at"].isoformat(),
        }
        for record in records
    ]})


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
        encryption_version = int(request.form.get("encryption_version", "1"))
        if len(iv) > 180 or not label or encryption_version not in {1, 2}:
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
    file_id = None
    try:
        file_id = recordings_bucket.upload_from_stream(recording_id, encrypted_bytes, metadata={"user_id": user["id"]})
        document = {
            "user_id": user["id"], "recording_id": recording_id, "file_id": file_id,
            "label": label, "duration_ms": duration_ms, "mime_type": mime_type,
            "iv": iv, "encryption_version": encryption_version, "byte_size": len(encrypted_bytes), "created_at": now_iso(),
        }
        recordings_collection.insert_one(document)
    except DuplicateKeyError:
        if file_id:
            recordings_bucket.delete(file_id)
        return auth_error("That recording is already saved.", 409)
    except Exception:
        if file_id:
            try:
                recordings_bucket.delete(file_id)
            except Exception:
                pass
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
    record = recordings_collection.find_one({"user_id": user["id"], "recording_id": recording_id})
    if not record:
        return jsonify({"ok": True})
    try:
        recordings_bucket.delete(record["file_id"])
    except NoFile:
        pass
    except Exception:
        return auth_error("We could not delete that private recording. Please try again.", 503)
    recordings_collection.delete_one({"_id": record["_id"]})
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
    if len(str(progress)) > 1_000_000:
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
