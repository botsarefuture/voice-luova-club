from copy import deepcopy
import re
from urllib.parse import urlparse

MEDIA_SCHEMA_VERSION = 1
MEDIA_KINDS = {"audio", "video", "image", "document"}
MEDIA_STATES = {"draft", "review_requested", "in_review", "published"}
REVIEW_KEYS = ("content_checked", "research_checked", "accessibility_checked")


def validate_media_asset(asset, require_review=True, publication_ready=True):
    if not isinstance(asset, dict):
        raise ValueError("Media asset must be an object.")
    required = ("id", "version", "kind", "locale", "source", "title", "mimeType", "byteSize", "checksum", "rights", "accessibility", "review")
    if any(key not in asset for key in required):
        raise ValueError("Media asset is missing required fields.")
    if asset.get("schemaVersion", MEDIA_SCHEMA_VERSION) != MEDIA_SCHEMA_VERSION:
        raise ValueError("Media asset schema version is unsupported.")
    if not _text(asset["id"], 120) or not isinstance(asset["version"], int) or asset["version"] < 1:
        raise ValueError("Media asset identity is invalid.")
    if asset["kind"] not in MEDIA_KINDS or not _text(asset["locale"], 20) or not _safe_source(asset["source"], https_allowed=False) or not _text(asset["title"], 300):
        raise ValueError("Media asset metadata is invalid.")
    if not _text(asset["mimeType"], 120) or not isinstance(asset["byteSize"], int) or not 0 <= asset["byteSize"] <= 5_000_000_000:
        raise ValueError("Media type or byte size is invalid.")
    if not isinstance(asset["checksum"], str) or not re.fullmatch(r"sha256:[a-fA-F0-9]{64}", asset["checksum"]):
        raise ValueError("Media assets need a SHA-256 checksum.")
    _validate_rights(asset["rights"], require_complete=publication_ready)
    _validate_accessibility(asset["kind"], asset["accessibility"], require_complete=publication_ready)
    if publication_ready and (asset["byteSize"] < 1 or asset["checksum"] == f"sha256:{'0' * 64}" or "/placeholder." in asset["source"]):
        raise ValueError("Replace placeholder media with a real, checksummed asset before review.")
    _validate_relations(asset.get("relations", {}))
    review = validate_media_review(asset["review"], require_approved=require_review)
    clean = deepcopy(asset)
    clean["schemaVersion"] = MEDIA_SCHEMA_VERSION
    clean["review"] = review
    clean["relations"] = deepcopy(asset.get("relations", {}))
    return clean


def validate_media_review(review, require_approved=True):
    if not isinstance(review, dict):
        raise ValueError("Media review must be an object.")
    clean = {key: review.get(key) is True for key in REVIEW_KEYS}
    if require_approved and not all(clean.values()):
        raise ValueError("Content, research, and accessibility review are required.")
    decision = review.get("decision", "approved" if all(clean.values()) else "pending")
    if decision not in {"pending", "approved", "changes_requested"}:
        raise ValueError("Media review decision is invalid.")
    note = review.get("note", "")
    if not isinstance(note, str) or len(note) > 4000:
        raise ValueError("Media review note is too long.")
    return {**clean, "decision": decision, "note": note.strip()}


def media_review_result_status(decision):
    return "in_review" if decision == "approved" else "draft"


def build_public_media_manifest(records):
    published = {}
    for record in records:
        asset = record.get("asset") or {}
        identity = (asset.get("id"), asset.get("version"), asset.get("locale"))
        version = asset.get("version", 0)
        if identity[0] and isinstance(version, int) and version > 0 and identity[2]:
            published[identity] = asset
    assets = []
    for asset in published.values():
        public = deepcopy(asset)
        public["review"] = {key: public.get("review", {}).get(key) is True for key in REVIEW_KEYS}
        assets.append(public)
    assets.sort(key=lambda item: (item["id"], item["locale"], item["version"]))
    return {"schemaVersion": MEDIA_SCHEMA_VERSION, "assets": assets}


def _validate_rights(rights, require_complete=True):
    if not isinstance(rights, dict):
        raise ValueError("Media rights metadata must be an object.")
    if require_complete and (not _text(rights.get("owner"), 300) or not _text(rights.get("license"), 300)):
        raise ValueError("Media asset rights and license are required.")
    if rights.get("sourceUrl") and not _safe_source(rights["sourceUrl"], local_allowed=False):
        raise ValueError("Media rights source URL is invalid.")
    if rights.get("attribution") is not None and not _optional_text(rights.get("attribution"), 1000):
        raise ValueError("Media attribution is invalid.")


def _validate_accessibility(kind, access, require_complete=True):
    if not isinstance(access, dict):
        raise ValueError("Media accessibility metadata is required.")
    if require_complete and kind == "image" and not _text(access.get("alternative"), 2000):
        raise ValueError("Images need alternative text.")
    if require_complete and kind in {"audio", "video"} and not _text(access.get("transcript"), 12000):
        raise ValueError("Audio and video need a transcript.")
    if require_complete and kind == "video" and not _safe_source(access.get("captions"), https_allowed=False):
        raise ValueError("Video needs a safe captions source.")
    if access.get("longDescription") is not None and not _optional_text(access.get("longDescription"), 12000):
        raise ValueError("Media long description is invalid.")


def _validate_relations(relations):
    if not isinstance(relations, dict):
        raise ValueError("Media relationships must be an object.")
    for key in ("replaces", "localizationOf"):
        reference = relations.get(key)
        if reference is None:
            continue
        if not isinstance(reference, dict) or not _text(reference.get("id"), 120) or not isinstance(reference.get("version"), int) or reference["version"] < 1 or not _text(reference.get("locale"), 20):
            raise ValueError(f"Media relationship {key} is invalid.")


def _safe_source(value, local_allowed=True, https_allowed=True):
    if not _text(value, 2000):
        return False
    if local_allowed and value.startswith("/") and not value.startswith("//"):
        return True
    parsed = urlparse(value)
    return https_allowed and parsed.scheme == "https" and bool(parsed.netloc)


def _optional_text(value, maximum):
    return value is None or value == "" or _text(value, maximum)


def _text(value, maximum):
    return isinstance(value, str) and bool(value.strip()) and len(value) <= maximum
