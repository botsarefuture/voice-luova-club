import assert from "node:assert/strict";
import test from "node:test";
import { createBlankCourse, createBlankLesson, createNextCourseRevision, createNextLessonRevision } from "../src/academy/authoringTemplates.js";
import { validateLesson } from "../src/academy/schema.js";

test("blank authoring documents are usable without cloning Foundations", () => {
  const lesson = createBlankLesson(1234);
  const course = createBlankCourse(1234);
  assert.equal(lesson.id, "new-lesson-ya");
  assert.equal(validateLesson(lesson).valid, true);
  assert.equal(course.id, "new-course-ya");
  assert.equal(course.version, 1);
  assert.deepEqual(course.lessonIds, []);
});

test("new revisions preserve identity and advance exactly one version", () => {
  const lesson = createBlankLesson(1234);
  const course = createBlankCourse(1234);
  const lessonRevision = createNextLessonRevision(lesson);
  const courseRevision = createNextCourseRevision(course);
  assert.equal(lessonRevision.id, lesson.id);
  assert.equal(lessonRevision.version, 2);
  assert.equal(lessonRevision.previousVersionId, `${lesson.id}:1`);
  assert.equal(courseRevision.id, course.id);
  assert.equal(courseRevision.version, 2);
  assert.equal(courseRevision.previousVersionId, `${course.id}:1`);
});
