const RESUME_KEY = "femmevoice:academy:lesson-resume";
const RESUME_STORE_VERSION = 2;

export function createLessonResumeStore(storage = globalThis.localStorage) {
  return {
    load(lesson) {
      return loadResume(storage, lesson);
    },
    save(lesson, state) {
      const resume = sanitizeResume({
        lessonId: lesson.id,
        lessonVersion: lesson.version,
        ...state,
        updatedAt: new Date().toISOString(),
      }, lesson.blocks.length);
      const ledger = loadResumeLedger(storage);
      ledger.lessons[lessonResumeKey(lesson)] = resume;
      storage?.setItem(RESUME_KEY, JSON.stringify(ledger));
      return resume;
    },
    clear(lesson) {
      const ledger = loadResumeLedger(storage);
      delete ledger.lessons[lessonResumeKey(lesson)];
      if (Object.keys(ledger.lessons).length) storage?.setItem(RESUME_KEY, JSON.stringify(ledger));
      else storage?.removeItem(RESUME_KEY);
    },
  };
}

export function sanitizeResume(value, blockCount) {
  const safeIndex = Math.min(Math.max(0, Number.isInteger(value?.blockIndex) ? value.blockIndex : 0), Math.max(0, blockCount - 1));
  const completedBlockIds = Array.isArray(value?.completedBlockIds) ? [...new Set(value.completedBlockIds)] : [];
  return {
    lessonId: value?.lessonId ?? null,
    lessonVersion: value?.lessonVersion ?? null,
    blockIndex: safeIndex,
    completedBlockIds,
    isComplete: value?.isComplete === true,
    updatedAt: value?.updatedAt ?? null,
  };
}

/**
 * The sole projection used by lesson UI, resume state, and future analytics.
 * Position includes the active block so "3 of 5" and the progress bar both
 * describe the same place in a lesson. Completion remains available for
 * analytics without being confused with the visible lesson position.
 */
export function createLessonProgress(lesson, state = {}) {
  const totalBlocks = lesson.blocks.length;
  const blockIds = new Set(lesson.blocks.map((block) => block.id));
  const completedBlockIds = [...new Set(state.completedBlockIds ?? [])].filter((id) => blockIds.has(id));
  const isComplete = state.isComplete === true && totalBlocks > 0 && completedBlockIds.length === totalBlocks;
  const blockIndex = totalBlocks
    ? Math.min(Math.max(0, Number.isInteger(state.blockIndex) ? state.blockIndex : 0), totalBlocks - 1)
    : 0;
  const currentBlock = totalBlocks ? (isComplete ? totalBlocks : blockIndex + 1) : 0;
  const positionPercentage = totalBlocks ? (isComplete ? 100 : Math.round((currentBlock / totalBlocks) * 100)) : 0;
  const completionPercentage = totalBlocks ? (isComplete ? 100 : Math.round((completedBlockIds.length / totalBlocks) * 100)) : 0;

  return {
    blockIndex,
    currentBlock,
    totalBlocks,
    completedBlockIds,
    completedBlocks: isComplete ? totalBlocks : completedBlockIds.length,
    isComplete,
    percentage: positionPercentage,
    completionPercentage,
  };
}

export function advanceLessonProgress(lesson, state) {
  const progress = createLessonProgress(lesson, state);
  if (!progress.totalBlocks || progress.isComplete) return progress;
  const currentId = lesson.blocks[progress.blockIndex].id;
  const completedBlockIds = progress.completedBlockIds.includes(currentId)
    ? progress.completedBlockIds
    : [...progress.completedBlockIds, currentId];

  if (progress.blockIndex === progress.totalBlocks - 1) {
    return createLessonProgress(lesson, { ...progress, completedBlockIds, isComplete: true });
  }
  return createLessonProgress(lesson, { ...progress, completedBlockIds, blockIndex: progress.blockIndex + 1 });
}

export function moveLessonProgress(lesson, state, direction) {
  const progress = createLessonProgress(lesson, state);
  if (progress.isComplete) return progress;
  return createLessonProgress(lesson, { ...progress, blockIndex: progress.blockIndex + direction });
}

export function canCompleteBlock(block, response) {
  switch (block.completion.kind) {
    case "optional":
    case "manual":
      return true;
    case "activity":
      return response?.tried === true;
    case "quiz":
      return response?.selectedOptionId != null;
    case "response":
      return String(response?.text ?? "").trim().length >= (block.completion.minLength ?? 1);
    default:
      return false;
  }
}

function loadResume(storage, lesson) {
  try {
    const saved = JSON.parse(storage?.getItem(RESUME_KEY) ?? "null");
    const stored = saved?.version === RESUME_STORE_VERSION ? saved.lessons?.[lessonResumeKey(lesson)] : saved;
    if (stored?.lessonId !== lesson.id || stored?.lessonVersion !== lesson.version) return null;
    return sanitizeResume(stored, lesson.blocks.length);
  } catch {
    return null;
  }
}

function loadResumeLedger(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(RESUME_KEY) ?? "null");
    if (saved?.version === RESUME_STORE_VERSION && saved.lessons && typeof saved.lessons === "object" && !Array.isArray(saved.lessons)) {
      return { version: RESUME_STORE_VERSION, lessons: { ...saved.lessons } };
    }
    if (saved?.lessonId && saved?.lessonVersion) {
      return {
        version: RESUME_STORE_VERSION,
        lessons: { [`${saved.lessonId}:${saved.lessonVersion}`]: saved },
      };
    }
  } catch {
    // A malformed local value should never prevent a person from resuming new lessons.
  }
  return { version: RESUME_STORE_VERSION, lessons: {} };
}

function lessonResumeKey(lesson) {
  return `${lesson.id}:${lesson.version}`;
}
