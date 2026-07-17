import { BLOCK_TYPES, getBlockDefinition } from "./blockRegistry.js";

export const LESSON_SCHEMA_VERSION = 1;
export { BLOCK_TYPES } from "./blockRegistry.js";

export const COMPLETION_KINDS = Object.freeze(["manual", "optional", "response", "quiz", "activity"]);

const EMPTY_ACCESSIBILITY = Object.freeze({
  alternative: null,
  transcript: null,
  captions: null,
  reducedMotionAlternative: null,
});

const EMPTY_SAFETY = Object.freeze({
  note: null,
  stopSignals: [],
  lowerIntensityAlternative: null,
});

/**
 * Normalizes authored learning data at the rendering boundary. The current
 * in-code catalogue is intentionally strict so later CMS imports can use the
 * same validator before a revision is published.
 */
export function normalizeLesson(lesson) {
  const base = {
    schemaVersion: LESSON_SCHEMA_VERSION,
    version: 1,
    locale: "en",
    translations: [],
    previousVersionId: null,
    metadata: {},
    evidence: [],
    safety: EMPTY_SAFETY,
    accessibility: EMPTY_ACCESSIBILITY,
    blocks: [],
    ...lesson,
  };

  return {
    ...base,
    metadata: { programId: null, pathIds: [], unitId: null, estimatedMinutes: null, tags: [], ...base.metadata },
    translations: Array.isArray(base.translations) ? base.translations : [],
    evidence: Array.isArray(base.evidence) ? base.evidence : [],
    safety: normalizeSafety(base.safety),
    accessibility: normalizeAccessibility(base.accessibility),
    blocks: Array.isArray(base.blocks) ? base.blocks.map((block, index) => normalizeBlock(block, index)) : [],
  };
}

export function normalizeBlock(block, index = 0) {
  const base = {
    id: `block-${index + 1}`,
    version: 1,
    metadata: {},
    durationMinutes: 0,
    completion: { kind: "manual" },
    accessibility: EMPTY_ACCESSIBILITY,
    safety: EMPTY_SAFETY,
    evidenceRefs: [],
    content: {},
    ...block,
  };

  return {
    ...base,
    metadata: { title: null, label: null, ...base.metadata },
    completion: { kind: "manual", ...base.completion },
    accessibility: normalizeAccessibility(base.accessibility),
    safety: normalizeSafety(base.safety),
    evidenceRefs: Array.isArray(base.evidenceRefs) ? base.evidenceRefs : [],
    content: base.content ?? {},
  };
}

export function validateLesson(lesson) {
  const normalized = normalizeLesson(lesson);
  const errors = [];

  if (normalized.schemaVersion !== LESSON_SCHEMA_VERSION) errors.push("Unsupported lesson schema version.");
  if (!normalized.id) errors.push("Lesson id is required.");
  if (!normalized.slug) errors.push("Lesson slug is required.");
  if (!normalized.title) errors.push("Lesson title is required.");
  if (!Number.isInteger(normalized.version) || normalized.version < 1) errors.push("Lesson version must be a positive integer.");

  const evidenceIds = new Set(normalized.evidence.map((item) => item.id));
  const blockIds = new Set();
  normalized.blocks.forEach((block) => {
    const definition = getBlockDefinition(block.type);
    if (!definition) errors.push(`Unsupported block type: ${block.type || "missing"}.`);
    if (blockIds.has(block.id)) errors.push(`Duplicate block id: ${block.id}.`);
    blockIds.add(block.id);
    if (!Number.isInteger(block.version) || block.version < 1) errors.push(`Block ${block.id} needs a positive integer version.`);
    if (!COMPLETION_KINDS.includes(block.completion.kind)) errors.push(`Block ${block.id} has an unsupported completion kind.`);
    definition?.requiredContent?.forEach((field) => {
      const value = block.content[field];
      if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
        errors.push(`Block ${block.id} needs content.${field}.`);
      }
    });
    block.evidenceRefs.forEach((reference) => {
      if (!evidenceIds.has(reference)) errors.push(`Block ${block.id} references unknown evidence ${reference}.`);
    });
    if (definition?.requiresTranscript && !block.accessibility.transcript) {
      errors.push(`Media block ${block.id} needs a transcript.`);
    }
    if (definition?.requiresCaptions && !block.accessibility.captions) {
      errors.push(`Video block ${block.id} needs captions.`);
    }
    if (definition?.requiresAlternative && !block.accessibility.alternative) {
      errors.push(`Image block ${block.id} needs alternative text.`);
    }
  });

  return { valid: errors.length === 0, errors, lesson: normalized };
}

export function lessonDuration(lesson) {
  const normalized = normalizeLesson(lesson);
  return normalized.metadata.estimatedMinutes
    ?? normalized.blocks.reduce((total, block) => total + Math.max(0, Number(block.durationMinutes) || 0), 0);
}

function normalizeAccessibility(accessibility) {
  return { ...EMPTY_ACCESSIBILITY, ...(accessibility ?? {}) };
}

function normalizeSafety(safety) {
  return {
    ...EMPTY_SAFETY,
    ...(safety ?? {}),
    stopSignals: Array.isArray(safety?.stopSignals) ? safety.stopSignals : [],
  };
}
