# Academy Educational Media Pipeline

Milestone 6 treats educational media as versioned teaching content, not an untracked file upload. Every asset records identity, version, locale, source, ownership and license, accessibility alternatives, and content/research/accessibility review.

Kind-specific publication requirements are enforced at the content boundary: images need alternative text; audio needs a transcript; video needs both transcript and captions. A replacement creates a new asset version so published lesson revisions remain reproducible. Localization assets link to the same conceptual asset id with their own locale and review.

The first validation fixture is the existing `public/academy/voice-pathway.jpg` illustration. Its source file, byte size, checksum, rights, alternative text, and review state are maintained as one governed metadata revision.

## Lifecycle

Media follows the same separation of duties as courses and lessons:

1. An author creates or updates a private draft.
2. Review submission validates that the source is real rather than a placeholder, the checksum and byte size are present, rights are documented, and the required accessible alternative exists.
3. A reviewer records content, research, and accessibility checks.
4. A publisher releases an approved immutable revision.
5. Learners can receive only published revisions through `GET /api/academy/media`.

Incomplete drafts are intentionally saveable. This lets an author record a useful asset before a transcript, caption file, rights confirmation, or final binary is ready, without weakening the publication boundary.

## Admin API

- `GET /api/admin/academy/media` lists revisions for Academy roles.
- `GET /api/admin/academy/media/:id/:version/:locale` loads one revision.
- `PUT /api/admin/academy/media/:id/:version/:locale` saves a private author draft.
- `PUT .../submit-review` requests review after publication-readiness validation.
- `PUT .../review` records the independent reviewer decision.
- `PUT .../publish` publishes an approved immutable revision.

The Admin Media Library provides structured fields for identity, source, checksum, rights, kind-specific accessibility, replacement lineage, and localization lineage. It does not expose raw JSON as the normal workflow.

## Public Delivery

`GET /api/academy/media` is anonymous, read-only, version-aware, and cacheable. It returns every immutable published revision and omits private review notes and identities. Retaining older published revisions is intentional: a lesson pinned to version 1 must continue resolving version 1 after version 2 is released. Drafts and unpublished revisions never enter the manifest.

The HTML application shell is served with `no-cache` so a deployment immediately discovers the new hashed frontend bundle. This does not disable public API caching: content and media manifests retain their independent cache and stale-while-revalidate policies.

Binary storage remains separate from metadata governance. Teaching files and caption tracks currently require same-origin paths, matching the app's restrictive content-security policy and avoiding third-party learner requests. External HTTPS URLs are accepted only as rights/source attribution. Educational media does not use the encrypted learner-recording vault. A later Milestone 6 slice must choose an upload/CDN strategy and an explicit origin policy before large production audio or video is accepted.

## Lesson References

Image, audio, and video blocks may include:

```json
{
  "src": "/academy/voice-pathway.jpg",
  "assetRef": { "id": "voice-pathway", "version": 1, "locale": "en" }
}
```

`assetRef` is the governed source of truth and `src` is the bundled recovery source. The learner resolver uses a manifest asset only when its id, version, locale, media kind, and three review checks all match. It also applies the governed alternative text, transcript, and captions. A missing API, missing revision, kind mismatch, or incomplete record leaves the original block unchanged rather than producing blank media.

The Admin Academy exposes all four fields without requiring JSON editing. Interactive Practice remains a separate backlog initiative.
