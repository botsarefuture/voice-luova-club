const HISTORY_KEY = "femmevoice:academy:learner-history";
export const ACADEMY_HISTORY_VERSION = 1;
const MAX_SESSIONS = 2000;
const MAX_JOURNAL_ENTRIES = 500;

export function createAcademyHistory() {
  return {
    version: ACADEMY_HISTORY_VERSION,
    lessons: {},
    sessions: [],
    journal: [],
    updatedAt: null,
  };
}

export function loadAcademyHistory(storage = globalThis.localStorage) {
  try {
    return normalizeAcademyHistory(JSON.parse(storage?.getItem(HISTORY_KEY) ?? "null"));
  } catch {
    return createAcademyHistory();
  }
}

export function saveAcademyHistory(history, storage = globalThis.localStorage) {
  const normalized = normalizeAcademyHistory(history);
  if (hasStoredActivity(normalized)) storage?.setItem(HISTORY_KEY, JSON.stringify(normalized));
  else storage?.removeItem(HISTORY_KEY);
  return normalized;
}

export function clearAcademyHistory(storage = globalThis.localStorage) {
  storage?.removeItem(HISTORY_KEY);
  return createAcademyHistory();
}

export function normalizeAcademyHistory(value) {
  if (!value || value.version !== ACADEMY_HISTORY_VERSION) return createAcademyHistory();
  const lessons = Object.fromEntries(Object.entries(value.lessons ?? {})
    .filter(([, lesson]) => lesson && typeof lesson === "object" && typeof lesson.lessonId === "string")
    .map(([id, lesson]) => [id, normalizeLessonRecord(lesson)]));
  const sessions = Array.isArray(value.sessions) ? value.sessions.map(normalizeSession).filter(Boolean).slice(-MAX_SESSIONS) : [];
  const journal = Array.isArray(value.journal) ? value.journal.map(normalizeJournalEntry).filter(Boolean).slice(-MAX_JOURNAL_ENTRIES) : [];
  return {
    version: ACADEMY_HISTORY_VERSION,
    lessons,
    sessions,
    journal,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

export function recordLessonActivity(history, { courseSlug, lesson, progress, sessionId, activeSeconds = 0, now = new Date().toISOString() }) {
  const normalized = normalizeAcademyHistory(history);
  const session = normalizeSession({
    id: sessionId,
    courseSlug,
    lessonId: lesson.id,
    lessonSlug: lesson.slug,
    lessonVersion: lesson.version,
    lessonTitle: lesson.title,
    startedAt: now,
    lastActiveAt: now,
    activeSeconds,
    completed: progress.isComplete === true,
  });
  if (!session) return normalized;

  const existingSessionIndex = normalized.sessions.findIndex((item) => item.id === session.id);
  const existingSession = existingSessionIndex >= 0 ? normalized.sessions[existingSessionIndex] : null;
  const savedSession = {
    ...existingSession,
    ...session,
    startedAt: existingSession?.startedAt ?? session.startedAt,
    activeSeconds: Math.max(existingSession?.activeSeconds ?? 0, session.activeSeconds),
    completed: Boolean(existingSession?.completed || session.completed),
  };
  const sessions = existingSessionIndex >= 0
    ? normalized.sessions.map((item, index) => index === existingSessionIndex ? savedSession : item)
    : [...normalized.sessions, savedSession].slice(-MAX_SESSIONS);
  const previousLesson = normalized.lessons[lesson.id];
  const revisionChanged = previousLesson && previousLesson.lessonVersion !== lesson.version;
  const previousRevision = revisionChanged ? null : previousLesson;
  const lessonRecord = normalizeLessonRecord({
    ...previousRevision,
    courseSlug,
    lessonId: lesson.id,
    lessonSlug: lesson.slug,
    lessonVersion: lesson.version,
    lessonTitle: lesson.title,
    totalBlocks: progress.totalBlocks,
    currentBlock: progress.currentBlock,
    completedBlockIds: progress.completedBlockIds,
    completionPercentage: progress.completionPercentage,
    startedAt: previousRevision?.startedAt ?? now,
    lastPracticedAt: now,
    completedAt: progress.isComplete ? previousRevision?.completedAt ?? now : previousRevision?.completedAt ?? null,
    completed: Boolean(previousRevision?.completed || progress.isComplete),
  });

  return normalizeAcademyHistory({
    ...normalized,
    lessons: { ...normalized.lessons, [lesson.id]: lessonRecord },
    sessions,
    updatedAt: now,
  });
}

export function addAcademyJournalEntry(history, { note, ease = null, courseSlug = null, lessonId = null, now = new Date().toISOString() }) {
  const trimmed = String(note ?? "").trim();
  if (!trimmed || trimmed.length > 1000) return normalizeAcademyHistory(history);
  const normalized = normalizeAcademyHistory(history);
  return normalizeAcademyHistory({
    ...normalized,
    journal: [...normalized.journal, { id: `journal_${crypto.randomUUID?.() ?? `${Date.now()}_${Math.random()}`}`, note: trimmed, ease, courseSlug, lessonId, createdAt: now }].slice(-MAX_JOURNAL_ENTRIES),
    updatedAt: now,
  });
}

export function mergeAcademyHistories(first, second) {
  const primary = normalizeAcademyHistory(first);
  const secondary = normalizeAcademyHistory(second);
  const lessons = new Map(Object.entries(primary.lessons));
  Object.entries(secondary.lessons).forEach(([id, lesson]) => lessons.set(id, mergeLessonRecord(lessons.get(id), lesson)));
  const sessions = mergeById(primary.sessions, secondary.sessions, mergeSessionRecord).slice(-MAX_SESSIONS);
  const journal = mergeById(primary.journal, secondary.journal, (left, right) => laterRecord(left, right, "createdAt")).slice(-MAX_JOURNAL_ENTRIES);
  return normalizeAcademyHistory({
    version: ACADEMY_HISTORY_VERSION,
    lessons: Object.fromEntries(lessons),
    sessions,
    journal,
    updatedAt: laterTimestamp(primary.updatedAt, secondary.updatedAt),
  });
}

export function summarizeAcademyHistory(history, courseSlug, availableLessons = []) {
  const normalized = normalizeAcademyHistory(history);
  const courseLessons = Object.values(normalized.lessons).filter((lesson) => lesson.courseSlug === courseSlug);
  const completedLessons = courseLessons.filter((lesson) => lesson.completed).length;
  const totalActiveSeconds = normalized.sessions
    .filter((session) => session.courseSlug === courseSlug)
    .reduce((total, session) => total + session.activeSeconds, 0);
  const weekStart = startOfLocalWeek();
  const weekSeconds = normalized.sessions
    .filter((session) => session.courseSlug === courseSlug && isOnOrAfter(session.lastActiveAt, weekStart))
    .reduce((total, session) => total + session.activeSeconds, 0);
  const recentLesson = courseLessons.slice().sort((a, b) => String(b.lastPracticedAt).localeCompare(String(a.lastPracticedAt)))[0] ?? null;
  return {
    totalLessons: availableLessons.length,
    completedLessons,
    totalActiveSeconds,
    weekSeconds,
    recentLesson,
    recentLessons: courseLessons.slice().sort((a, b) => String(b.lastPracticedAt).localeCompare(String(a.lastPracticedAt))).slice(0, 3),
    days: recentActivityDays(normalized.sessions, courseSlug),
    journal: normalized.journal.filter((entry) => entry.courseSlug === courseSlug).slice().reverse(),
  };
}

function normalizeLessonRecord(value) {
  return {
    courseSlug: typeof value?.courseSlug === "string" ? value.courseSlug : null,
    lessonId: String(value?.lessonId ?? ""),
    lessonSlug: typeof value?.lessonSlug === "string" ? value.lessonSlug : null,
    lessonVersion: Number.isInteger(value?.lessonVersion) ? value.lessonVersion : 1,
    lessonTitle: typeof value?.lessonTitle === "string" ? value.lessonTitle.slice(0, 160) : "Lesson",
    totalBlocks: Number.isInteger(value?.totalBlocks) ? Math.max(0, value.totalBlocks) : 0,
    currentBlock: Number.isInteger(value?.currentBlock) ? Math.max(0, value.currentBlock) : 0,
    completedBlockIds: Array.isArray(value?.completedBlockIds) ? [...new Set(value.completedBlockIds.filter((id) => typeof id === "string"))] : [],
    completionPercentage: Number.isFinite(value?.completionPercentage) ? Math.max(0, Math.min(100, Math.round(value.completionPercentage))) : 0,
    startedAt: typeof value?.startedAt === "string" ? value.startedAt : null,
    lastPracticedAt: typeof value?.lastPracticedAt === "string" ? value.lastPracticedAt : null,
    completedAt: typeof value?.completedAt === "string" ? value.completedAt : null,
    completed: value?.completed === true,
  };
}

function normalizeSession(value) {
  if (!value || typeof value.id !== "string" || typeof value.lessonId !== "string") return null;
  return {
    id: value.id.slice(0, 120),
    courseSlug: typeof value.courseSlug === "string" ? value.courseSlug : null,
    lessonId: value.lessonId.slice(0, 120),
    lessonSlug: typeof value.lessonSlug === "string" ? value.lessonSlug.slice(0, 120) : null,
    lessonVersion: Number.isInteger(value.lessonVersion) ? value.lessonVersion : 1,
    lessonTitle: typeof value.lessonTitle === "string" ? value.lessonTitle.slice(0, 160) : "Lesson",
    startedAt: typeof value.startedAt === "string" ? value.startedAt : null,
    lastActiveAt: typeof value.lastActiveAt === "string" ? value.lastActiveAt : null,
    activeSeconds: Number.isFinite(value.activeSeconds) ? Math.max(0, Math.min(8 * 60 * 60, Math.round(value.activeSeconds))) : 0,
    completed: value.completed === true,
  };
}

function normalizeJournalEntry(value) {
  if (!value || typeof value.id !== "string" || typeof value.note !== "string") return null;
  const note = value.note.trim();
  if (!note || note.length > 1000) return null;
  return {
    id: value.id.slice(0, 120),
    note,
    ease: ["easy", "okay", "unsure", "not-today"].includes(value.ease) ? value.ease : null,
    courseSlug: typeof value.courseSlug === "string" ? value.courseSlug : null,
    lessonId: typeof value.lessonId === "string" ? value.lessonId : null,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
  };
}

function mergeLessonRecord(left, right) {
  if (!left) return right;
  if (!right) return left;
  if (left.lessonVersion !== right.lessonVersion) return left.lessonVersion > right.lessonVersion ? left : right;
  const recent = laterRecord(left, right, "lastPracticedAt");
  const earlierCompletedAt = earliestTimestamp(left.completedAt, right.completedAt);
  return normalizeLessonRecord({
    ...recent,
    completedBlockIds: [...new Set([...left.completedBlockIds, ...right.completedBlockIds])],
    completionPercentage: Math.max(left.completionPercentage, right.completionPercentage),
    currentBlock: Math.max(left.currentBlock, right.currentBlock),
    startedAt: earliestTimestamp(left.startedAt, right.startedAt),
    completedAt: left.completed || right.completed ? earlierCompletedAt ?? recent.completedAt : null,
    completed: left.completed || right.completed,
  });
}

function mergeSessionRecord(left, right) {
  if (!left) return right;
  if (!right) return left;
  const recent = laterRecord(left, right, "lastActiveAt");
  return normalizeSession({
    ...recent,
    startedAt: earliestTimestamp(left.startedAt, right.startedAt),
    activeSeconds: Math.max(left.activeSeconds, right.activeSeconds),
    completed: left.completed || right.completed,
  });
}

function mergeById(first, second, merge) {
  const records = new Map(first.map((item) => [item.id, item]));
  second.forEach((item) => records.set(item.id, merge(records.get(item.id), item)));
  return Array.from(records.values()).sort((left, right) => {
    const timestamp = String(left.createdAt ?? left.startedAt ?? left.lastActiveAt).localeCompare(String(right.createdAt ?? right.startedAt ?? right.lastActiveAt));
    return timestamp || String(left.id).localeCompare(String(right.id));
  });
}

function laterRecord(left, right, timestampKey) {
  if (!left) return right;
  if (!right) return left;
  const comparison = String(left[timestampKey] ?? "").localeCompare(String(right[timestampKey] ?? ""));
  if (comparison !== 0) return comparison > 0 ? left : right;
  return JSON.stringify(left) >= JSON.stringify(right) ? left : right;
}

function laterTimestamp(left, right) {
  return String(left ?? "").localeCompare(String(right ?? "")) >= 0 ? left : right;
}

function earliestTimestamp(left, right) {
  if (!left) return right ?? null;
  if (!right) return left;
  return String(left).localeCompare(String(right)) <= 0 ? left : right;
}

function hasStoredActivity(history) {
  return Object.keys(history.lessons).length > 0 || history.sessions.length > 0 || history.journal.length > 0;
}

function startOfLocalWeek() {
  const date = new Date();
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function recentActivityDays(sessions, courseSlug) {
  const byDate = new Map();
  sessions.filter((session) => session.courseSlug === courseSlug).forEach((session) => {
    const date = localDateKey(session.lastActiveAt);
    if (date) byDate.set(date, (byDate.get(date) ?? 0) + session.activeSeconds);
  });
  const today = new Date();
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (13 - index));
    const key = localDateKey(date);
    return { date: key, activeSeconds: byDate.get(key) ?? 0 };
  });
}

function isOnOrAfter(value, boundary) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= boundary;
}

function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
