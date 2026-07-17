import unittest

from academy_history import normalize_academy_history


def history():
    return {
        "version": 1,
        "lessons": {
            "welcome": {
                "courseSlug": "foundations", "lessonId": "welcome", "lessonSlug": "welcome", "lessonVersion": 1,
                "lessonTitle": "Welcome", "totalBlocks": 2, "currentBlock": 1, "completedBlockIds": ["start"],
                "completionPercentage": 50, "startedAt": "2026-07-17T10:00:00+00:00", "lastPracticedAt": "2026-07-17T10:01:00+00:00",
                "completedAt": None, "completed": False,
            },
        },
        "sessions": [{
            "id": "session", "courseSlug": "foundations", "lessonId": "welcome", "lessonSlug": "welcome", "lessonVersion": 1,
            "lessonTitle": "Welcome", "startedAt": "2026-07-17T10:00:00+00:00", "lastActiveAt": "2026-07-17T10:01:00+00:00",
            "activeSeconds": 60, "completed": False,
        }],
        "journal": [{"id": "note", "note": "A small win", "ease": "okay", "courseSlug": "foundations", "lessonId": "welcome", "createdAt": "2026-07-17T10:01:00+00:00"}],
        "updatedAt": "2026-07-17T10:01:00+00:00",
    }


class AcademyHistoryTests(unittest.TestCase):
    def test_normalizes_the_explicit_history_contract(self):
        self.assertEqual(normalize_academy_history(history())["lessons"]["welcome"]["lessonTitle"], "Welcome")

    def test_rejects_hidden_responses_and_invalid_ease(self):
        with_response = history()
        with_response["lessons"]["welcome"]["responses"] = {"private": "answer"}
        with self.assertRaises(ValueError):
            normalize_academy_history(with_response)

        invalid_ease = history()
        invalid_ease["journal"][0]["ease"] = "graded"
        with self.assertRaises(ValueError):
            normalize_academy_history(invalid_ease)


if __name__ == "__main__":
    unittest.main()
