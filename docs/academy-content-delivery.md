# Governed Academy Content Delivery

`GET /api/academy/content` is the learner-facing read-only catalogue. It is cacheable and returns only courses marked `published` whose ordered lesson path is complete and consists entirely of published lesson revisions. It never returns drafts, review requests, reviewer notes, or author identities.

The React Academy renders bundled versioned content immediately, then replaces it only when this endpoint returns a complete compatible catalogue. This keeps local development, offline recovery, and a temporary content-store outage safe without making static source the primary path after publication.

Courses and lessons follow the same author, reviewer, publisher separation. An author saves and submits a draft, a reviewer completes content, research, and accessibility checks, and a publisher releases the immutable record. A course cannot be publicly visible until every lesson it orders is published.

The final Foundations migration must be performed through those identities in the Admin Academy. Automation must not silently mark educational content reviewed or published.

Milestone 5 staging validation completed that workflow with the four current Foundations lessons. The learner UI displayed the governed four-lesson course on desktop and a 390px viewport without horizontal overflow. Empty or unavailable compatible catalogues continue to resolve to the bundled recovery content.

## Immutable revisions

Lessons and courses use independent positive integer versions. Creating a revision copies the published document into the next private version; the published record remains unchanged. When a course revision is published, the server records the exact lesson slug and version for every ordered lesson. Later lesson publications therefore cannot silently change an already published course.

Existing course records from before `v0.3.30` become version 1. Before deploying code that creates a second course revision, run:

```bash
FEMMEVOICE_CONFIRM_MIGRATION=academy-course-versions-v1 MONGO_URI="..." MONGO_DB="..." python server/migrate_academy_course_versions.py
```

The migration adds version 1 to legacy records, replaces the old single-field unique index with a compound course/version index, and does not delete content.
