import unittest

from academy_media import build_public_media_manifest, media_review_result_status, validate_media_asset, validate_media_review


def illustration(version=1, locale="en"):
    return {
        "schemaVersion": 1,
        "id": "voice-pathway",
        "version": version,
        "kind": "image",
        "locale": locale,
        "source": f"/academy/voice-pathway-v{version}.jpg",
        "title": "A simple sound pathway",
        "mimeType": "image/jpeg",
        "byteSize": 156938,
        "checksum": "sha256:f6fda2493a5d8b93f7e918d5ae677efa51141c4f93a128e83cc1fbe5e1964c8f",
        "rights": {"owner": "FemmeVoice", "license": "MIT project asset", "attribution": "Generated for FemmeVoice"},
        "accessibility": {"alternative": "A simplified side profile shows airflow from the lungs through the throat and mouth."},
        "relations": {},
        "review": {"decision": "approved", "content_checked": True, "research_checked": True, "accessibility_checked": True},
    }


class AcademyMediaTests(unittest.TestCase):
    def test_foundations_illustration_has_a_publishable_asset_record(self):
        asset = illustration()
        asset["rights"]["attribution"] = ""
        asset["accessibility"]["longDescription"] = ""
        self.assertEqual(validate_media_asset(asset)["id"], "voice-pathway")

    def test_media_cannot_publish_without_kind_specific_accessibility(self):
        asset = illustration()
        asset.update({"kind": "video", "mimeType": "video/mp4"})
        with self.assertRaises(ValueError):
            validate_media_asset(asset)

    def test_delivery_sources_stay_same_origin_while_rights_may_link_out(self):
        asset = illustration()
        asset["source"] = "https://cdn.example.org/pathway.jpg"
        asset["rights"]["sourceUrl"] = "https://example.org/original"
        with self.assertRaisesRegex(ValueError, "metadata"):
            validate_media_asset(asset)

    def test_incomplete_media_can_be_saved_as_a_draft_but_not_submitted(self):
        asset = illustration()
        asset["review"] = {"decision": "pending", "content_checked": False, "research_checked": False, "accessibility_checked": False}
        self.assertEqual(validate_media_asset(asset, require_review=False)["review"]["decision"], "pending")
        asset["accessibility"] = {}
        with self.assertRaises(ValueError):
            validate_media_asset(asset, require_review=False)
        self.assertEqual(validate_media_asset(asset, require_review=False, publication_ready=False)["accessibility"], {})

    def test_placeholder_is_draftable_but_cannot_enter_review(self):
        asset = illustration()
        asset.update({"source": "/academy/placeholder.jpg", "byteSize": 0, "checksum": f"sha256:{'0' * 64}"})
        self.assertEqual(validate_media_asset(asset, require_review=False, publication_ready=False)["source"], "/academy/placeholder.jpg")
        with self.assertRaisesRegex(ValueError, "placeholder"):
            validate_media_asset(asset, require_review=False)

    def test_review_and_relationships_are_strict(self):
        self.assertEqual(media_review_result_status("approved"), "in_review")
        self.assertEqual(media_review_result_status("changes_requested"), "draft")
        with self.assertRaises(ValueError):
            validate_media_review({"decision": "approved", "content_checked": True}, require_approved=True)
        asset = illustration(2)
        asset["relations"] = {"replaces": {"id": "voice-pathway", "version": 1, "locale": "en"}}
        self.assertEqual(validate_media_asset(asset)["relations"]["replaces"]["version"], 1)

    def test_public_manifest_keeps_every_published_revision_addressable(self):
        manifest = build_public_media_manifest([
            {"asset": illustration(1)},
            {"asset": illustration(2)},
            {"asset": illustration(1, "fi")},
        ])
        self.assertEqual([(item["locale"], item["version"]) for item in manifest["assets"]], [("en", 1), ("en", 2), ("fi", 1)])
        self.assertNotIn("decision", manifest["assets"][0]["review"])
