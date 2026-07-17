# Academy Learner History

Milestone 4A adds a local-first Academy history. It exists to help a learner remember their own learning, not to grade, rank, diagnose, or pressure them.

## What is stored

The browser stores a versioned record under `femmevoice:academy:learner-history` only after Academy activity exists. The record contains:

- lesson id, version, title, course, safe progress boundary, and completion state;
- a session id, start/last-active timestamps, and active lesson seconds;
- an optional note and optional self-chosen ease label.

It never stores quiz selections, reflection responses, microphone data, audio, pitch measurements, recordings, or a streak. Existing `voice-training:progress` remains separate and unchanged.

## Time and calendar behaviour

Active time advances only while an open lesson is unpaused and the document is visible. The course overview groups session time by the learner's local calendar day, shows the last fourteen days, and offers a gentle weekly summary. It does not create a missed-day indicator.

Lesson records are version-aware. When an author publishes a new lesson revision, the new revision does not silently inherit completion from the earlier revision. Historical session time remains part of the learner's own record.

## Privacy controls

The learner can export the local JSON record or delete it from the course overview without an account. Empty history is not persisted.

## Optional account sync

Milestone 4B adds an account-only, opt-in sync setting in Account & settings. Enabling it merges the local and account records, then saves the merged record to the account. Disabling it deletes the account copy after confirmation and leaves the local device record alone.

The server accepts only the documented learner-history fields, applies item and payload limits, requires an authenticated session plus CSRF protection for writes, and rejects hidden quiz responses, recordings, microphone data, or unknown fields. Account export includes the synced history; account deletion removes it. The Academy history API and MongoDB collection are separate from the legacy `voice-training:progress` / `progress` contract.

Merge is deterministic: independent sessions and notes are kept by id; duplicate sessions retain the highest active duration; the most recently practised same-version lesson wins while preserving completion; a newer lesson revision supersedes an earlier revision. Sync status never blocks local use.

## Contributor notes

Use `src/academy/learnerHistory.js` as the only client-side history boundary. Add only learner-visible, purpose-limited fields. New data must have a local deletion path, normalization/limits, tests, and a documented reason before it is persisted.
