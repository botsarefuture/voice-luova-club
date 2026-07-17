import { ACADEMY_COURSES } from "./catalog.js";
import { FOUNDATIONS_LESSONS } from "./content/foundations.js";
import { resolveLessonMedia } from "./mediaResolver.js";

export function staticAcademyContent() {
  return { source: "bundled", courses: ACADEMY_COURSES.map((course) => ({ ...course, lessons: course.slug === "foundations" ? FOUNDATIONS_LESSONS.map(toLessonSummary) : course.lessons })) };
}

export function normalizePublishedAcademyContent(payload, fallback = staticAcademyContent(), mediaManifest = null) {
  const resolvedFallback = resolveCatalogueMedia(fallback, mediaManifest);
  if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload.courses) || !payload.courses.length) return resolvedFallback;
  const courses = payload.courses.map(({ course, lessons }) => {
    if (!course?.slug || !Array.isArray(lessons) || !lessons.length) return null;
    const bundled = fallback.courses.find((item) => item.slug === course.slug) ?? {};
    const resolvedLessons = lessons.map((lesson) => resolveLessonMedia(lesson, mediaManifest));
    return {
      ...bundled,
      ...course,
      status: "available",
      lessonCount: lessons.length,
      lessons: resolvedLessons.map(toLessonSummary),
      lessonDocuments: Object.fromEntries(resolvedLessons.map((lesson) => [lesson.slug, lesson])),
    };
  }).filter(Boolean);
  return courses.length ? { source: "published", courses } : resolvedFallback;
}

function resolveCatalogueMedia(catalogue, manifest) {
  if (!manifest?.assets?.length) return catalogue;
  return { ...catalogue, courses: catalogue.courses.map((course) => {
    const lessons = course.lessons.map((lesson) => {
      const document = resolveLessonMedia(lesson.document, manifest);
      return document === lesson.document ? lesson : { ...lesson, document };
    });
    return { ...course, lessons, lessonDocuments: course.lessonDocuments ? Object.fromEntries(Object.entries(course.lessonDocuments).map(([slug, lesson]) => [slug, resolveLessonMedia(lesson, manifest)])) : course.lessonDocuments };
  }) };
}

function toLessonSummary(lesson) {
  return { slug: lesson.slug, title: lesson.title, objective: lesson.objective, durationMinutes: lesson.metadata?.estimatedMinutes ?? lesson.blocks?.reduce((total, block) => total + (block.durationMinutes || 0), 0) ?? 0, status: "available", document: lesson };
}
