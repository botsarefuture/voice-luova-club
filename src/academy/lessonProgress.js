const RESUME_KEY = "femmevoice:academy:lesson-resume";

export function createLessonResumeStore(storage = globalThis.localStorage) {
  return {
    load(lesson) {
      try {
        const saved = JSON.parse(storage?.getItem(RESUME_KEY) ?? "null");
        if (saved?.lessonId !== lesson.id || saved?.lessonVersion !== lesson.version) return null;
        return sanitizeResume(saved, lesson.blocks.length);
      } catch {
        return null;
      }
    },
    save(lesson, state) {
      const resume = sanitizeResume({
        lessonId: lesson.id,
        lessonVersion: lesson.version,
        ...state,
        updatedAt: new Date().toISOString(),
      }, lesson.blocks.length);
      storage?.setItem(RESUME_KEY, JSON.stringify(resume));
      return resume;
    },
    clear(lesson) {
      const current = this.load(lesson);
      if (current) storage?.removeItem(RESUME_KEY);
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
    updatedAt: value?.updatedAt ?? null,
  };
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
