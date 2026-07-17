export const ACADEMY_CATALOG_VERSION = 1;

const foundationsLessons = [
  {
    slug: "welcome-to-femmevoice",
    title: "Welcome to FemmeVoice",
    durationMinutes: 8,
    objective: "Choose a gentle starting point and learn what this space is for.",
    status: "available",
  },
  {
    slug: "safety-privacy-and-pause",
    title: "Safety, privacy, and pause",
    durationMinutes: 9,
    objective: "Know the limits that protect your voice and your data before you practise.",
    status: "available",
  },
  {
    slug: "how-voice-learning-works",
    title: "How voice learning works",
    durationMinutes: 10,
    objective: "Understand the few ideas that make early practice easier to explore.",
    status: "available",
  },
  {
    slug: "first-listening-and-gentle-exploration",
    title: "First listening and gentle exploration",
    durationMinutes: 12,
    objective: "Try one small, low-pressure sound experiment and return to an ordinary phrase.",
    status: "available",
  },
];

export const ACADEMY_COURSES = [
  {
    slug: "foundations",
    title: "Foundations",
    eyebrow: "Start here",
    audience: "New to voice training or looking for a safer, clearer reset.",
    summary: "Learn to listen, explore gently, and build a practice routine that respects your voice and your goals.",
    estimatedMinutes: 600,
    lessonCount: 12,
    status: "available",
    evidenceLevel: "Mixed evidence and clinical consensus",
    lastReviewed: "2026-07-17",
    safetyNote: "Every exercise includes a lower-intensity route. Stop for pain, persistent hoarseness, or unusual fatigue.",
    lessons: foundationsLessons,
  },
  {
    slug: "consistency-and-carryover",
    title: "Consistency and carryover",
    eyebrow: "Next course",
    audience: "For people who understand the foundations and want more control in connected speech.",
    summary: "Develop reliable, natural communication across reading, conversation, emotion, and longer speaking tasks.",
    estimatedMinutes: 660,
    lessonCount: 12,
    status: "planned",
    evidenceLevel: "Curriculum in review",
    lastReviewed: null,
    safetyNote: "This course will open after the Foundations lesson engine and content review are complete.",
    lessons: [],
  },
  {
    slug: "daily-practice",
    title: "Daily practice",
    eyebrow: "Maintenance",
    audience: "For people who want flexible, repeatable practice without starting from scratch each day.",
    summary: "Choose a five to thirty minute routine that rotates skills and leaves room for rest, confidence, and real life.",
    estimatedMinutes: null,
    lessonCount: 0,
    status: "planned",
    evidenceLevel: "Curriculum in review",
    lastReviewed: null,
    safetyNote: "Daily practice will never require public sharing, recordings, or a perfect streak.",
    lessons: [],
  },
];

export function getAcademyCourse(slug) {
  return ACADEMY_COURSES.find((course) => course.slug === slug) ?? null;
}

export function formatCourseDuration(minutes) {
  if (!minutes) return "Flexible sessions";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}
