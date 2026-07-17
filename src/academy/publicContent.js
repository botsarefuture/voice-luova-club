import { ACADEMY_COURSES } from "./catalog.js";
import { FOUNDATIONS_LESSONS } from "./content/foundations.js";

export function staticAcademyContent() {
  return { source: "bundled", courses: ACADEMY_COURSES.map((course) => ({ ...course, lessons: course.slug === "foundations" ? FOUNDATIONS_LESSONS.map(toLessonSummary) : course.lessons })) };
}

export function normalizePublishedAcademyContent(payload, fallback = staticAcademyContent()) {
  if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload.courses) || !payload.courses.length) return fallback;
  const courses = payload.courses.map(({ course, lessons }) => {
    if (!course?.slug || !Array.isArray(lessons) || !lessons.length) return null;
    const bundled = fallback.courses.find((item) => item.slug === course.slug) ?? {};
    return {
      ...bundled,
      ...course,
      status: "available",
      lessonCount: lessons.length,
      lessons: lessons.map(toLessonSummary),
      lessonDocuments: Object.fromEntries(lessons.map((lesson) => [lesson.slug, lesson])),
    };
  }).filter(Boolean);
  return courses.length ? { source: "published", courses } : fallback;
}

function toLessonSummary(lesson) {
  return { slug: lesson.slug, title: lesson.title, objective: lesson.objective, durationMinutes: lesson.metadata?.estimatedMinutes ?? lesson.blocks?.reduce((total, block) => total + (block.durationMinutes || 0), 0) ?? 0, status: "available", document: lesson };
}
