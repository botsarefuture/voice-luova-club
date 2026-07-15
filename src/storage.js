export const dayKey = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function loadTodaySession() {
  const key = `voice-training:${dayKey()}`;
  try {
    const session = JSON.parse(localStorage.getItem(key));
    if (session?.date === dayKey()) return session;
  } catch {
    return null;
  }
  return {
    date: dayKey(),
    lowMidi: null,
    highMidi: null,
    attempts: [],
    minutes: 0,
    seconds: 0,
    breakAcknowledged: [],
    voiceCheck: "unset",
  };
}

export function saveTodaySession(session) {
  localStorage.setItem(`voice-training:${dayKey()}`, JSON.stringify(session));
}

export function getDeviceId() {
  const existing = localStorage.getItem("voice-training:device-id");
  if (existing) return existing;
  const generated = `voice_${crypto.randomUUID?.() ?? fallbackId()}`;
  localStorage.setItem("voice-training:device-id", generated);
  return generated;
}

export function loadProgress() {
  try {
    const progress = JSON.parse(localStorage.getItem("voice-training:progress"));
    if (progress?.version === 1) return normalizeProgress(progress);
  } catch {
    return defaultProgress();
  }
  return defaultProgress();
}

export function saveProgress(progress) {
  localStorage.setItem("voice-training:progress", JSON.stringify(normalizeProgress(progress)));
}

export function mergeTodayIntoProgress(progress, session, preferences) {
  const normalized = normalizeProgress(progress);
  const bestAttempt = session.attempts.reduce((best, attempt) => (
    !best || attempt.score > best.score ? attempt : best
  ), null);
  const today = {
    date: session.date,
    lowMidi: session.lowMidi,
    highMidi: session.highMidi,
    attempts: session.attempts.length,
    bestScore: bestAttempt?.score ?? null,
    bestNote: bestAttempt?.targetNote ?? null,
    minutes: session.minutes,
  };
  const days = [
    today,
    ...normalized.days.filter((day) => day.date !== session.date),
  ]
    .filter((day) => day.attempts > 0 || day.lowMidi !== null || day.highMidi !== null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 60);

  return normalizeProgress({
    ...normalized,
    days,
    bestLowMidi: minDefined(normalized.bestLowMidi, session.lowMidi),
    bestHighMidi: maxDefined(normalized.bestHighMidi, session.highMidi),
    bestScore: maxDefined(normalized.bestScore, bestAttempt?.score ?? null),
    bestScoreNote: bestAttempt && bestAttempt.score >= (normalized.bestScore ?? 0)
      ? bestAttempt.targetNote
      : normalized.bestScoreNote,
    highestPassedIndex: Math.max(normalized.highestPassedIndex, preferences.targetIndex),
    lastTargetIndex: preferences.targetIndex,
    lastStep: preferences.activeStep,
    lastMode: preferences.exerciseMode,
    practiceTier: preferences.practiceTier ?? normalized.practiceTier,
    comfortAnchorMidi: preferences.comfortAnchorMidi ?? normalized.comfortAnchorMidi,
    showExtendedRange: preferences.showExtendedRange ?? normalized.showExtendedRange,
    gentleDisplay: preferences.gentleDisplay ?? normalized.gentleDisplay,
    totalAttempts: days.reduce((sum, day) => sum + day.attempts, 0),
    totalPracticeDays: days.length,
  });
}

function defaultProgress() {
  return {
    version: 1,
    days: [],
    bestLowMidi: null,
    bestHighMidi: null,
    bestScore: null,
    bestScoreNote: null,
    highestPassedIndex: 0,
    lastTargetIndex: 0,
    lastStep: "warmup",
    lastMode: "comfort-ladder",
    practiceTier: "starter",
    comfortAnchorMidi: null,
    showExtendedRange: false,
    gentleDisplay: false,
    totalAttempts: 0,
    totalPracticeDays: 0,
  };
}

function normalizeProgress(progress) {
  return {
    ...defaultProgress(),
    ...progress,
    days: Array.isArray(progress.days) ? progress.days : [],
  };
}

export function mergeProgressRecords(primary, secondary) {
  const first = normalizeProgress(primary || defaultProgress());
  const second = normalizeProgress(secondary || defaultProgress());
  const daysByDate = new Map();

  [...second.days, ...first.days].forEach((day) => {
    const existing = daysByDate.get(day.date);
    daysByDate.set(day.date, mergeDay(existing, day));
  });

  const days = [...daysByDate.values()]
    .filter((day) => day?.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 60);

  const bestScoreSource = [first, second].sort((a, b) => (b.bestScore ?? -1) - (a.bestScore ?? -1))[0];

  return normalizeProgress({
    ...first,
    days,
    bestLowMidi: minDefined(first.bestLowMidi, second.bestLowMidi),
    bestHighMidi: maxDefined(first.bestHighMidi, second.bestHighMidi),
    bestScore: maxDefined(first.bestScore, second.bestScore),
    bestScoreNote: bestScoreSource.bestScoreNote,
    highestPassedIndex: Math.max(first.highestPassedIndex ?? 0, second.highestPassedIndex ?? 0),
    showExtendedRange: Boolean(first.showExtendedRange || second.showExtendedRange),
    gentleDisplay: Boolean(first.gentleDisplay || second.gentleDisplay),
    totalAttempts: days.reduce((sum, day) => sum + (day.attempts ?? 0), 0),
    totalPracticeDays: days.length,
  });
}

function mergeDay(a, b) {
  if (!a) return b;
  if (!b) return a;
  const best = (b.bestScore ?? -1) >= (a.bestScore ?? -1) ? b : a;
  return {
    date: a.date || b.date,
    lowMidi: minDefined(a.lowMidi, b.lowMidi),
    highMidi: maxDefined(a.highMidi, b.highMidi),
    attempts: Math.max(a.attempts ?? 0, b.attempts ?? 0),
    bestScore: maxDefined(a.bestScore, b.bestScore),
    bestNote: best.bestNote ?? a.bestNote ?? b.bestNote ?? null,
    minutes: Math.max(a.minutes ?? 0, b.minutes ?? 0),
  };
}

function minDefined(a, b) {
  if (a === null || a === undefined) return b ?? null;
  if (b === null || b === undefined) return a;
  return Math.min(a, b);
}

function maxDefined(a, b) {
  if (a === null || a === undefined) return b ?? null;
  if (b === null || b === undefined) return a;
  return Math.max(a, b);
}

function fallbackId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}
