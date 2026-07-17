# FemmeVoice Implementation Roadmap

**Status:** living implementation guide  
**Last updated:** 17 July 2026  
**Current development phase:** Milestone 3 - Foundations Course, ready for review

## Vision

FemmeVoice is a research-literate, privacy-first, accessible learning platform for people exploring transfeminine voice and communication. The academy is built as a reusable educational system: supportive, transparent about evidence and limitations, and useful without demanding recordings, a perfect schedule, or a particular identity outcome.

The definitive product direction is the [Product Vision](product-vision.md). Voice-training safety and evidence boundaries are defined in the [Research and Practice Guide](research-guide.md). Future native-client decisions are recorded in the [iOS Readiness Plan](ios-readiness.md).

## Current State

- Existing guided practice, local-first pitch analysis, encrypted opt-in recordings, account sync, reminders, progress history, research guide, and feedback inbox are live.
- The existing app is a React/Vite single-page application with hash navigation. Flask/MongoDB provides accounts, progress sync, encrypted recording storage, reminders, and administrative feedback.
- Academy catalogue routing, a generic versioned lesson player, and the first four Foundations lessons are implemented. Academy learner history/account sync and authoring are not yet implemented.

## Architecture Decisions

| Date | Decision | Why |
| --- | --- | --- |
| 2026-07-17 | Build academy as separate client modules and server collections. | Avoid enlarging `App.jsx` or changing the stable practice-progress contract. |
| 2026-07-17 | Start with static, versioned-in-code seed content. | Validate the learner experience and schema before building author tooling. |
| 2026-07-17 | Use transparent rules for coaching. | Recommendations must be explainable, user-controlled, and not gender-score or diagnose. |
| 2026-07-17 | Keep recordings optional and encrypted. | Voice data is sensitive; academy participation must never require recording. |
| 2026-07-17 | Deliver focused pull requests per milestone slice. | Preserve a working app and make review, rollback, and contribution manageable. |
| 2026-07-17 | Use a schema-first lesson boundary with safe structured rich text. | Keep authored HTML out of the player and give future CMS revisions one validation contract. |
| 2026-07-17 | Keep early Academy resume data in a separate, local, version-scoped key. | Prove safe-breakpoint behaviour without modifying legacy synced practice progress or collecting learner content. |
| 2026-07-17 | Ship a clearly labelled engine preview, not Foundations course material. | Validate the player while preserving the planned curriculum review and publication process. |
| 2026-07-17 | Move Foundations content validation ahead of the broad learner-history system. | Real lessons are the fastest way to prove or refine the engine; durable sync remains a separate privacy-sensitive milestone. |
| 2026-07-17 | Derive all lesson progress from `createLessonProgress`. | Keep the progress bar, step text, resume state, completion, and future analytics from drifting apart. |
| 2026-07-17 | Validate type-specific block content in the schema. | Real lesson authoring exposed that generic metadata alone cannot prevent a blank, blocked renderer. |

## Milestones

### Milestone 0 - Product Direction

**Status:** ✅ Completed  
**Goal:** Establish evidence, safety, architecture, and product constraints before implementation.  
**Complexity:** Medium  
**Dependencies:** None

**Completed**
- [x] Research and Practice Guide.
- [x] Academy/curriculum proposal.
- [x] Product Vision and evidence transparency model.
- [x] iOS readiness plan.

### Milestone 1 - Academy Foundation

**Status:** ✅ Completed
**Goal:** Make Academy a first-class, usable FemmeVoice destination without changing existing practice behaviour.  
**Complexity:** Medium  
**Dependencies:** Milestone 0

**Description**
Create hash routes, a navigation entry, a static course catalogue, course/lesson data model, and accessible placeholder course cards. Seed content remains intentionally small and clearly labelled as an early academy foundation.

**Acceptance criteria**
- [x] `#academy` is reachable by direct link and navigation.
- [x] Nested course route is resilient to an invalid slug.
- [x] Catalogue uses a documented, versioned model and includes safety/evidence metadata.
- [x] Existing views, practice, sync, account, and recordings continue to work.
- [x] Academy UI is responsive, keyboard-operable, and has no colour-only status cues.
- [x] Pure catalogue/route helpers have automated tests.
- [x] README and roadmap describe the new foundation.

**Tasks**
- [x] Review existing navigation, practice, storage, API, and product documents.
- [x] Add Academy route parsing and navigation entry.
- [x] Add `src/academy/catalog.js` and course/lesson types.
- [x] Add Academy landing and course overview components.
- [x] Add unit tests for catalogue and routing helpers.
- [x] Verify responsive desktop/mobile presentation and build.
- [x] Update roadmap, commit, open pull request, and capture limitations.

**Known limitations**
- Course content is seed content, not the complete Foundations course.
- Durable completion/resume persistence is deferred to Milestone 4.
- No server schema or author interface is introduced in this milestone.

### Milestone 2 - Versioned Lesson Engine

**Status:** 👀 Ready for Review (100%)
**Goal:** Render reusable, versioned learning blocks safely and accessibly.  
**Complexity:** High  
**Dependencies:** Milestone 1

**Acceptance criteria**
- [x] Text, rich text, image, audio, video, reflection, interactive exercise, reading, quiz, conversation, recording, checkpoint, resource, and `Why this?` blocks have a common schema.
- [x] Each block supports evidence, safety, accessibility, and completion metadata.
- [x] Media has transcript/caption requirements and graceful error states.
- [x] Lesson state can resume at a safe block boundary.
- [x] The engine can power a non-voice course without a code change.

**Completed**
- [x] Added a versioned schema, block registry, validation, and safe rich-text structure.
- [x] Added a responsive, keyboard-operable lesson player with pause, progress, completion rules, and a non-curriculum preview fixture.
- [x] Added a local-only, version-scoped safe-breakpoint adapter that does not touch existing synced practice progress.
- [x] Added a contributor architecture guide and schema/rendering/resume tests.

**Known limitations**
- The preview is intentionally not Foundations curriculum and has no voice-training exercise content.
- Resume stores only a safe block index and completion ids on this device. It does not save reflections, quiz answers, recordings, or account-synced data.
- The player exposes a recording block and no-recording route; a reusable encrypted recording-provider adapter is deferred until learner progress and content requirements are settled.
- Translation links and revision lineage exist in the contract; authoring, translation workflow, and publishing enforcement are Milestone 6 work.

### Milestone 3 - Foundations Course

**Status:** 👀 Ready for Review (100%)
**Goal:** Validate the lesson engine through a polished, research-literate opening experience before expanding the curriculum.
**Complexity:** High
**Dependencies:** Milestone 2 and content review

**Completed**
- [x] Author four opening lessons: welcome, safety/privacy, how voice learning works, and first gentle exploration.
- [x] Add per-lesson safety, evidence, accessibility, metadata, checkpoints, and completion messages.
- [x] Add a simplified pathway illustration and a labelled accessible audio placeholder.
- [x] Verify real lesson routes, resume, browser keyboard navigation, and mobile presentation.
- [x] Fix the progress-model inconsistency discovered during content validation.

**Review focus**
- [ ] Content/research review of the initial lesson wording and evidence labels.
- [ ] Review the implementation screenshots and focused pull request.

**Known limitations**
- The first four lessons validate the engine; the remaining eight Foundations lessons remain in review.
- The audio example is an explicitly labelled placeholder with a transcript, not production instructional media.
- The generated pathway illustration is a non-diagnostic orientation aid and needs replacement only through normal content review.

### Milestone 4 - Learner Progress

**Status:** ⏳ Planned  
**Goal:** Keep academy learning state private, durable, and separate from legacy practice history.  
**Complexity:** High  
**Dependencies:** Milestones 2-3

**Acceptance criteria**
- [ ] Expand the M2 safe-breakpoint adapter into durable local lesson completion, activity time, reflection, and a private skill ledger.
- [ ] Explicit account-sync behaviour with migration notes and tests.
- [ ] Export/deletion covers academy data.
- [ ] Existing `progress` version 1 remains readable and untouched.

### Milestone 5 - Transparent Coach

**Status:** ⏳ Planned  
**Goal:** Recommend a kind next session using visible, overrideable rules.  
**Complexity:** Medium  
**Dependencies:** Milestones 3-4

**Acceptance criteria**
- [ ] User-controlled time, path, confidence/ease, and recent-practice inputs.
- [ ] Every recommendation explains why it appeared.
- [ ] Review, recovery, low-energy, and plateau paths are available.
- [ ] No opaque AI, gender scoring, diagnosis, or punishment mechanics.

### Milestone 6 - Content Operations

**Status:** ⏳ Planned  
**Goal:** Let authorized contributors create, review, version, and publish academy content.  
**Complexity:** High  
**Dependencies:** Milestones 2-3

**Acceptance criteria**
- [ ] Structured course/lesson/block editing, draft/preview/publish, audit history, and rollback.
- [ ] Distinct author, reviewer, publisher, and administrator permissions.
- [ ] Citation, safety, transcript, and accessibility checks block unsafe publishing.
- [ ] Analytics include aggregate `I'm confused here` signals without exposing user identity or recordings.

## Technical Debt And Risks

- `src/App.jsx` owns much of the current UI and practice orchestration. New academy code must stay outside it; extracting existing practice state requires dedicated tests before it moves.
- Existing cloud sync stores a version-1 progress blob. Academy data needs separate collections and APIs rather than silently changing that contract.
- The lesson player uses local browser storage only. Milestone 4 must define migration, retention, export, deletion, multi-device conflict handling, and explicit sync consent before persisting richer academy state.
- Public media needs a storage/CDN strategy; do not put large course video into the existing encrypted-recording vault.
- Lesson authoring must enforce captions, transcripts, evidence, and safety metadata, or content quality will drift.
- Community features require funded human moderation and safeguarding; they are not a learner MVP dependency.
- Native iOS work depends on later API-token and audio-provider boundaries described in the iOS readiness plan.

## Future Ideas

- Finnish and English localized academy content.
- Optional context paths: work, gaming, streaming, public speaking, maintenance, and intensive practice.
- Additional programs: masculinizing voice, non-binary exploration, singing, accent work, and communication confidence.
- Carefully bounded AI assistance for author research and learner navigation, with explicit consent and human review.
- Clinical/research partnerships with separate research consent.

## Change Log

- **2026-07-17:** Roadmap created; Academy Foundation implemented and submitted for review. It adds hash routes, a versioned static catalogue, course-overview seed content, focused tests, and responsive UI. Learner progress is explicitly deferred to Milestone 3.
- **2026-07-17:** Milestone 1 self-review extended Academy routes to `#academy/:courseSlug/:lessonSlug`, with defensive decoding. The change is included in its review PR.
- **2026-07-17:** Milestone 2 implemented and submitted for review. It adds the generic versioned schema, registry, accessible lesson player, privacy-minimal safe-breakpoint preview state, developer architecture guide, and renderer/schema/resume tests. No Foundations curriculum, cloud sync, or authoring was added.
- **2026-07-17:** Milestone 1 merged to `main`. The roadmap sequence was updated to validate Foundations content before the broader learner-progress system.
- **2026-07-17:** The first four Foundations lessons were implemented using the generic engine. Content validation exposed a mixed progress calculation; `createLessonProgress` now provides the single source of truth for visible progress, completion, resume, and future analytics.
- **2026-07-17:** Real lesson authoring exposed missing type-specific content validation. The schema now rejects incomplete renderer content, preventing blank, blocked lesson steps.
