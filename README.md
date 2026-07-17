# FemmeVoice

An open-source, transfemme-focused voice-training practice companion.

Contributions are welcome through issues and pull requests. Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md) before contributing.

The [Product Vision](docs/product-vision.md) explains the long-term learning experience and non-negotiable product principles. The evidence, safety boundaries, and feature-design principles are public in the [Research and Practice Guide](docs/research-guide.md). It is the source of truth for training-related product changes. The [Implementation Roadmap](docs/roadmap.md) records the active academy milestones, decisions, and known limitations. The [Lesson Engine Architecture](docs/lesson-engine.md) documents the versioned content contract for contributors, and [Foundations Course: First Four Lessons](docs/foundations-lessons.md) documents the first real lesson set. The [iOS Readiness Plan](docs/ios-readiness.md) documents the decisions that keep a future native app possible without a rewrite.

FemmeVoice is released under the [MIT License](LICENSE).

Transfemme voice-training web app.

## Production

- Frontend: Vite/React static build in `dist/`
- Backend: Flask/Gunicorn WSGI app in `server/`
- Auth: first-party FemmeVoice username and passphrase accounts with server-side sessions
- Database: MongoDB progress storage
- Service: Gunicorn/Flask backend
- Admin feedback inbox: server-side administrator allowlist via `FEMMEVOICE_ADMIN_USERNAMES` (comma-separated lowercase usernames); never grant admin access from the browser

Progress sync stores only app progress data. Audio analysis runs in the browser. Recordings are never uploaded by default; people can explicitly save a recording to their private vault, where it is encrypted in the browser before upload.

Training includes selectable Starter, Steady, and Deep session tiers, guided hum-to-vowel warmups, adaptive pitch matching, brightness exploration, speech transfer, and rest reminders so users do not overtrain. The pitch ladder begins from an easy detected hum (or a gentle starter note), uses small intervals, and accepts a close, steady match rather than demanding exact cents.

The Academy catalogue is available at `#academy`. Foundations currently has four short, safety-annotated lessons for newcomers, followed by a clearly marked course map for the remaining reviewed content. The generic player saves a private safe breakpoint locally; durable academy completion history is planned for a later milestone.

The product intentionally does not claim to detect resonance, vocal weight, or vocal health from microphone data. It measures pitch, pitch stability, and level locally in the browser, then presents listening prompts and safe-practice guidance for the rest.

The app stores only the selected username, a salted slow passphrase hash, and the practice progress/settings required for sync. The optional private vault includes 100 MB of encrypted recording storage; the server stores ciphertext, not playable audio. A short-term account-transfer path is available through 1 August 2026 for existing saved progress.

Feedback is optional and rate-limited. It is retained for up to one year. The admin feedback inbox exposes category, time, and message only; it does not show the submitting account identifier.

## Local

```bash
npm install
npm run dev -- --port 5178
```

## Build

```bash
npm run build
python3 -m unittest discover -s server -p 'test_*.py'
python3 -m py_compile server/app.py server/wsgi.py
```

## Versioning

Every pushed update must increase the semantic version in `package.json`; `npm run check:version` keeps it aligned with `src/version.js` and `package-lock.json`. This checkout uses the version-bump pre-push hook; enable it after cloning with `git config core.hooksPath .githooks`.
