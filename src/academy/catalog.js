export const ACADEMY_CATALOG_VERSION = 1;

const foundationsLessons = [
  {
    slug: "your-voice-your-goals",
    title: "Your voice, your goals",
    durationMinutes: 35,
    objective: "Choose a private, self-directed starting point and learn what FemmeVoice can and cannot measure.",
    blocks: ["text", "reflection", "checkpoint"],
  },
  {
    slug: "listening-before-changing",
    title: "Listening before changing",
    durationMinutes: 45,
    objective: "Notice pitch, effort, clarity, and comfort before trying to control them.",
    blocks: ["audio", "interactive_exercise", "reflection"],
  },
  {
    slug: "easy-sound-exploration",
    title: "Finding an easy sound",
    durationMinutes: 45,
    objective: "Explore gentle hums and vowels while recognizing comfort and stop signals.",
    blocks: ["text", "interactive_exercise", "reading", "checkpoint"],
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
    status: "in-development",
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
