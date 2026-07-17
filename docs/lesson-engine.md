# Lesson Engine Architecture

The Academy lesson engine is a generic, privacy-first learning renderer. It is not a voice-analysis system and it does not make completion contingent on pitch, recording, identity, or a hidden score.

## Content Boundary

`src/academy/schema.js` is the client-side publishing boundary for the initial in-code catalogue. A lesson contains:

- a `schemaVersion`, immutable positive `version`, stable `id`, `slug`, `locale`, translation links, and optional `previousVersionId` revision lineage;
- lesson metadata, safety information, accessibility information, and a local evidence catalogue;
- ordered blocks, each with an id, type, version, metadata, duration, completion rule, accessibility, safety, evidence references, and type-specific structured content.

The schema uses safe structured rich text nodes. It deliberately does not render author-supplied HTML. Future server-side authoring must validate the same shape before a revision can be previewed or published.

## Block Registry

`src/academy/blockRegistry.js` is the single list of supported block types and their baseline requirements. `BlockRenderer.jsx` renders them. Adding a type requires all of the following:

1. Add a registry definition, including media/recording requirements.
2. Add normalization and validation where the type has new constraints.
3. Add an accessible renderer with a non-visual or non-audio alternative where relevant.
4. Add behavioural tests and a preview fixture.
5. Update this document and authoring guidance.

The current types are text, rich text, image, video, audio, reflection, quiz, interactive exercise, reading passage, conversation prompt, recording activity, resource download, checkpoint, and `Why this?` evidence panel. Lesson metadata reserves `programId`, `pathIds`, and `unitId` so future programs can use the same player without changing the lesson contract.

Media must include a transcript; video also requires captions; images require alternative text. The registry also declares renderer-required `content` fields, such as a reflection prompt or reading passage. Validation checks both presence and renderer-specific structure: rich text needs safe structured nodes, quizzes need structured options with one correct answer, and resource links must use safe hrefs. Malformed authored content therefore fails closed before it can crash a renderer. Image, audio, and video load failures show the same accessible alternative rather than leaving an empty or broken control. Recording blocks must always expose a no-recording route.

## Evidence And Safety

Blocks reference evidence by local id rather than copying claims into the UI. The `why_this` block resolves those references and presents the evidence level, citation, and limitation. Safety metadata can provide a block-specific note, stop signals, and lower-intensity alternative. Milestone 5 will enforce reviewer, review date, conflicts, and publishing workflow on the server.

## Completion And Resume

Completion rules are deliberately participation-based:

- `manual` and `optional` continue without a score;
- `response` needs the configured minimum text length;
- `quiz` requires a selected answer, not a correct answer;
- `activity` requires a person to mark an activity as tried.

`src/academy/lessonProgress.js` stores only the current safe block index and completed block ids in a per-lesson, version-scoped ledger under the separate local key `femmevoice:academy:lesson-resume`. A learner can leave one lesson, open another, and resume both independently. It never touches `voice-training:progress`, the existing account-sync contract, and records no reflection text, quiz answer, recording, microphone data, or analytics event.

`createLessonProgress(lesson, state)` is the sole projection for learner-facing progress, resume, and future analytics. It derives the current step, completed blocks, `percentage` (position including the active step), `completionPercentage` (finished blocks), and `isComplete` from one serializable state object. The visible progress bar and step label both use the position value, so “Step 3 of 5” is always 60%. Completion remains a separate, explicitly named analytic value rather than a competing UI calculation.

Milestone 4 will expand this safe-breakpoint store into a durable, exportable learner-history model. Account synchronization remains a separate explicit privacy decision and must preserve the same version boundary.

## Routing

Academy routes are `#academy`, `#academy/:courseSlug`, and `#academy/:courseSlug/:lessonSlug`. Segments are URI-encoded on creation and decoded defensively when read. The engine preview remains a test fixture; public lesson routes resolve reviewed course content rather than technical demo material.

## Accessibility

The player uses semantic headings, labelled progress, visible controls, native media controls, keyboard-operable buttons, live announcements for current state, no colour-only status, and responsive layouts. Left and right arrow navigation works when focus is not in a control; normal tab navigation remains the primary documented interaction. A future media service must provide real caption and transcript assets rather than treating those fields as decorative metadata.

## Content Revision Policy

Published content must be immutable by `id` + `version`. A material change creates a new version and keeps its previous version reference for audit and learner-resume decisions. The current static preview is an implementation fixture, and the first reviewed Foundations lessons are documented in [Foundations Course: First Four Lessons](foundations-lessons.md). Server-side draft/publish/review work is intentionally deferred to Milestone 5.
