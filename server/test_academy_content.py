import unittest

from academy_content import build_public_catalogue, can_submit_for_review, resolve_published_lesson_refs, review_result_status, validate_course_document, validate_lesson_document, validate_review


def lesson():
    return {"schemaVersion": 1, "id": "welcome", "slug": "welcome", "title": "Welcome", "version": 1, "locale": "en", "metadata": {}, "evidence": [{"id": "source", "label": "Source", "level": "Consensus", "citation": "Citation", "limitation": "Limit"}], "safety": {}, "accessibility": {}, "blocks": [{"id": "start", "type": "text", "version": 1, "metadata": {}, "durationMinutes": 1, "completion": {"kind": "manual"}, "accessibility": {}, "safety": {}, "evidenceRefs": ["source"], "content": {"text": "Hello"}}]}


class AcademyContentTests(unittest.TestCase):
    def test_lesson_validation_requires_safe_authoring_shape(self):
        self.assertEqual(validate_lesson_document(lesson())["id"], "welcome")
        broken = lesson()
        broken["blocks"][0]["content"] = {}
        with self.assertRaises(ValueError):
            validate_lesson_document(broken)

    def test_lesson_media_reference_requires_an_exact_revision(self):
        document = lesson()
        document["blocks"] = [{"id": "pathway", "type": "image", "version": 1, "metadata": {}, "durationMinutes": 1, "completion": {"kind": "manual"}, "accessibility": {"alternative": "A sound pathway."}, "safety": {}, "evidenceRefs": ["source"], "content": {"src": "/academy/voice-pathway.jpg", "assetRef": {"id": "voice-pathway", "version": 1, "locale": "en"}}}]
        self.assertEqual(validate_lesson_document(document)["blocks"][0]["content"]["assetRef"]["version"], 1)
        document["blocks"][0]["content"]["assetRef"]["version"] = 0
        with self.assertRaisesRegex(ValueError, "Governed media"):
            validate_lesson_document(document)

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

    def test_course_versions_default_legacy_content_to_version_one(self):
        course = {"id": "foundations", "slug": "foundations", "title": "Foundations", "summary": "A calm start.", "locale": "en", "estimatedMinutes": 60, "lessonIds": ["welcome"]}
        self.assertEqual(validate_course_document(course)["version"], 1)
        course["version"] = 0
        with self.assertRaises(ValueError):
            validate_course_document(course)

    def test_public_catalogue_excludes_courses_with_unpublished_lesson_gaps(self):
        course = {"course": {"slug": "foundations", "lessonIds": ["welcome", "safety"]}, "published_at": "2026-07-17T00:00:00Z"}
        lessons = [{"lesson": {"slug": "welcome", "title": "Welcome"}}]
        self.assertEqual(build_public_catalogue([course], lessons)["courses"], [])
        lessons.append({"lesson": {"slug": "safety", "title": "Safety"}})
        self.assertEqual(build_public_catalogue([course], lessons)["courses"][0]["lessons"][1]["title"], "Safety")

    def test_published_course_pins_exact_lesson_revisions(self):
        course = {"id": "foundations", "slug": "foundations", "version": 2, "lessonIds": ["welcome"]}
        lessons = [
            {"lesson": {"id": "welcome", "slug": "welcome", "title": "Welcome v1", "version": 1}},
            {"lesson": {"id": "welcome", "slug": "welcome", "title": "Welcome v2", "version": 2}},
        ]
        references = resolve_published_lesson_refs(course, lessons)
        self.assertEqual(references, [{"slug": "welcome", "version": 2}])
        record = {"course": course, "version": 2, "published_lesson_refs": references}
        self.assertEqual(build_public_catalogue([record], lessons)["courses"][0]["lessons"][0]["title"], "Welcome v2")
        lessons.append({"lesson": {"id": "welcome", "slug": "welcome", "title": "Welcome v3", "version": 3}})
        self.assertEqual(build_public_catalogue([record], lessons)["courses"][0]["lessons"][0]["title"], "Welcome v2")

    def test_public_catalogue_uses_only_latest_published_course_revision(self):
        lesson_records = [{"lesson": {"slug": "welcome", "title": "Welcome", "version": 1}}]
        courses = [
            {"course": {"slug": "foundations", "version": 1, "lessonIds": ["welcome"]}, "version": 1},
            {"course": {"slug": "foundations", "version": 2, "title": "Updated", "lessonIds": ["welcome"]}, "version": 2},
        ]
        catalogue = build_public_catalogue(courses, lesson_records)
        self.assertEqual(len(catalogue["courses"]), 1)
        self.assertEqual(catalogue["courses"][0]["course"]["title"], "Updated")
