export const MEDIA_SCHEMA_VERSION = 1;
export const MEDIA_KINDS = Object.freeze(["image", "audio", "video", "document"]);

const EMPTY_REVIEW = Object.freeze({ decision: "pending", content_checked: false, research_checked: false, accessibility_checked: false, note: "" });

export function createBlankMediaAsset(now = Date.now()) {
  const id = `new-media-${now.toString(36)}`;
  return {
    schemaVersion: MEDIA_SCHEMA_VERSION,
    id,
    version: 1,
    kind: "image",
    locale: "en",
    source: "/academy/placeholder.jpg",
    title: "Untitled media asset",
    mimeType: "image/jpeg",
    byteSize: 0,
    checksum: `sha256:${"0".repeat(64)}`,
    rights: { owner: "FemmeVoice", license: "Owned project asset", attribution: "", sourceUrl: "" },
    accessibility: { alternative: "Describe what this image communicates to the learner.", transcript: "", captions: "", longDescription: "" },
    relations: {},
    review: { ...EMPTY_REVIEW },
  };
}

export function createNextMediaRevision(asset) {
  const next = structuredClone(asset);
  next.version += 1;
  next.relations = { ...next.relations, replaces: { id: asset.id, version: asset.version, locale: asset.locale } };
  next.review = { ...EMPTY_REVIEW };
  return next;
}

export function createMediaLocalization(asset, locale = "fi") {
  const next = structuredClone(asset);
  next.locale = locale;
  next.relations = { ...next.relations, localizationOf: { id: asset.id, version: asset.version, locale: asset.locale } };
  next.review = { ...EMPTY_REVIEW };
  return next;
}

export function validateMediaAsset(asset, { requireReview = false, publicationReady = false } = {}) {
  const errors = [];
  if (!asset || typeof asset !== "object") return { valid: false, errors: ["Media asset is missing."] };
  if (asset.schemaVersion !== MEDIA_SCHEMA_VERSION) errors.push("Unsupported media schema version.");
  for (const field of ["id", "locale", "source", "title", "mimeType", "checksum"]) if (!text(asset[field])) errors.push(`${field} is required.`);
  if (text(asset.source) && !safeSource(asset.source)) errors.push("Source must be a local path or HTTPS URL.");
  if (!Number.isInteger(asset.version) || asset.version < 1) errors.push("Version must be a positive integer.");
  if (!MEDIA_KINDS.includes(asset.kind)) errors.push("Choose a supported media kind.");
  if (!Number.isInteger(asset.byteSize) || asset.byteSize < 0) errors.push("Byte size must be zero or greater.");
  if (!/^sha256:[a-f0-9]{64}$/i.test(asset.checksum ?? "")) errors.push("Checksum must be a SHA-256 value.");
  if (!asset.rights || typeof asset.rights !== "object") errors.push("Rights metadata is required.");
  if (!asset.accessibility || typeof asset.accessibility !== "object") errors.push("Accessibility metadata is required.");
  if (publicationReady && (!text(asset.rights?.owner) || !text(asset.rights?.license))) errors.push("Rights owner and license are required before review.");
  if (publicationReady && asset.kind === "image" && !text(asset.accessibility?.alternative)) errors.push("Images need alternative text before review.");
  if (publicationReady && ["audio", "video"].includes(asset.kind) && !text(asset.accessibility?.transcript)) errors.push("Audio and video need a transcript before review.");
  if (publicationReady && asset.kind === "video" && !safeSource(asset.accessibility?.captions)) errors.push("Video needs a local or HTTPS captions source before review.");
  if (publicationReady && (asset.byteSize < 1 || asset.checksum === `sha256:${"0".repeat(64)}` || asset.source.includes("/placeholder."))) errors.push("Replace the placeholder with a real, checksummed asset before review.");
  if (requireReview && !["content_checked", "research_checked", "accessibility_checked"].every((key) => asset.review?.[key] === true)) errors.push("All three reviews are required.");
  return { valid: errors.length === 0, errors };
}

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function safeSource(value) {
  if (!text(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
