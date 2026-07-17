import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BLOCK_TYPES, getBlockDefinition } from "../src/academy/blockRegistry.js";
import { LESSON_PLAYER_PREVIEW } from "../src/academy/content/lessonPlayerPreview.js";
import { FOUNDATIONS_LESSONS, getFoundationsLesson } from "../src/academy/content/foundations.js";
import { advanceLessonProgress, canCompleteBlock, createLessonProgress, createLessonResumeStore, moveLessonProgress } from "../src/academy/lessonProgress.js";
import { LESSON_SCHEMA_VERSION, lessonDuration, validateLesson } from "../src/academy/schema.js";

test("lesson fixture validates against the current versioned schema", () => {
  const result = validateLesson(LESSON_PLAYER_PREVIEW);
  assert.equal(LESSON_PLAYER_PREVIEW.schemaVersion, LESSON_SCHEMA_VERSION);
  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.equal(lessonDuration(LESSON_PLAYER_PREVIEW), 5);
});

test("the first Foundations lessons are complete, versioned learning documents", () => {
  assert.equal(FOUNDATIONS_LESSONS.length, 4);
  for (const lesson of FOUNDATIONS_LESSONS) {
    const result = validateLesson(lesson);
    assert.equal(result.valid, true, `${lesson.slug}: ${result.errors.join(" ")}`);
    assert.ok(lesson.metadata.completionMessage);
    assert.ok(lesson.blocks.some((block) => block.type === "checkpoint"));
  }
  assert.equal(getFoundationsLesson("welcome-to-femmevoice")?.title, "Welcome to FemmeVoice");
  assert.equal(getFoundationsLesson("not-a-lesson"), null);
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

test("schema rejects missing type-specific content before it creates a blank lesson step", () => {
  const invalid = structuredClone(LESSON_PLAYER_PREVIEW);
  invalid.blocks = [{
    id: "missing-reflection-prompt",
    type: "reflection",
    version: 1,
    metadata: {},
    durationMinutes: 1,
    completion: { kind: "response", minLength: 1 },
    accessibility: {},
    safety: {},
    evidenceRefs: [],
    content: {},
  }];
  const result = validateLesson(invalid);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /content\.prompt/);
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

test("one lesson progress model keeps first, middle, last, and completion states coherent", () => {
  const lesson = { blocks: [{ id: "one" }, { id: "two" }, { id: "three" }, { id: "four" }, { id: "five" }] };
  const first = createLessonProgress(lesson, {});
  assert.deepEqual(progressSnapshot(first), { currentBlock: 1, totalBlocks: 5, completedBlocks: 0, percentage: 20, completionPercentage: 0, isComplete: false });

  const middle = createLessonProgress(lesson, { blockIndex: 2, completedBlockIds: ["one", "two"] });
  assert.deepEqual(progressSnapshot(middle), { currentBlock: 3, totalBlocks: 5, completedBlocks: 2, percentage: 60, completionPercentage: 40, isComplete: false });

  const last = createLessonProgress(lesson, { blockIndex: 4, completedBlockIds: ["one", "two", "three", "four"] });
  assert.deepEqual(progressSnapshot(last), { currentBlock: 5, totalBlocks: 5, completedBlocks: 4, percentage: 100, completionPercentage: 80, isComplete: false });

  const complete = advanceLessonProgress(lesson, last);
  assert.deepEqual(progressSnapshot(complete), { currentBlock: 5, totalBlocks: 5, completedBlocks: 5, percentage: 100, completionPercentage: 100, isComplete: true });
});

test("optional steps, keyboard-style back navigation, and resume all reuse the same progress state", () => {
  const lesson = { id: "lesson-progress", version: 1, blocks: [{ id: "optional" }, { id: "second" }, { id: "third" }] };
  const afterOptional = advanceLessonProgress(lesson, createLessonProgress(lesson, {}));
  assert.equal(afterOptional.currentBlock, 2);
  assert.equal(afterOptional.percentage, 67);
  assert.equal(afterOptional.completedBlocks, 1);

  const afterKeyboardBack = moveLessonProgress(lesson, afterOptional, -1);
  assert.equal(afterKeyboardBack.currentBlock, 1);
  assert.equal(afterKeyboardBack.percentage, 33);
  assert.equal(afterKeyboardBack.completedBlocks, 1);

  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const store = createLessonResumeStore(storage);
  store.save(lesson, afterKeyboardBack);
  assert.deepEqual(progressSnapshot(createLessonProgress(lesson, store.load(lesson))), progressSnapshot(afterKeyboardBack));

  const completed = advanceLessonProgress(lesson, { blockIndex: 2, completedBlockIds: ["optional", "second"] });
  store.save(lesson, completed);
  assert.equal(createLessonProgress(lesson, store.load(lesson)).isComplete, true);
  assert.equal(createLessonProgress(lesson, { isComplete: true, completedBlockIds: ["optional"] }).isComplete, false);
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

function progressSnapshot(progress) {
  return {
    currentBlock: progress.currentBlock,
    totalBlocks: progress.totalBlocks,
    completedBlocks: progress.completedBlocks,
    percentage: progress.percentage,
    completionPercentage: progress.completionPercentage,
    isComplete: progress.isComplete,
  };
}
