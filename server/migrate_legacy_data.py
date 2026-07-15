"""Back up and copy FemmeVoice data into its independent database.

Run this with the web service stopped. It is idempotent: documents keep their
Mongo IDs and can be copied again safely if a deployment is interrupted.
"""

import argparse
import os
from pathlib import Path

from bson import json_util
from pymongo import ASCENDING, MongoClient


def copy_collection(source, target, backup_path):
    count = 0
    with backup_path.open("w", encoding="utf-8") as backup_file:
        for document in source.find({}):
            backup_file.write(json_util.dumps(document) + "\n")
            target.replace_one({"_id": document["_id"]}, document, upsert=True)
            count += 1
    return count


def main():
    parser = argparse.ArgumentParser(description="Copy FemmeVoice data into a dedicated MongoDB database")
    parser.add_argument("--source-db", default=os.environ.get("LEGACY_MONGO_DB", "voice_luova_club"))
    parser.add_argument("--target-db", default=os.environ.get("MONGO_DB", "femmevoice"))
    parser.add_argument("--backup-dir", required=True)
    args = parser.parse_args()

    uri = os.environ.get("MONGO_URI", "mongodb://95.216.45.31:27017")
    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    client.admin.command("ping")
    source_db = client[args.source_db]
    target_db = client[args.target_db]
    backup_dir = Path(args.backup_dir)
    backup_dir.mkdir(parents=True, exist_ok=False)

    copied_progress = copy_collection(source_db["progress"], target_db["progress"], backup_dir / "progress.jsonl")
    copied_users = copy_collection(source_db["users"], target_db["users"], backup_dir / "users.jsonl")
    target_db["progress"].create_index([("device_id", ASCENDING)])
    target_db["progress"].create_index([("storage_key", ASCENDING)], unique=True)
    target_db["users"].create_index([("username_normalized", ASCENDING)], unique=True)
    print(f"copied progress={copied_progress} users={copied_users} backup={backup_dir}")


if __name__ == "__main__":
    main()
