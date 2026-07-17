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
    metadata: { programId: null, pathIds: [], unitId: null, estimatedMinutes: null, tags: [], ...(isPlainObject(base.metadata) ? base.metadata : {}) },
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
    metadata: { title: null, label: null, ...(isPlainObject(base.metadata) ? base.metadata : {}) },
    completion: { kind: "manual", ...base.completion },
    accessibility: normalizeAccessibility(base.accessibility),
    safety: normalizeSafety(base.safety),
    evidenceRefs: Array.isArray(base.evidenceRefs) ? base.evidenceRefs : [],
    content: isPlainObject(base.content) ? base.content : {},
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
  normalized.evidence.forEach((item, index) => {
    if (!isPlainObject(item) || !isNonEmptyString(item.id) || !isNonEmptyString(item.label) || !isNonEmptyString(item.level) || !isNonEmptyString(item.citation) || !isNonEmptyString(item.limitation)) {
      errors.push(`Evidence item ${index + 1} needs id, label, level, citation, and limitation text.`);
    }
  });

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
    validateBlockContent(block, errors);
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
  return { ...EMPTY_ACCESSIBILITY, ...(isPlainObject(accessibility) ? accessibility : {}) };
}

function normalizeSafety(safety) {
  return {
    ...EMPTY_SAFETY,
    ...(isPlainObject(safety) ? safety : {}),
    stopSignals: Array.isArray(safety?.stopSignals) ? safety.stopSignals : [],
  };
}

function validateBlockContent(block, errors) {
  const { content } = block;
  const error = (message) => errors.push(`Block ${block.id} ${message}.`);
  switch (block.type) {
    case "text":
    case "reflection":
    case "conversation_prompt":
    case "recording":
      if (!isNonEmptyString(content[block.type === "text" ? "text" : "prompt"])) error("needs non-empty text content");
      break;
    case "rich_text":
      if (!Array.isArray(content.nodes) || !content.nodes.length || !content.nodes.every(isValidRichTextNode)) error("needs a structured rich-text nodes array");
      break;
    case "quiz":
      if (!isNonEmptyString(content.prompt)) error("needs a non-empty prompt");
      if (!Array.isArray(content.options) || !content.options.length || !content.options.every(isValidQuizOption)) error("needs a structured options array");
      else if (content.options.filter((option) => option.correct).length !== 1) error("needs exactly one correct option");
      if (!isNonEmptyString(content.explanation)) error("needs a non-empty correct-answer explanation");
      break;
    case "interactive_exercise":
      if (!isNonEmptyString(content.instructions)) error("needs non-empty instructions");
      if (content.actionLabel !== undefined && !isNonEmptyString(content.actionLabel)) error("has an invalid action label");
      break;
    case "reading":
      if (!isNonEmptyString(content.passage)) error("needs a non-empty reading passage");
      break;
    case "resource_download":
      if (!isNonEmptyString(content.href) || !isSafeHref(content.href) || !isNonEmptyString(content.label)) error("needs a safe href and non-empty label");
      break;
    case "checkpoint":
      if (!isNonEmptyString(content.message)) error("needs a non-empty checkpoint message");
      break;
    case "image":
    case "audio":
    case "video":
      if (content.src !== undefined && !isNonEmptyString(content.src)) error("has an invalid media source");
      break;
    default:
      break;
  }
}

function isValidRichTextNode(node) {
  if (!isPlainObject(node)) return false;
  if (["paragraph", "heading"].includes(node.type)) return Array.isArray(node.children) && node.children.length > 0 && node.children.every(isValidRichTextChild);
  if (node.type === "list") return Array.isArray(node.items) && node.items.length > 0 && node.items.every((item) => Array.isArray(item) && item.length > 0 && item.every(isValidRichTextChild));
  return false;
}

function isValidRichTextChild(child) {
  if (!isPlainObject(child) || !isNonEmptyString(child.value)) return false;
  if (!["text", "strong", "emphasis", "link"].includes(child.type)) return false;
  return child.type !== "link" || isSafeHref(child.href);
}

function isValidQuizOption(option) {
  return isPlainObject(option) && isNonEmptyString(option.id) && isNonEmptyString(option.label) && typeof option.correct === "boolean";
}

function isSafeHref(value) {
  return typeof value === "string" && /^(?:https?:\/\/|\/|#)/.test(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
