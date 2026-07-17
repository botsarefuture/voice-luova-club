import unittest

from academy_content import build_public_catalogue, can_submit_for_review, review_result_status, validate_course_document, validate_lesson_document, validate_review


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

    def test_review_workflow_keeps_published_revisions_immutable(self):
        self.assertTrue(can_submit_for_review("draft"))
        self.assertFalse(can_submit_for_review("published"))
        self.assertEqual(review_result_status("approved"), "in_review")
        self.assertEqual(review_result_status("changes_requested"), "draft")

    def test_course_keeps_an_ordered_unique_lesson_path(self):
        course = {"id": "foundations", "slug": "foundations", "title": "Foundations", "summary": "A calm start.", "locale": "en", "estimatedMinutes": 60, "lessonIds": ["welcome", "safety"], "tags": ["starter"]}
        self.assertEqual(validate_course_document(course)["lessonIds"], ["welcome", "safety"])
        course["lessonIds"].append("welcome")
        with self.assertRaises(ValueError):
            validate_course_document(course)

    def test_public_catalogue_excludes_courses_with_unpublished_lesson_gaps(self):
        course = {"course": {"slug": "foundations", "lessonIds": ["welcome", "safety"]}, "published_at": "2026-07-17T00:00:00Z"}
        lessons = [{"lesson": {"slug": "welcome", "title": "Welcome"}}]
        self.assertEqual(build_public_catalogue([course], lessons)["courses"], [])
        lessons.append({"lesson": {"slug": "safety", "title": "Safety"}})
        self.assertEqual(build_public_catalogue([course], lessons)["courses"][0]["lessons"][1]["title"], "Safety")
