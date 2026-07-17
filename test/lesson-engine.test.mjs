import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BLOCK_TYPES, getBlockDefinition } from "../src/academy/blockRegistry.js";
import { LESSON_PLAYER_PREVIEW } from "../src/academy/content/lessonPlayerPreview.js";
import { FOUNDATIONS_LESSONS, getFoundationsLesson } from "../src/academy/content/foundations.js";
import { advanceLessonProgress, canCompleteBlock, createLessonProgress, createLessonResumeStore, moveLessonProgress } from "../src/academy/lessonProgress.js";
import { addAcademyJournalEntry, clearAcademyHistory, createAcademyHistory, loadAcademyHistory, mergeAcademyHistories, recordLessonActivity, saveAcademyHistory, summarizeAcademyHistory } from "../src/academy/learnerHistory.js";
import { LESSON_SCHEMA_VERSION, lessonDuration, validateLesson } from "../src/academy/schema.js";
import { normalizePublishedAcademyContent, staticAcademyContent } from "../src/academy/publicContent.js";

test("published Academy content replaces bundled content only when a complete catalogue is available", () => {
  const fallback = staticAcademyContent();
  assert.equal(normalizePublishedAcademyContent({ schemaVersion: 1, courses: [] }, fallback), fallback);
  const lesson = structuredClone(FOUNDATIONS_LESSONS[0]);
  const result = normalizePublishedAcademyContent({ schemaVersion: 1, courses: [{ course: { id: "foundations", slug: "foundations", title: "Published Foundations", summary: "Published", locale: "en", estimatedMinutes: 8, lessonIds: [lesson.slug] }, lessons: [lesson] }] }, fallback);
  assert.equal(result.source, "published");
  assert.equal(result.courses[0].title, "Published Foundations");
  assert.equal(result.courses[0].lessonDocuments[lesson.slug].version, 1);
});

test("Admin Academy presents structured lesson and course authoring controls before JSON escape hatches", async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  try {
    const { default: AdminAcademy } = await vite.ssrLoadModule("/src/academy/AdminAcademy.jsx");
    const html = renderToStaticMarkup(createElement(AdminAcademy, { roles: ["author"] }));
    assert.match(html, /New blank lesson/);
    assert.match(html, /New course/);
    assert.match(html, /Load Foundations course/);
    assert.match(html, /Educational media/);
    assert.doesNotMatch(html, /Lesson document/);
  } finally {
    await vite.close();
  }
});

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

test("Foundations reflections keep low-energy and uncertain answers valid", () => {
  const reflections = FOUNDATIONS_LESSONS.flatMap((lesson) => lesson.blocks.filter((block) => block.type === "reflection"));
  assert.ok(reflections.length >= 2);
  for (const reflection of reflections) {
    assert.equal(reflection.completion.minLength, 1);
    assert.equal(canCompleteBlock(reflection, { text: "?" }), true);
  }
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

test("schema rejects malformed renderer content before a lesson can crash", () => {
  const invalidRichText = structuredClone(LESSON_PLAYER_PREVIEW);
  invalidRichText.blocks = [{
    id: "broken-rich-text", type: "rich_text", version: 1, metadata: {}, durationMinutes: 1,
    completion: { kind: "manual" }, accessibility: {}, safety: {}, evidenceRefs: [], content: { nodes: "not-an-array" },
  }];
  const richTextResult = validateLesson(invalidRichText);
  assert.equal(richTextResult.valid, false);
  assert.match(richTextResult.errors.join(" "), /structured rich-text nodes array/);

  const invalidQuiz = structuredClone(LESSON_PLAYER_PREVIEW);
  invalidQuiz.blocks = [{
    id: "broken-quiz", type: "quiz", version: 1, metadata: {}, durationMinutes: 1,
    completion: { kind: "quiz" }, accessibility: {}, safety: {}, evidenceRefs: [], content: { prompt: "Choose", options: {}, explanation: "Because" },
  }];
  const quizResult = validateLesson(invalidQuiz);
  assert.equal(quizResult.valid, false);
  assert.match(quizResult.errors.join(" "), /structured options array/);
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

test("resume data keeps independent safe breakpoints for each lesson", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const store = createLessonResumeStore(storage);
  const first = { id: "lesson-one", version: 1, blocks: [{}, {}, {}] };
  const second = { id: "lesson-two", version: 1, blocks: [{}, {}] };
  store.save(first, { blockIndex: 2, completedBlockIds: ["one", "two"] });
  store.save(second, { blockIndex: 1, completedBlockIds: ["a"] });

  assert.equal(store.load(first).blockIndex, 2);
  assert.equal(store.load(second).blockIndex, 1);
  store.clear(first);
  assert.equal(store.load(first), null);
  assert.equal(store.load(second).blockIndex, 1);
});

test("saving a new lesson preserves a legacy single-lesson resume record", () => {
  const legacy = { lessonId: "lesson-one", lessonVersion: 1, blockIndex: 1, completedBlockIds: ["one"] };
  const values = new Map([["femmevoice:academy:lesson-resume", JSON.stringify(legacy)]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const store = createLessonResumeStore(storage);
  const first = { id: "lesson-one", version: 1, blocks: [{}, {}] };
  const second = { id: "lesson-two", version: 1, blocks: [{}, {}] };

  store.save(second, { blockIndex: 1, completedBlockIds: ["two"] });

  assert.equal(store.load(first).blockIndex, 1);
  assert.equal(store.load(second).blockIndex, 1);
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

test("Academy history is local, participation-based, and never stores lesson responses", () => {
  const storageValues = new Map();
  const storage = { getItem: (key) => storageValues.get(key) ?? null, setItem: (key, value) => storageValues.set(key, value), removeItem: (key) => storageValues.delete(key) };
  const lesson = { id: "lesson-a", slug: "lesson-a", version: 1, title: "A gentle lesson" };
  const progress = { totalBlocks: 3, currentBlock: 2, completedBlockIds: ["one"], completionPercentage: 33, isComplete: false };
  const recorded = recordLessonActivity(createAcademyHistory(), { courseSlug: "foundations", lesson, progress, sessionId: "session-a", activeSeconds: 45, now: "2026-07-17T10:00:00.000Z" });
  const completed = recordLessonActivity(recorded, { courseSlug: "foundations", lesson, progress: { ...progress, currentBlock: 3, completedBlockIds: ["one", "two", "three"], completionPercentage: 100, isComplete: true }, sessionId: "session-a", activeSeconds: 70, now: "2026-07-17T10:02:00.000Z" });
  const withNote = addAcademyJournalEntry(completed, { courseSlug: "foundations", lessonId: lesson.id, note: "A small win", ease: "okay", now: "2026-07-17T10:03:00.000Z" });
  const summary = summarizeAcademyHistory(withNote, "foundations", [lesson]);

  assert.equal(withNote.lessons[lesson.id].completed, true);
  assert.equal(withNote.sessions[0].activeSeconds, 70);
  assert.equal(withNote.journal[0].note, "A small win");
  assert.equal("responses" in withNote.lessons[lesson.id], false);
  assert.equal(summary.completedLessons, 1);
  assert.equal(summary.totalActiveSeconds, 70);
  assert.equal(summary.recentLessons[0].lessonId, lesson.id);

  saveAcademyHistory(withNote, storage);
  assert.deepEqual(loadAcademyHistory(storage), withNote);
  assert.deepEqual(clearAcademyHistory(storage), createAcademyHistory());
  assert.equal(storageValues.size, 0);

  saveAcademyHistory(createAcademyHistory(), storage);
  assert.equal(storageValues.size, 0);
});

test("a revised lesson does not inherit completion from an earlier version", () => {
  const completed = recordLessonActivity(createAcademyHistory(), {
    courseSlug: "foundations", lesson: { id: "lesson-a", slug: "lesson-a", version: 1, title: "Lesson" },
    progress: { totalBlocks: 1, currentBlock: 1, completedBlockIds: ["one"], completionPercentage: 100, isComplete: true }, sessionId: "first", activeSeconds: 30,
  });
  const revised = recordLessonActivity(completed, {
    courseSlug: "foundations", lesson: { id: "lesson-a", slug: "lesson-a", version: 2, title: "Lesson" },
    progress: { totalBlocks: 2, currentBlock: 1, completedBlockIds: [], completionPercentage: 0, isComplete: false }, sessionId: "second", activeSeconds: 10,
  });

  assert.equal(revised.lessons["lesson-a"].lessonVersion, 2);
  assert.equal(revised.lessons["lesson-a"].completed, false);
  assert.equal(revised.lessons["lesson-a"].completionPercentage, 0);
});

test("Academy history merge is deterministic and preserves independent sessions and notes", () => {
  const lesson = { id: "lesson-a", slug: "lesson-a", version: 1, title: "A gentle lesson" };
  const progress = { totalBlocks: 1, currentBlock: 1, completedBlockIds: ["one"], completionPercentage: 100, isComplete: true };
  const first = addAcademyJournalEntry(recordLessonActivity(createAcademyHistory(), { courseSlug: "foundations", lesson, progress, sessionId: "phone", activeSeconds: 40, now: "2026-07-17T10:00:00.000Z" }), { note: "Phone note", courseSlug: "foundations", now: "2026-07-17T10:00:00.000Z" });
  const second = addAcademyJournalEntry(recordLessonActivity(createAcademyHistory(), { courseSlug: "foundations", lesson, progress, sessionId: "laptop", activeSeconds: 60, now: "2026-07-17T11:00:00.000Z" }), { note: "Laptop note", courseSlug: "foundations", now: "2026-07-17T11:00:00.000Z" });
  const merged = mergeAcademyHistories(first, second);

  assert.equal(merged.sessions.length, 2);
  assert.equal(merged.journal.length, 2);
  assert.equal(merged.lessons[lesson.id].completed, true);
  assert.deepEqual(mergeAcademyHistories(first, second), mergeAcademyHistories(second, first));
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

test("unsafe quiz choices receive corrective, not affirmative, feedback", async (t) => {
  const vite = await createServer({ root: process.cwd(), logLevel: "silent", server: { middlewareMode: true } });
  t.after(() => vite.close());
  const { BlockRenderer } = await vite.ssrLoadModule("/src/academy/BlockRenderer.jsx");
  const markup = renderToStaticMarkup(createElement(BlockRenderer, {
    lesson: { evidence: [] },
    block: {
      ...previewBlock("quiz"),
      content: {
        prompt: "What should you do?",
        options: [{ id: "safe", label: "Pause", correct: true }, { id: "unsafe", label: "Push through", correct: false }],
        explanation: "Rest is the safer choice.",
        incorrectExplanation: "Pause instead of practising through pain.",
      },
    },
    response: { selectedOptionId: "unsafe" }, paused: false, onResponse: () => {},
  }));
  assert.match(markup, /That is not the safest next step/);
  assert.match(markup, /Pause instead of practising through pain/);
  assert.doesNotMatch(markup, /That is right/);
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
