# FemmeVoice Implementation Roadmap

**Status:** living implementation guide  
**Last updated:** 17 July 2026  
**Current development phase:** Milestone 5 authoring closure, ready for validation before Milestone 6 resumes

## Active Development

| Item | Current state |
| --- | --- |
| Current milestone | Milestone 5 authoring closure: blank creation and explicit revision paths |
| Current version | `v0.3.30` |
| Current working branch | `fix/academy-authoring-closure` |
| Active pull request(s) | PR #19 - Academy authoring closure; PR #18 is integrated into `main`. |
| Base branch | `main` is canonical. |
| Next planned milestone | Resume Milestone 6 - Educational Media Pipeline |
| Overall completion estimate | About 40% of the long-term Academy vision; engine, history, governance, authoring, and delivery are complete, while media, remaining curriculum, and coaching remain substantial work. |

## Vision

FemmeVoice is a research-literate, privacy-first, accessible learning platform for people exploring transfeminine voice and communication. The academy is built as a reusable educational system: supportive, transparent about evidence and limitations, and useful without demanding recordings, a perfect schedule, or a particular identity outcome.

The definitive product direction is the [Product Vision](product-vision.md). Voice-training safety and evidence boundaries are defined in the [Research and Practice Guide](research-guide.md). Future native-client decisions are recorded in the [iOS Readiness Plan](ios-readiness.md).

## Current State

- Existing guided practice, local-first pitch analysis, encrypted opt-in recordings, account sync, reminders, progress history, research guide, and feedback inbox are live.
- The existing app is a React/Vite single-page application with hash navigation. Flask/MongoDB provides accounts, progress sync, encrypted recording storage, reminders, and administrative feedback.
- Academy catalogue routing, the generic lesson player, learner history/account sync, governed authoring, role-separated publishing, and published-content delivery are complete. The four production-quality Foundations lessons were migrated and rendered through the staging publication pipeline.

## Release History

- `v0.3.7` - Academy Foundation
- `v0.3.8` - Academy routing improvements
- `v0.3.9` - Generic Lesson Engine
- `v0.3.10` - Foundations MVP: first production-quality lessons
- `v0.3.11` - Academy Polish
- `v0.3.12` - Academy integration review fixes
- `v0.3.13` - Academy integration review PR readiness
- `v0.3.14` - Academy local learner history and reflection
- `v0.3.15` - Academy learner-history PR readiness
- `v0.3.16` - Academy history opt-in sync and privacy lifecycle
- `v0.3.17` - Academy history sync PR readiness
- `v0.3.18` - Academy authoring workspace
- `v0.3.19` - Academy authoring PR readiness
- `v0.3.20` - Academy block authoring controls
- `v0.3.21` - Academy course management
- `v0.3.22` - Structured lesson authoring forms
- `v0.3.23` - Structured course authoring and ordering forms
- `v0.3.24` - Academy review and publishing workflow
- `v0.3.25` - Academy revision comparison
- `v0.3.26` - Governed Academy content delivery
- `v0.3.27` - Local Academy staging workflow
- `v0.3.28` - Milestone 5 end-to-end governance validation
- `v0.3.29` - Versioned educational media contract
- `v0.3.30` - Blank Academy authoring and immutable course/lesson revision paths

Update this list whenever a versioned change is pushed so milestones, pull requests, and releases remain easy to correlate.

## Git And Branch Strategy

FemmeVoice used stacked pull requests for the first Academy sequence because each layer depended on the previous one while still needing focused review:

```text
main <- Academy Foundation <- Lesson Engine <- Foundations MVP <- Academy Polish
```

This made each review small and preserved the reasoning behind the layer it introduced. It must not become a permanent branch hierarchy: merged child PRs alone do not make their commits reachable from `main`.

**Current integration state:** PR #5 merged the completed Academy stack into `main`. `main` is again the canonical base for future work.

**Preferred workflow going forward**

1. Branch each ordinary milestone from up-to-date `main`.
2. Keep a pull request focused on one reviewable concern.
3. Use a short stack only when the next review genuinely depends on an unmerged predecessor.
4. Create one integration PR back to `main` as soon as the reviewed stack is ready, before a third or fourth dependent milestone accumulates.
5. Rebase an in-flight dependent branch onto `main` after the integration PR lands, before opening its own PR.

This keeps history understandable without forcing unrelated work into a premature squash. Rebase is preferred for an unmerged feature branch; avoid rebasing published, reviewed commits after other contributors have started depending on them.

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
| 2026-07-17 | Keep Academy polish focused on clarity, accessibility, and truthful content. | Larger learner-history, media, and coaching changes need their own reviewable milestones. |
| 2026-07-17 | Move content operations ahead of the transparent coach. | A larger curriculum needs consistent authoring, review, and publishing before recommendations can responsibly point learners to more content. |
| 2026-07-17 | Treat the first four Foundations lessons as an MVP slice, not the complete course. | Remaining lessons will follow after learner history and content operations are established. |
| 2026-07-17 | Keep Academy learner history local and separate from legacy practice progress. | It gives learners useful reflection and deletion/export controls without silently expanding account data collection. |
| 2026-07-17 | Make structured forms the normal lesson-authoring route; retain raw lesson JSON only as an advanced escape hatch. | It makes routine editing safer and more approachable without creating a second content schema or blocking carefully reviewed low-level changes. |
| 2026-07-17 | Version courses independently and pin lesson revisions at publication. | Published course paths must remain reproducible when a lesson or the course is revised later. |

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

### Milestone 2 - Generic Lesson Engine

**Status:** ✅ Completed (100%)
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
- Translation links and revision lineage exist in the contract; authoring, translation workflow, and publishing enforcement are Milestone 5 work.

### Milestone 3 - Foundations MVP

**Status:** ✅ Completed (100%)
**Goal:** Validate the lesson engine through the first production-quality, research-literate Foundations slice before expanding the curriculum.
**Complexity:** High
**Dependencies:** Milestone 2 and content review

**Completed**
- [x] Author four opening lessons: welcome, safety/privacy, how voice learning works, and first gentle exploration.
- [x] Add per-lesson safety, evidence, accessibility, metadata, checkpoints, and completion messages.
- [x] Add a simplified pathway illustration and a labelled accessible audio placeholder.
- [x] Verify real lesson routes, resume, browser keyboard navigation, and mobile presentation.
- [x] Fix the progress-model inconsistency discovered during content validation.

**Engine/infrastructure boundary**

The generic engine is complete and has been validated with real, production-quality content. That does not mean the Foundations curriculum is complete: curriculum authoring, reviewed media, and the remaining lessons are intentionally separate content work.

**Known limitations**
- The first four lessons are the Foundations MVP, not the complete course. The remaining Foundations lessons are a future content milestone after learner history and content operations are complete.
- The audio example is an explicitly labelled placeholder with a transcript, not production instructional media.
- The generated pathway illustration is a non-diagnostic orientation aid and needs replacement only through normal content review.

### Academy Polish (Post-Milestone Review)

**Status:** ✅ Completed (100%)
**Goal:** Make the first Academy experience calmer, more accessible, and more truthful before widening the curriculum.
**Complexity:** Low
**Dependencies:** Milestone 3

**Completed**
- [x] Review the Academy through first-time, nervous-learner, ADHD, mobile-only, screen-reader, and contributor lenses.
- [x] Give lesson entry and completion intentional keyboard/screen-reader focus targets.
- [x] Expand Academy navigation and start controls to 44px touch targets.
- [x] Honor reduced-motion preferences for progress updates.
- [x] Remove a preview-only style that no longer had a live surface.
- [x] Revise safety wording so it describes routes the player actually provides.
- [x] Accept minimal reflection responses so uncertainty is not treated as non-participation.

**Acceptance criteria**
- [x] The Academy remains a single-task-at-a-time experience with a visible exit and safety route.
- [x] Lesson entry, completion, visible step state, and assistive-technology announcements stay coherent.
- [x] Mobile controls meet a 44px minimum target size.
- [x] No architecture, schema, or learner-data expansion is introduced.

## Immediate Improvements

- Complete expert content and evidence review before publishing additional Foundations lessons.
- Replace the labelled audio placeholder with a captioned, transcribed instructional example that has passed content review.
- Conduct manual VoiceOver, TalkBack, and Safari/iOS checks with real assistive-technology users before public Academy launch.

## Nice-to-have Improvements

- Offer a low-stimulation display preference beyond the system reduced-motion setting.
- Add a course-level completion moment and a clear, non-guilting next-session recommendation after learner history exists.
- Add a visible lesson-duration total that updates for optional blocks once authored content needs it.

### Milestone 4 - Learner Progress & History

**Status:** ✅ Completed
**Goal:** Help learners understand, reflect on, and continue their own Academy learning without turning history into a compliance score.
**Complexity:** High  
**Dependencies:** Milestones 2-3

**Acceptance criteria**
- [x] Complete Milestones 4A and 4B below without changing the legacy `voice-training:progress` contract.
- [x] Existing `voice-training:progress` version 1 remains readable and untouched.
- [x] Data model is generic enough for future programs, optional confidence/ease history, transparent coach rules, and privacy-preserving aggregates.

#### Milestone 4A - Local History And Reflection

**Status:** ✅ Completed
**Goal:** Give learners a private, local record of completed lessons, active learning time, recently practised lessons, a short calendar, weekly summary, and optional notes.
**Dependencies:** Milestones 2-3

**Acceptance criteria**
- [x] No broken streaks, leaderboard, gender score, forced return path, or automatic capture of lesson responses.
- [x] Activity time counts only while a lesson is visible and active.
- [x] Notes are explicitly authored by the learner and local by default.
- [x] Local export and deletion are available without an account.

**Delivered**
- [x] Versioned, bounded local history with lesson/session records, optional journal entries, normalization, and deletion.
- [x] Course-level weekly summary, local-calendar activity view, recently opened lessons, and completion context.
- [x] Export, delete, and privacy language that do not imply account sync.
- [x] Version-aware lesson completion so a revised lesson does not inherit completion from an earlier revision.

#### Milestone 4B - Opt-in Sync And Privacy Lifecycle

**Status:** ✅ Completed
**Goal:** Add account synchronization only after the local ledger is useful and reviewable.
**Dependencies:** Milestone 4A

**Acceptance criteria**
- [x] Separate versioned Academy history API and collection; no change to legacy practice sync.
- [x] Explicit enable/disable state, deterministic merge policy, account export, and deletion.
- [x] Server-side payload limits, CSRF/auth checks, and privacy tests.

**Implemented and merged**
- [x] Account-only sync setting; disabling deletes the synced account copy after confirmation while retaining local history.
- [x] Separate `academy_history` collection with a one-account record, versioned payload boundary, and no-store API responses.
- [x] Deterministic client merge for sessions, notes, and lesson revisions.
- [x] Account export/delete integration and client/server contract tests.

### Milestone 5 - Admin Academy

**Status:** ✅ Completed
**Goal:** Give authorized contributors a structured, reviewable way to create and publish Academy content.
**Complexity:** High
**Dependencies:** Milestones 2-4

**Acceptance criteria**
- [x] A contributor can create, edit, order, preview, draft, review, publish, and browse revisions for courses and lessons without editing application code.
- [x] Every supported lesson block has a purpose-built, keyboard-accessible editing route; raw document editing is an escape hatch, not the normal workflow.
- [x] Accessibility metadata, evidence references, and future-ready translation links are first-class authoring requirements.
- [x] Distinct author, reviewer, publisher, and administrator permissions are enforced.
- [x] The current Foundations course can be maintained through Admin Academy and served through the governed public catalogue.

**Definition of done**

Milestone 5 ends when a contributor can comfortably maintain the complete Foundations curriculum through the Admin Academy: course metadata and ordering, lesson metadata and ordering, every supported block, draft/review/publish workflow, revision browsing, accessibility metadata, and research references. New editor features after that point need a demonstrated authoring need; they do not extend this milestone by default.

#### Milestone 5A - Content Governance API

**Status:** ✅ Completed
**Goal:** Establish the server-side permission, validation, revision, and publish contract before creating an editor.

**Completed**
- [x] Separate Academy content collection and immutable published revisions.
- [x] Environment-configured author, reviewer, publisher, and administrator roles.
- [x] Draft, review, and publish endpoints with CSRF/auth checks.
- [x] Content, research, and accessibility checks required before publishing.

#### Milestone 5B - Accessible Admin Workspace

**Status:** ✅ Completed
**Goal:** Build a structured authoring and preview interface against the governance API, without a drag-and-drop builder.

**Dependencies:** Milestone 5A

**Delivered**
- [x] Role-gated Academy authoring route in the existing admin area.
- [x] Revision browser, draft loading/saving, validation feedback, and learner-player preview.
- [x] Real Foundations welcome lesson available as the first draft seed, proving the editor against production-quality content.

#### Milestone 5C - Block Authoring Controls

**Status:** ✅ Completed
**Goal:** Add safe, keyboard-friendly block creation and ordering around the real lesson document without creating a second editor schema.

**Dependencies:** Milestone 5B

**Delivered**
- [x] Add a supported block type with safe starter content and required accessibility placeholders.
- [x] Remove a block or move it earlier/later without drag-and-drop.
- [x] Keep the document validator and learner preview as the final authoring boundary.

#### Milestone 5D - Course Editor And Ordering

**Status:** ✅ Completed
**Goal:** Add course metadata and lesson ordering after block controls have been proven against real Foundations content.

**Dependencies:** Milestone 5C

**Delivered**
- [x] Separate, validated course draft contract with ordered unique lesson references.
- [x] Course metadata includes summary, locale, estimated minutes, tags, and future-ready prerequisites.
- [x] Admin workspace can seed and save the real Foundations course and its current lesson order.

#### Milestone 5E - Structured Lesson Forms

**Status:** ✅ Completed
**Goal:** Make normal lesson authoring possible without editing raw JSON, using the real Foundations lessons as the fixture.

**Dependencies:** Milestones 5A-5C

**Delivered in this slice**
- [x] Lesson metadata, safety, accessibility, evidence, and translation-reference forms.
- [x] Purpose-built, keyboard-accessible editing controls for every current lesson block type.
- [x] Inline block reordering and a learner-player preview continue to use the canonical lesson schema.
- [x] Raw structured documents are hidden behind an explicitly labelled advanced escape hatch.

**Validated:** All four current Foundations lessons passed the staging author, reviewer, publisher, and learner flow.

#### Milestone 5F - Structured Course Forms And Ordering

**Status:** ✅ Completed
**Goal:** Make course metadata and learner-facing lesson ordering practical to maintain without raw JSON.

**Dependencies:** Milestones 5A and 5D

**Delivered in this slice**
- [x] Structured course metadata form using the existing validated course contract.
- [x] Available lesson picker, duplicate prevention, and keyboard-accessible earlier/later/remove ordering controls.
- [x] Saved course draft browser and real Foundations course fixture.

**Validated**
- [x] The complete course-management workflow passed the isolated Foundations publication run.

#### Milestone 5G - Review And Publishing Workflow

**Status:** ✅ Completed
**Goal:** Make the governed content release path usable from Admin Academy, without weakening role separation or revision immutability.

**Dependencies:** Milestone 5A and a saved lesson draft

**Delivered in this slice**
- [x] Author-only submit-for-review transition with a private `review_requested` state.
- [x] Reviewer-only content, research, and accessibility checklist with approve/changes-requested decision and note.
- [x] Publisher-only release action after an approved review; published revisions remain immutable.
- [x] Centrally tested server-side workflow transitions rather than UI-only status handling.

**Validated:** Draft and reviewed content remained private; only published content entered the public catalogue.

#### Milestone 5H - Revision Comparison And Foundations Migration

**Status:** ✅ Completed
**Goal:** Make authored changes reviewable in context, then prove the complete Admin Academy workflow with real Foundations content.

**Dependencies:** Milestones 5E-5G

**Delivered in this slice**
- [x] Saved revision history, including state and last-updated context.
- [x] Readable comparison of lesson title, objective, duration, safety note, flow ordering, evidence count, and author change note.

**Validated:** The isolated Compose stack published four Foundations lessons and one course through separate development identities, rendered four governed lessons on desktop and 390px mobile, and rebuilt reproducibly from a new Mongo volume.

**Post-completion closure:** Blank lesson/course creation, explicit next-revision actions, versioned course records, and pinned published lesson references close gaps found by the roadmap audit. Existing unversioned course records migrate to version 1 without deleting content. A clean staging run verified author/reviewer/publisher separation, lesson v1 pinning after lesson v2 publication, course v2 publication, cache headers, mobile layout, and clean-volume reproducibility.

### Milestone 5 Retrospective

- **Accomplished:** structured course and lesson authoring, immutable revisions, role-separated review/publishing, cacheable public delivery, bundled recovery content, and isolated contributor staging.
- **Key decision:** the public catalogue includes a course only when the course and every ordered lesson are published; partial migrations remain invisible.
- **Learned:** real content exposed a client/server media-validation mismatch that fixture-only tests missed. Publishing validation must exercise both schema boundaries.
- **Technical debt:** the one-time course index migration must run before production creates a second course revision; deployment documentation includes the exact command.
- **Next:** Milestone 6 should establish reviewed audio, video, illustration, caption, transcript, localization, and replacement workflows before expanding media-heavy lessons.

### Milestone 6 - Educational Media Pipeline

**Status:** 🚧 In Progress
**Goal:** Produce and maintain reviewed, accessible educational assets without treating media as an afterthought.
**Complexity:** High
**Dependencies:** Milestone 5

**Why here:** The engine and authoring workflow must be stable before investing in a larger asset library. Content operations gives every asset a durable review, revision, and publication path.

**Acceptance criteria**
- [ ] Audio, video, illustration, caption, transcript, and localization assets have clear ownership and version linkage.
- [ ] Research, content, and accessibility review are recorded before publication.
- [ ] Assets have replacement, correction, and localization workflows rather than being embedded as one-off files.
- [ ] No production teaching media is published without its required accessible alternatives.

**In progress**
- [x] Versioned media contract covers locale, source, rights, accessibility metadata, and three-part review.
- [x] Existing Foundations voice-pathway illustration validates as the first real asset fixture.

### Milestone 7 - Remaining Foundations Lessons

**Status:** ⏳ Planned
**Goal:** Complete Foundations using the proven engine, learner-history insights, structured authoring workflow, and reviewed media pipeline.
**Complexity:** High
**Dependencies:** Milestones 4-6

**Acceptance criteria**
- [ ] Remaining approved Foundations lessons meet the same safety, evidence, accessibility, and content-review standard as the MVP slice.
- [ ] Lessons use real instructional media only when captions, transcripts, and review assets are ready.
- [ ] Learner history remains optional, supportive, and useful with the expanded course.

### Milestone 8 - Transparent Coach

**Status:** ⏳ Planned
**Goal:** Recommend a kind next existing lesson or practice opportunity with visible, overrideable rules.
**Complexity:** Medium  
**Dependencies:** Milestones 4-7

**Acceptance criteria**
- [ ] User-controlled time, path, confidence/ease, and recent-practice inputs.
- [ ] Every recommendation explains why it appeared and can be dismissed or overridden.
- [ ] Review, recovery, low-energy, and plateau paths guide users to existing content.
- [ ] No opaque AI, gender scoring, diagnosis, or punishment mechanics.

### Backlog - Interactive Practice

**Status:** ⏳ Planned
**Goal:** Add a generic, privacy-first practice engine for guided voice activities after the educational media and content foundations are stable.

The existing `interactive_exercise` block remains suitable for simple learner-led activities. A future `interactive_practice` contract should support reusable practice types, local analysis providers, accessible non-microphone routes, and supportive observations without pass/fail scoring. Microphone analysis, pitch exploration, and recording playback are intentionally outside Milestone 6.

## Technical Debt And Risks

- `src/App.jsx` owns much of the current UI and practice orchestration. New academy code must stay outside it; extracting existing practice state requires dedicated tests before it moves.
- Existing cloud sync stores a version-1 progress blob. Academy data needs separate collections and APIs rather than silently changing that contract.
- Academy history must remain a separate versioned contract. Milestone 4A establishes useful local history; Milestone 4B owns migration, retention, export, deletion, multi-device conflict handling, and explicit sync consent.
- Existing production course records require the documented one-time version-index migration before a second course revision is saved.
- Public media needs a storage/CDN strategy; do not put large course video into the existing encrypted-recording vault.
- Lesson authoring must enforce captions, transcripts, evidence, and safety metadata, or content quality will drift.
- Community features require funded human moderation and safeguarding; they are not a learner MVP dependency.
- Native iOS work depends on later API-token and audio-provider boundaries described in the iOS readiness plan.
- The static Academy has no loading state because no Academy content is fetched yet. Add loading, retry, and offline states together with the first remote-content API rather than inventing them for synchronous seed content.
- The pause control pauses lesson navigation, not embedded media. Define one consistent media-session contract before production video/audio ships.

## Roadmap Health Check

**Last reviewed:** 17 July 2026

- The Academy engine, content, and media are now explicitly separate tracks. This prevents a successful player implementation from being mistaken for a complete course or a production media library.
- Milestone 4 is split into 4A and 4B because local learner value and account-level privacy lifecycle need separate review. No further split is needed: the two parts share one history model and form one coherent milestone.
- Admin Academy now precedes media and coaching. Authoring and review are prerequisites for maintaining a growing curriculum and its assets; the coach should recommend reviewed existing material rather than inventing paths.
- Community, anonymous product analytics, and native-client work remain later concerns. They are not dependencies for a private, useful Academy history experience.
- Dependencies are intentionally conservative: the remaining Foundations curriculum depends on learner insight plus content operations and a media pipeline, not merely on more application code.

## Post-Integration Review

**Reviewed:** 17 July 2026, PR #5 automated and human review surfaces

- **Accepted:** Lesson resume records must be stored per lesson id and version. A single global entry lost an earlier lesson's safe breakpoint after another lesson opened.
- **Accepted:** Renderer-specific content needs structural validation, not only required-field presence. Malformed rich text or quiz data must fail the validation boundary rather than reach a renderer.
- **Accepted:** Incorrect safety-quiz choices must never receive an affirmative phrase. Correct and incorrect answers now have distinct feedback paths.
- **Human feedback:** None was present on PR #5.
- **Declined suggestions:** None. The review had three concrete defects, all within the scope of this focused fix.

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
- **2026-07-17:** Academy Polish pass completed. It improves focus management, mobile touch targets, reduced-motion behaviour, low-pressure reflection completion, and content accuracy without expanding the lesson engine or learner-data surface.
- **2026-07-17:** PR #5 integrated the reviewed Academy stack into `main`. Future milestones return to `main` as their canonical base; the active learner-history branch will rebase before its own PR.
- **2026-07-17:** Roadmap refinement added Active Development, release history, the Git workflow, a media pipeline milestone, and the 4A/4B privacy boundary for learner history.
- **2026-07-17:** Post-integration review fixes address per-lesson resume persistence, renderer-specific schema validation, and corrective safety-quiz feedback before Milestone 4 resumes.
- **2026-07-17:** Milestone 4A implemented local-only Academy learner history, optional reflections, local-day activity summaries, export, and deletion. It is intentionally stacked on PR #6 until the review fixes merge.
- **2026-07-17:** Milestone 4B adds opt-in account sync through a separate collection and API. Sync preserves local-first use, merges explicitly bounded learner records, and deletes the account copy when disabled.
- **2026-07-17:** PRs #6-#8 integrated the Academy review and learner-history stack into `main`. Milestone 5 now branches from the canonical base; 5A begins with a role-scoped content governance API before the admin workspace.
- **2026-07-17:** Milestone 5B adds a role-gated revision workspace that seeds, validates, saves, and previews the real Foundations welcome lesson. Course and block forms are intentionally a follow-up usability slice, not a rushed drag-and-drop editor.
- **2026-07-17:** Milestone 5C adds small block controls directly around the real Foundations lesson document. This keeps block ordering accessible and schema-backed, while course editing remains a separate focused PR.
- **2026-07-17:** Milestone 5D adds a validated course draft contract and seeds the real Foundations path through the Admin Academy. Interactive practice remains research/design work until the authoring workflow is reviewed.
- **2026-07-17:** Milestone 5E begins the normal-form authoring path. Lesson details, research evidence, safety/accessibility notes, translation references, and every existing block type are editable through structured controls; the canonical raw document remains an advanced escape hatch only.
- **2026-07-17:** Milestone 5F replaces the remaining course JSON route with structured metadata and accessible ordering controls. The editor uses the existing course validation contract and starts from the real Foundations path.
- **2026-07-17:** Milestone 5G adds a guarded author-submit, reviewer-check, publisher-release workflow. Server-side transitions reject skipped review and preserve published-revision immutability.
- **2026-07-17:** Milestone 5H adds a readable revision-comparison view rather than relying on authors to infer changes from version numbers. The remaining proof is real Foundations migration through the completed workflow.
- **2026-07-17:** The public Academy now prefers a cacheable, read-only published-content API. It excludes drafts, incomplete course paths, and unpublished lessons, and immediately falls back to bundled content when no complete published catalogue is available.
- **2026-07-17:** Added an isolated Docker Compose staging stack and guarded development-account seed command for the author, reviewer, publisher, and administrator workflow. It is the required environment for the final Milestone 5 publication demonstration.
- **2026-07-17:** Milestone 5 completed after a clean staging run proved author/reviewer/publisher permissions, draft privacy, four-lesson Foundations publication, cacheable public delivery, desktop/mobile learner rendering, bundled fallback behavior, and clean-volume reproducibility.
- **2026-07-17:** A roadmap truth audit found missing blank-authoring controls and no practical revision path for published courses. The closure patch adds blank documents, explicit next-version actions, versioned course lineage, and deterministic lesson references before Milestone 6 resumes.
