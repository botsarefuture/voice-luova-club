import unittest

from academy_content import validate_lesson_document, validate_review


def lesson():
    return {"schemaVersion": 1, "id": "welcome", "slug": "welcome", "title": "Welcome", "version": 1, "locale": "en", "metadata": {}, "evidence": [{"id": "source", "label": "Source", "level": "Consensus", "citation": "Citation", "limitation": "Limit"}], "safety": {}, "accessibility": {}, "blocks": [{"id": "start", "type": "text", "version": 1, "metadata": {}, "durationMinutes": 1, "completion": {"kind": "manual"}, "accessibility": {}, "safety": {}, "evidenceRefs": ["source"], "content": {"text": "Hello"}}]}


class AcademyContentTests(unittest.TestCase):
    def test_lesson_validation_requires_safe_authoring_shape(self):
        self.assertEqual(validate_lesson_document(lesson())["id"], "welcome")
        broken = lesson()
        broken["blocks"][0]["content"] = {}
        with self.assertRaises(ValueError):
            validate_lesson_document(broken)

    def test_review_requires_all_review_dimensions(self):
        self.assertEqual(validate_review({"decision": "approved", "content_checked": True, "research_checked": True, "accessibility_checked": True})["decision"], "approved")
        with self.assertRaises(ValueError):
            validate_review({"decision": "approved", "content_checked": True, "research_checked": False, "accessibility_checked": True})
