import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BLOCK_TYPES, getBlockDefinition } from "../src/academy/blockRegistry.js";
import { LESSON_PLAYER_PREVIEW } from "../src/academy/content/lessonPlayerPreview.js";
import { canCompleteBlock, createLessonResumeStore } from "../src/academy/lessonProgress.js";
import { LESSON_SCHEMA_VERSION, lessonDuration, validateLesson } from "../src/academy/schema.js";

test("lesson fixture validates against the current versioned schema", () => {
  const result = validateLesson(LESSON_PLAYER_PREVIEW);
  assert.equal(LESSON_PLAYER_PREVIEW.schemaVersion, LESSON_SCHEMA_VERSION);
  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.equal(lessonDuration(LESSON_PLAYER_PREVIEW), 5);
});

test("block registry covers every supported renderer and declares media accessibility requirements", () => {
  assert.deepEqual(Object.keys(Object.fromEntries(BLOCK_TYPES.map((type) => [type, getBlockDefinition(type)]))), BLOCK_TYPES);
  assert.equal(getBlockDefinition("video").requiresCaptions, true);
  assert.equal(getBlockDefinition("audio").requiresTranscript, true);
  assert.equal(getBlockDefinition("image").requiresAlternative, true);
  assert.equal(getBlockDefinition("recording").recordingOptional, true);
});

test("schema rejects unsafe or incomplete media before a lesson can render", () => {
  const invalid = structuredClone(LESSON_PLAYER_PREVIEW);
  invalid.blocks = [{
    id: "missing-media-accessibility",
    type: "video",
    version: 1,
    metadata: {},
    durationMinutes: 1,
    completion: { kind: "manual" },
    accessibility: {},
    safety: {},
    evidenceRefs: [],
    content: { src: "video.mp4" },
  }];
  const result = validateLesson(invalid);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /transcript/);
  assert.match(result.errors.join(" "), /captions/);
});

test("completion requirements are participation-based rather than performance-scored", () => {
  assert.equal(canCompleteBlock({ completion: { kind: "manual" } }, {}), true);
  assert.equal(canCompleteBlock({ completion: { kind: "response", minLength: 3 } }, { text: "ok" }), false);
  assert.equal(canCompleteBlock({ completion: { kind: "response", minLength: 3 } }, { text: "yes" }), true);
  assert.equal(canCompleteBlock({ completion: { kind: "quiz" } }, { selectedOptionId: "a" }), true);
  assert.equal(canCompleteBlock({ completion: { kind: "activity" } }, { tried: true }), true);
});

test("resume data is local, version-scoped, and never accepted for another lesson revision", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const store = createLessonResumeStore(storage);
  const lesson = { id: "lesson-a", version: 2, blocks: [{}, {}, {}] };
  store.save(lesson, { blockIndex: 9, completedBlockIds: ["one", "one", "two"] });
  assert.deepEqual(store.load(lesson).completedBlockIds, ["one", "two"]);
  assert.equal(store.load(lesson).blockIndex, 2);
  assert.equal(store.load({ ...lesson, version: 3 }), null);
});

test("every registered block has a renderable accessible player surface", async (t) => {
  const vite = await createServer({ root: process.cwd(), logLevel: "silent", server: { middlewareMode: true } });
  t.after(() => vite.close());
  const { BlockRenderer } = await vite.ssrLoadModule("/src/academy/BlockRenderer.jsx");
  const lesson = { evidence: [{ id: "evidence", label: "Source", level: "Context", citation: "Citation", limitation: "Limit" }] };

  for (const type of BLOCK_TYPES) {
    const markup = renderToStaticMarkup(createElement(BlockRenderer, {
      lesson,
      block: previewBlock(type),
      response: {},
      paused: false,
      onResponse: () => {},
    }));
    assert.match(markup, new RegExp(`lesson-block-${type}`));
    assert.match(markup, /Preview block/);
  }
});

function previewBlock(type) {
  const contentByType = {
    text: { text: "Plain text" },
    rich_text: { nodes: [{ type: "paragraph", children: [{ type: "strong", value: "Structured text" }] }] },
    image: {},
    video: {},
    audio: {},
    reflection: { prompt: "Reflect" },
    quiz: { prompt: "Choose", options: [{ id: "choice", label: "Choice", correct: true }], explanation: "Explanation" },
    interactive_exercise: { instructions: "Try this" },
    reading: { passage: "Read this" },
    conversation_prompt: { prompt: "Say this" },
    recording: { prompt: "Recording is optional" },
    resource_download: { href: "#resource", label: "Download", description: "Resource" },
    checkpoint: { message: "Checkpoint" },
    why_this: { prompt: "Why this?" },
  };
  return {
    id: `preview-${type}`,
    type,
    version: 1,
    metadata: { title: "Preview block", label: "Preview" },
    durationMinutes: 1,
    completion: { kind: "manual" },
    accessibility: { alternative: "Alternative", transcript: "Transcript", captions: "captions.vtt" },
    safety: { note: null, stopSignals: [], lowerIntensityAlternative: null },
    evidenceRefs: ["evidence"],
    content: contentByType[type],
  };
}
