import assert from "node:assert/strict";
import test from "node:test";
import { createBlankMediaAsset, createMediaLocalization, createNextMediaRevision, validateMediaAsset } from "../src/academy/mediaSchema.js";

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
  assert.match(result.errors.join(" "), /captions source/);
  video.accessibility.captions = "/academy/captions/demo-en.vtt";
  result = validateMediaAsset(video, { publicationReady: true, requireReview: true });
  assert.equal(result.valid, true, result.errors.join(" "));
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
