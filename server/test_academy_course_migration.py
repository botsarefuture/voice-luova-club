import unittest

from migrate_academy_course_versions import migrate_course_versions


class Result:
    modified_count = 2


class FakeCourses:
    def __init__(self):
        self.dropped = []
        self.created = []

    def update_many(self, query, update):
        self.update = (query, update)
        return Result()

    def index_information(self):
        return {
            "_id_": {"key": [("_id", 1)]},
            "course_id_1": {"key": [("course_id", 1)], "unique": True},
        }

    def drop_index(self, name):
        self.dropped.append(name)

    def create_index(self, keys, unique=False):
        self.created.append((keys, unique))


class AcademyCourseMigrationTests(unittest.TestCase):
    def test_migration_preserves_records_and_replaces_only_legacy_identity_index(self):
        courses = FakeCourses()
        changed = migrate_course_versions({"academy_courses": courses})
        self.assertEqual(changed, 2)
        self.assertEqual(courses.dropped, ["course_id_1"])
        self.assertEqual(courses.created, [([("course_id", 1), ("version", 1)], True)])
        self.assertEqual(courses.update[1]["$set"], {"version": 1, "course.version": 1})
