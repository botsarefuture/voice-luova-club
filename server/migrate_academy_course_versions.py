"""Add version identity to legacy Academy course records without deleting content."""
import os


def migrate_course_versions(database):
    courses = database["academy_courses"]
    result = courses.update_many({"version": {"$exists": False}}, {"$set": {"version": 1, "course.version": 1}})
    for name, definition in courses.index_information().items():
        if definition.get("key") == [("course_id", 1)] and definition.get("unique"):
            try:
                courses.drop_index(name)
            except Exception as error:
                if getattr(error, "code", None) != 27:
                    raise
    courses.create_index([("course_id", 1), ("version", 1)], unique=True)
    return result.modified_count


if __name__ == "__main__":
    if os.environ.get("FEMMEVOICE_CONFIRM_MIGRATION") != "academy-course-versions-v1":
        raise SystemExit("Refusing to migrate: set FEMMEVOICE_CONFIRM_MIGRATION=academy-course-versions-v1.")
    if not os.environ.get("MONGO_URI") or not os.environ.get("MONGO_DB"):
        raise SystemExit("MONGO_URI and MONGO_DB are required.")
    from pymongo import MongoClient

    db = MongoClient(os.environ["MONGO_URI"])[os.environ["MONGO_DB"]]
    changed = migrate_course_versions(db)
    print(f"Academy course version migration complete: {changed} legacy record(s) updated.")
