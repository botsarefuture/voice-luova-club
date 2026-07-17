import assert from "node:assert/strict";
import test from "node:test";
import { createBlankMediaAsset, createMediaLocalization, createNextMediaRevision, validateMediaAsset } from "../src/academy/mediaSchema.js";
import { resolveLessonMedia } from "../src/academy/mediaResolver.js";
import { FOUNDATIONS_LESSONS } from "../src/academy/content/foundations.js";

function publishedIllustration() {
  const asset = createBlankMediaAsset(1);
  asset.id = "voice-pathway";
  asset.title = "A simple sound pathway";
  asset.source = "/academy/voice-pathway.jpg";
  asset.byteSize = 156938;
  asset.checksum = "sha256:f6fda2493a5d8b93f7e918d5ae677efa51141c4f93a128e83cc1fbe5e1964c8f";
  asset.accessibility.alternative = "A simplified side profile shows airflow from the lungs through the throat and mouth.";
  asset.review = { decision: "approved", content_checked: true, research_checked: true, accessibility_checked: true, note: "" };
  return asset;
}

test("media drafts can be incomplete but placeholders cannot enter review", () => {
  const draft = createBlankMediaAsset(1);
  assert.equal(validateMediaAsset(draft).valid, true);
  const readiness = validateMediaAsset(draft, { publicationReady: true });
  assert.equal(readiness.valid, false);
  assert.match(readiness.errors.join(" "), /placeholder/);
});

test("review-ready media requires safe accessible alternatives", () => {
  const video = publishedIllustration();
  video.kind = "video";
  video.mimeType = "video/mp4";
  video.accessibility = { transcript: "An instructional demonstration.", captions: "javascript:alert(1)", longDescription: "" };
  let result = validateMediaAsset(video, { publicationReady: true });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /captions path/);
  video.accessibility.captions = "/academy/captions/demo-en.vtt";
  result = validateMediaAsset(video, { publicationReady: true, requireReview: true });
  assert.equal(result.valid, true, result.errors.join(" "));
});

test("teaching assets stay same-origin while attribution may link outward", () => {
  const asset = publishedIllustration();
  asset.source = "https://cdn.example.org/pathway.jpg";
  asset.rights.sourceUrl = "https://example.org/original";
  const result = validateMediaAsset(asset, { publicationReady: true });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /same-origin/);
});

test("new versions and localizations retain deterministic lineage", () => {
  const asset = publishedIllustration();
  const revision = createNextMediaRevision(asset);
  assert.equal(revision.version, 2);
  assert.deepEqual(revision.relations.replaces, { id: "voice-pathway", version: 1, locale: "en" });
  assert.equal(revision.review.decision, "pending");

  const localization = createMediaLocalization(asset, "fi");
  assert.equal(localization.locale, "fi");
  assert.deepEqual(localization.relations.localizationOf, { id: "voice-pathway", version: 1, locale: "en" });
});

test("lessons resolve the exact reviewed asset revision and keep their bundled fallback", () => {
  const lesson = FOUNDATIONS_LESSONS.find((item) => item.slug === "how-voice-learning-works");
  const original = lesson.blocks.find((block) => block.id === "voice-pathway");
  const v1 = publishedIllustration();
  v1.source = "/published/voice-pathway-v1.jpg";
  v1.accessibility.alternative = "Reviewed version one alternative.";
  const v2 = createNextMediaRevision(v1);
  v2.source = "/published/voice-pathway-v2.jpg";
  v2.review = { decision: "approved", content_checked: true, research_checked: true, accessibility_checked: true, note: "" };

  const resolved = resolveLessonMedia(lesson, { schemaVersion: 1, assets: [v1, v2] });
  const resolvedBlock = resolved.blocks.find((block) => block.id === "voice-pathway");
  assert.equal(resolvedBlock.content.src, "/published/voice-pathway-v1.jpg");
  assert.equal(resolvedBlock.accessibility.alternative, "Reviewed version one alternative.");
  assert.equal(original.content.src, "/academy/voice-pathway.jpg");

  const fallback = resolveLessonMedia(lesson, { schemaVersion: 1, assets: [v2] });
  assert.equal(fallback, lesson);
});

test("media resolution ignores the wrong kind or incomplete review", () => {
  const lesson = FOUNDATIONS_LESSONS.find((item) => item.slug === "how-voice-learning-works");
  const asset = publishedIllustration();
  asset.kind = "audio";
  assert.equal(resolveLessonMedia(lesson, { assets: [asset] }), lesson);
  asset.kind = "image";
  asset.review.accessibility_checked = false;
  assert.equal(resolveLessonMedia(lesson, { assets: [asset] }), lesson);
});
