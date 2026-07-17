"""Create only local staging identities. Never run against production."""
import os

if os.environ.get("FEMMEVOICE_ENV") != "staging":
    raise SystemExit("Refusing to seed: FEMMEVOICE_ENV must be staging.")

from datetime import datetime, timezone
from pymongo import MongoClient
from werkzeug.security import generate_password_hash

db = MongoClient(os.environ["MONGO_URI"])[os.environ["MONGO_DB"]]
password = os.environ.get("FEMMEVOICE_STAGING_PASSWORD", "FemmeVoice staging passphrase 2026")
for username in ("academy-author", "academy-reviewer", "academy-publisher", "academy-admin"):
    db.users.update_one({"username_normalized": username}, {"$setOnInsert": {"username": username, "username_normalized": username, "display_name": username, "password_hash": generate_password_hash(password, method="scrypt"), "created_at": datetime.now(timezone.utc).isoformat(), "last_login_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
print("Staging accounts are ready.")
