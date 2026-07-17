export function parseAppRoute(hash = "") {
  const segments = String(hash)
    .replace(/^#/, "")
    .split("/")
    .filter(Boolean);
  const view = decodeSegment(segments[0]) || "today";

  return {
    view,
    academyCourseSlug: view === "academy" ? decodeSegment(segments[1]) : null,
    academyLessonSlug: view === "academy" ? decodeSegment(segments[2]) : null,
  };
}

export function academyRoute(courseSlug = null, lessonSlug = null) {
  if (!courseSlug) return "academy";
  const coursePath = `academy/${encodeURIComponent(courseSlug)}`;
  return lessonSlug ? `${coursePath}/${encodeURIComponent(lessonSlug)}` : coursePath;
}

function decodeSegment(value) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
