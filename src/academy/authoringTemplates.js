import { LESSON_SCHEMA_VERSION } from "./schema.js";

function uniqueSlug(prefix, now = Date.now()) {
  return `${prefix}-${now.toString(36)}`;
}

export function createBlankLesson(now) {
  const slug = uniqueSlug("new-lesson", now);
  return {
    schemaVersion: LESSON_SCHEMA_VERSION,
    id: slug,
    slug,
    version: 1,
    locale: "en",
    translations: [],
    title: "Untitled lesson",
    objective: "Describe what the learner will understand or practise.",
    metadata: {
      programId: "gender-affirming-voice",
      pathIds: [],
      unitId: null,
      estimatedMinutes: 5,
      tags: [],
      completionMessage: "You completed this lesson.",
    },
    accessibility: {
      alternative: "This lesson is available as text.",
      transcript: null,
      captions: null,
      reducedMotionAlternative: null,
    },
    safety: {
      note: "Pause if anything feels uncomfortable.",
      stopSignals: ["pain", "persistent hoarseness", "unusual fatigue"],
      lowerIntensityAlternative: "Pause, choose a listening-only route, or return another day.",
    },
    evidence: [],
    blocks: [{
      id: "introduction",
      type: "text",
      version: 1,
      metadata: { label: "Start", title: "Introduce this lesson" },
      durationMinutes: 1,
      completion: { kind: "manual" },
      accessibility: {},
      safety: {},
      evidenceRefs: [],
      content: { text: "Write a short, welcoming introduction." },
    }],
  };
}

export function createBlankCourse(now) {
  const slug = uniqueSlug("new-course", now);
  return {
    id: slug,
    slug,
    version: 1,
    title: "Untitled course",
    summary: "Describe who this course is for and what it helps them learn.",
    locale: "en",
    estimatedMinutes: 0,
    lessonIds: [],
    tags: [],
    prerequisiteCourseIds: [],
  };
}

export function createNextLessonRevision(lesson) {
  return { ...structuredClone(lesson), version: lesson.version + 1, previousVersionId: `${lesson.id}:${lesson.version}` };
}

export function createNextCourseRevision(course) {
  return { ...structuredClone(course), version: (course.version ?? 1) + 1, previousVersionId: `${course.id}:${course.version ?? 1}` };
}
