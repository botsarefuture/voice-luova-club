import assert from "node:assert/strict";
import test from "node:test";
import { ACADEMY_CATALOG_VERSION, ACADEMY_COURSES, formatCourseDuration, getAcademyCourse } from "../src/academy/catalog.js";
import { academyRoute, parseAppRoute } from "../src/academy/routes.js";

test("academy routes retain nested content slugs without affecting other views", () => {
  assert.deepEqual(parseAppRoute("#academy/foundations/your-voice-your-goals"), {
    view: "academy",
    academyCourseSlug: "foundations",
    academyLessonSlug: "your-voice-your-goals",
  });
  assert.deepEqual(parseAppRoute("#practice"), { view: "practice", academyCourseSlug: null, academyLessonSlug: null });
  assert.equal(academyRoute("foundations"), "academy/foundations");
  assert.equal(academyRoute("foundations", "your voice"), "academy/foundations/your%20voice");
  assert.equal(parseAppRoute("#academy/foundations/your%20voice").academyLessonSlug, "your voice");
});

test("academy catalogue exposes a versioned Foundations course", () => {
  assert.equal(ACADEMY_CATALOG_VERSION, 1);
  assert.ok(ACADEMY_COURSES.length >= 1);
  assert.equal(getAcademyCourse("foundations")?.lessonCount, 12);
  assert.equal(getAcademyCourse("missing"), null);
});

test("course duration labels remain useful for timed and flexible courses", () => {
  assert.equal(formatCourseDuration(600), "10 hr");
  assert.equal(formatCourseDuration(95), "1 hr 35 min");
  assert.equal(formatCourseDuration(null), "Flexible sessions");
});
