# FemmeVoice Implementation Roadmap

**Status:** living implementation guide  
**Last updated:** 17 July 2026  
**Current development phase:** Milestone 1 - Academy Foundation, ready for review

## Vision

FemmeVoice is a research-literate, privacy-first, accessible learning platform for people exploring transfeminine voice and communication. The academy is built as a reusable educational system: supportive, transparent about evidence and limitations, and useful without demanding recordings, a perfect schedule, or a particular identity outcome.

The definitive product direction is the [Product Vision](product-vision.md). Voice-training safety and evidence boundaries are defined in the [Research and Practice Guide](research-guide.md). Future native-client decisions are recorded in the [iOS Readiness Plan](ios-readiness.md).

## Current State

- Existing guided practice, local-first pitch analysis, encrypted opt-in recordings, account sync, reminders, progress history, research guide, and feedback inbox are live.
- The existing app is a React/Vite single-page application with hash navigation. Flask/MongoDB provides accounts, progress sync, encrypted recording storage, reminders, and administrative feedback.
- Academy catalogue routing and course-overview seed content are implemented. Academy learner progress and authoring are not yet implemented.

## Architecture Decisions

| Date | Decision | Why |
| --- | --- | --- |
| 2026-07-17 | Build academy as separate client modules and server collections. | Avoid enlarging `App.jsx` or changing the stable practice-progress contract. |
| 2026-07-17 | Start with static, versioned-in-code seed content. | Validate the learner experience and schema before building author tooling. |
| 2026-07-17 | Use transparent rules for coaching. | Recommendations must be explainable, user-controlled, and not gender-score or diagnose. |
| 2026-07-17 | Keep recordings optional and encrypted. | Voice data is sensitive; academy participation must never require recording. |
| 2026-07-17 | Deliver focused pull requests per milestone slice. | Preserve a working app and make review, rollback, and contribution manageable. |

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

**Status:** 👀 Ready for Review (100%)  
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
- Completion/resume persistence is deferred to Milestone 3.
- No server schema or author interface is introduced in this milestone.

### Milestone 2 - Versioned Lesson Engine

**Status:** ⏳ Planned  
**Goal:** Render reusable, versioned learning blocks safely and accessibly.  
**Complexity:** High  
**Dependencies:** Milestone 1

**Acceptance criteria**
- [ ] Text, audio, video, reflection, interactive exercise, reading, quiz, recording, checkpoint, and resource blocks have a common schema.
- [ ] Each block supports evidence, safety, accessibility, and completion metadata.
- [ ] Media has transcript/caption requirements and graceful error states.
- [ ] Lesson state can resume at a safe block boundary.
- [ ] The engine can power a non-voice course without a code change.

### Milestone 3 - Learner Progress

**Status:** ⏳ Planned  
**Goal:** Keep academy learning state private, durable, and separate from legacy practice history.  
**Complexity:** High  
**Dependencies:** Milestone 2

**Acceptance criteria**
- [ ] Local lesson completion, resume point, activity time, reflection, and private skill ledger.
- [ ] Explicit account-sync behaviour with migration notes and tests.
- [ ] Export/deletion covers academy data.
- [ ] Existing `progress` version 1 remains readable and untouched.

### Milestone 4 - Transparent Coach

**Status:** ⏳ Planned  
**Goal:** Recommend a kind next session using visible, overrideable rules.  
**Complexity:** Medium  
**Dependencies:** Milestones 2-3

**Acceptance criteria**
- [ ] User-controlled time, path, confidence/ease, and recent-practice inputs.
- [ ] Every recommendation explains why it appeared.
- [ ] Review, recovery, low-energy, and plateau paths are available.
- [ ] No opaque AI, gender scoring, diagnosis, or punishment mechanics.

### Milestone 5 - Foundations Course

**Status:** ⏳ Planned  
**Goal:** Deliver the reviewed beginner course through the lesson engine.  
**Complexity:** High  
**Dependencies:** Milestones 2-4 and content review

**Acceptance criteria**
- [ ] Complete foundation curriculum with learning objective, warmup, practice, reflection, cooldown, homework, and safety content.
- [ ] Every recommendation and exercise claim links to evidence/limits.
- [ ] Mobile, keyboard, screen-reader, media, and privacy checks pass.
- [ ] Content review sign-off is recorded.

### Milestone 6 - Content Operations

**Status:** ⏳ Planned  
**Goal:** Let authorized contributors create, review, version, and publish academy content.  
**Complexity:** High  
**Dependencies:** Milestones 2-5

**Acceptance criteria**
- [ ] Structured course/lesson/block editing, draft/preview/publish, audit history, and rollback.
- [ ] Distinct author, reviewer, publisher, and administrator permissions.
- [ ] Citation, safety, transcript, and accessibility checks block unsafe publishing.
- [ ] Analytics include aggregate `I'm confused here` signals without exposing user identity or recordings.

## Technical Debt And Risks

- `src/App.jsx` owns much of the current UI and practice orchestration. New academy code must stay outside it; extracting existing practice state requires dedicated tests before it moves.
- Existing cloud sync stores a version-1 progress blob. Academy data needs separate collections and APIs rather than silently changing that contract.
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
