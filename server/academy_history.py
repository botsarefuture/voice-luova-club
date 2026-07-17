from datetime import datetime

ACADEMY_HISTORY_VERSION = 1
MAX_LESSONS = 500
MAX_SESSIONS = 2000
MAX_JOURNAL_ENTRIES = 500


def normalize_academy_history(value):
    if not isinstance(value, dict) or value.get("version") != ACADEMY_HISTORY_VERSION:
        raise ValueError("Academy history must use version 1.")
    lessons = value.get("lessons")
    sessions = value.get("sessions")
    journal = value.get("journal")
    if not isinstance(lessons, dict) or not isinstance(sessions, list) or not isinstance(journal, list):
        raise ValueError("Academy history has an invalid structure.")
    if len(lessons) > MAX_LESSONS or len(sessions) > MAX_SESSIONS or len(journal) > MAX_JOURNAL_ENTRIES:
        raise ValueError("Academy history is over its allowed size.")

    clean_lessons = {}
    for key, item in lessons.items():
        if not isinstance(key, str) or not 1 <= len(key) <= 120:
            raise ValueError("Academy history contains an invalid lesson id.")
        clean_lessons[key] = _lesson(item)
        if clean_lessons[key]["lessonId"] != key:
            raise ValueError("Academy history lesson ids do not match.")

    return {
        "version": ACADEMY_HISTORY_VERSION,
        "lessons": clean_lessons,
        "sessions": [_session(item) for item in sessions],
        "journal": [_journal(item) for item in journal],
        "updatedAt": _timestamp(value.get("updatedAt"), allow_none=True),
    }


def _lesson(value):
    _only(value, {
        "courseSlug", "lessonId", "lessonSlug", "lessonVersion", "lessonTitle", "totalBlocks",
        "currentBlock", "completedBlockIds", "completionPercentage", "startedAt", "lastPracticedAt",
        "completedAt", "completed",
    })
    completed_ids = value.get("completedBlockIds")
    if not isinstance(completed_ids, list) or len(completed_ids) > 1000:
        raise ValueError("Academy history contains invalid completed steps.")
    return {
        "courseSlug": _optional_text(value.get("courseSlug"), 120),
        "lessonId": _text(value.get("lessonId"), 120),
        "lessonSlug": _optional_text(value.get("lessonSlug"), 120),
        "lessonVersion": _integer(value.get("lessonVersion"), 1, 10_000),
        "lessonTitle": _text(value.get("lessonTitle"), 160),
        "totalBlocks": _integer(value.get("totalBlocks"), 0, 10_000),
        "currentBlock": _integer(value.get("currentBlock"), 0, 10_000),
        "completedBlockIds": [_text(item, 120) for item in completed_ids],
        "completionPercentage": _integer(value.get("completionPercentage"), 0, 100),
        "startedAt": _timestamp(value.get("startedAt"), allow_none=True),
        "lastPracticedAt": _timestamp(value.get("lastPracticedAt"), allow_none=True),
        "completedAt": _timestamp(value.get("completedAt"), allow_none=True),
        "completed": _boolean(value.get("completed")),
    }


def _session(value):
    _only(value, {"id", "courseSlug", "lessonId", "lessonSlug", "lessonVersion", "lessonTitle", "startedAt", "lastActiveAt", "activeSeconds", "completed"})
    return {
        "id": _text(value.get("id"), 120),
        "courseSlug": _optional_text(value.get("courseSlug"), 120),
        "lessonId": _text(value.get("lessonId"), 120),
        "lessonSlug": _optional_text(value.get("lessonSlug"), 120),
        "lessonVersion": _integer(value.get("lessonVersion"), 1, 10_000),
        "lessonTitle": _text(value.get("lessonTitle"), 160),
        "startedAt": _timestamp(value.get("startedAt"), allow_none=True),
        "lastActiveAt": _timestamp(value.get("lastActiveAt"), allow_none=True),
        "activeSeconds": _integer(value.get("activeSeconds"), 0, 8 * 60 * 60),
        "completed": _boolean(value.get("completed")),
    }


def _journal(value):
    _only(value, {"id", "note", "ease", "courseSlug", "lessonId", "createdAt"})
    ease = value.get("ease")
    if ease not in {None, "easy", "okay", "unsure", "not-today"}:
        raise ValueError("Academy history contains an invalid ease label.")
    return {
        "id": _text(value.get("id"), 120),
        "note": _text(value.get("note"), 1000),
        "ease": ease,
        "courseSlug": _optional_text(value.get("courseSlug"), 120),
        "lessonId": _optional_text(value.get("lessonId"), 120),
        "createdAt": _timestamp(value.get("createdAt"), allow_none=True),
    }


def _only(value, allowed):
    if not isinstance(value, dict) or set(value) - allowed:
        raise ValueError("Academy history contains unsupported fields.")


def _text(value, maximum):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise ValueError("Academy history contains invalid text.")
    return value.strip()


def _optional_text(value, maximum):
    if value is None:
        return None
    return _text(value, maximum)


def _integer(value, minimum, maximum):
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise ValueError("Academy history contains an invalid number.")
    return value


def _boolean(value):
    if not isinstance(value, bool):
        raise ValueError("Academy history contains an invalid flag.")
    return value


def _timestamp(value, allow_none=False):
    if value is None and allow_none:
        return None
    if not isinstance(value, str) or len(value) > 64:
        raise ValueError("Academy history contains an invalid timestamp.")
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("Academy history contains an invalid timestamp.") from exc
    return value
