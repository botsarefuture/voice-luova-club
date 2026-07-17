from copy import deepcopy

LESSON_SCHEMA_VERSION = 1
CONTENT_STATES = {"draft", "review_requested", "in_review", "published"}
BLOCK_TYPES = {"text", "rich_text", "image", "video", "audio", "reflection", "quiz", "interactive_exercise", "reading", "conversation_prompt", "recording", "resource_download", "checkpoint", "why_this"}


def validate_lesson_document(lesson):
    if not isinstance(lesson, dict):
        raise ValueError("Lesson must be an object.")
    required = ("schemaVersion", "id", "slug", "title", "version", "locale", "metadata", "evidence", "safety", "accessibility", "blocks")
    if any(key not in lesson for key in required):
        raise ValueError("Lesson is missing required fields.")
    if lesson["schemaVersion"] != LESSON_SCHEMA_VERSION or not _text(lesson["id"], 120) or not _text(lesson["slug"], 120) or not _text(lesson["title"], 200):
        raise ValueError("Lesson identity is invalid.")
    if not isinstance(lesson["version"], int) or lesson["version"] < 1 or not _text(lesson["locale"], 20):
        raise ValueError("Lesson version or locale is invalid.")
    if not isinstance(lesson["metadata"], dict) or not isinstance(lesson["safety"], dict) or not isinstance(lesson["accessibility"], dict):
        raise ValueError("Lesson metadata, safety, and accessibility must be objects.")
    if not isinstance(lesson["evidence"], list) or not isinstance(lesson["blocks"], list) or not lesson["blocks"] or len(lesson["blocks"]) > 100:
        raise ValueError("Lesson needs one to 100 blocks.")
    evidence_ids = set()
    for item in lesson["evidence"]:
        if not isinstance(item, dict) or not _text(item.get("id"), 120) or not _text(item.get("label"), 300) or not _text(item.get("level"), 120) or not _text(item.get("citation"), 2000) or not _text(item.get("limitation"), 2000):
            raise ValueError("Evidence needs id, label, level, citation, and limitation.")
        evidence_ids.add(item["id"])
    block_ids = set()
    for block in lesson["blocks"]:
        _validate_block(block, evidence_ids)
        if block["id"] in block_ids:
            raise ValueError("Block ids must be unique.")
        block_ids.add(block["id"])
    return deepcopy(lesson)


def validate_review(review):
    if not isinstance(review, dict) or review.get("decision") not in {"approved", "changes_requested"}:
        raise ValueError("Review needs an approval decision.")
    for key in ("content_checked", "research_checked", "accessibility_checked"):
        if review.get(key) is not True:
            raise ValueError("Content, research, and accessibility review are all required.")
    note = review.get("note", "")
    if not isinstance(note, str) or len(note) > 4000:
        raise ValueError("Review note is too long.")
    return {"decision": review["decision"], "content_checked": True, "research_checked": True, "accessibility_checked": True, "note": note.strip()}


def can_submit_for_review(status):
    return status in {"draft", "review_requested"}


def review_result_status(decision):
    return "in_review" if decision == "approved" else "draft"


def build_public_catalogue(course_records, lesson_records):
    lessons_by_slug = {item["lesson"]["slug"]: item["lesson"] for item in lesson_records if item.get("lesson", {}).get("slug")}
    courses = []
    for record in course_records:
        course = record.get("course") or {}
        ordered_lessons = [lessons_by_slug.get(slug) for slug in course.get("lessonIds", [])]
        if not ordered_lessons or any(item is None for item in ordered_lessons):
            continue
        courses.append({"course": course, "lessons": ordered_lessons, "publishedAt": record.get("published_at")})
    return {"schemaVersion": 1, "courses": courses}


def validate_course_document(course):
    if not isinstance(course, dict):
        raise ValueError("Course must be an object.")
    required = ("id", "slug", "title", "summary", "locale", "estimatedMinutes", "lessonIds")
    if any(key not in course for key in required):
        raise ValueError("Course is missing required fields.")
    if not all(_text(course[key], 2000 if key == "summary" else 200) for key in ("id", "slug", "title", "summary", "locale")):
        raise ValueError("Course identity is invalid.")
    if not isinstance(course["estimatedMinutes"], int) or course["estimatedMinutes"] < 0:
        raise ValueError("Course duration is invalid.")
    if not isinstance(course["lessonIds"], list) or len(course["lessonIds"]) > 100 or len(set(course["lessonIds"])) != len(course["lessonIds"]) or not all(_text(item, 120) for item in course["lessonIds"]):
        raise ValueError("Course lesson ordering is invalid.")
    clean = deepcopy(course)
    clean["prerequisiteCourseIds"] = [item for item in course.get("prerequisiteCourseIds", []) if _text(item, 120)] if isinstance(course.get("prerequisiteCourseIds", []), list) else []
    clean["tags"] = [item for item in course.get("tags", []) if _text(item, 80)] if isinstance(course.get("tags", []), list) else []
    return clean


def _validate_block(block, evidence_ids):
    if not isinstance(block, dict) or not _text(block.get("id"), 120) or block.get("type") not in BLOCK_TYPES:
        raise ValueError("Block id or type is invalid.")
    if not isinstance(block.get("version"), int) or block["version"] < 1 or not isinstance(block.get("metadata"), dict):
        raise ValueError("Block metadata is invalid.")
    if not isinstance(block.get("durationMinutes"), int) or not 0 <= block["durationMinutes"] <= 120:
        raise ValueError("Block duration is invalid.")
    if not isinstance(block.get("completion"), dict) or not isinstance(block.get("accessibility"), dict) or not isinstance(block.get("safety"), dict) or not isinstance(block.get("content"), dict):
        raise ValueError("Block structure is invalid.")
    if not isinstance(block.get("evidenceRefs"), list) or any(reference not in evidence_ids for reference in block["evidenceRefs"]):
        raise ValueError("Block evidence references are invalid.")
    content = block["content"]
    block_type = block["type"]
    required = {"text": "text", "reflection": "prompt", "conversation_prompt": "prompt", "recording": "prompt", "interactive_exercise": "instructions", "reading": "passage", "checkpoint": "message", "why_this": "prompt"}.get(block_type)
    if required and not _text(content.get(required), 8000):
        raise ValueError(f"Block {block['id']} needs {required}.")
    if block_type == "quiz":
        options = content.get("options")
        if not _text(content.get("prompt"), 4000) or not isinstance(options, list) or len(options) < 2 or len(options) > 12 or sum(option.get("correct") is True for option in options if isinstance(option, dict)) != 1:
            raise ValueError("Quiz needs a prompt and exactly one correct option.")
    if block_type in {"image", "audio", "video"}:
        if not _text(content.get("src"), 2000):
            raise ValueError("Media needs a source.")
        accessibility = block["accessibility"]
        if block_type == "image" and not _text(accessibility.get("alternative"), 2000):
            raise ValueError("Images need alternative text.")
        if block_type in {"audio", "video"} and not _text(accessibility.get("transcript"), 12000):
            raise ValueError("Audio and video need a transcript.")
        if block_type == "video" and not _text(accessibility.get("captions"), 2000):
            raise ValueError("Video needs captions.")


def _text(value, maximum):
    return isinstance(value, str) and bool(value.strip()) and len(value) <= maximum
