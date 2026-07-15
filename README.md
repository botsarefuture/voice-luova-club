# FemmeVoice

An open-source, transfemme-focused voice-training practice companion.

Contributions are welcome through issues and pull requests. Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md) before contributing.

FemmeVoice is released under the [MIT License](LICENSE).

Transfemme voice-training web app.

## Production

- Frontend: Vite/React static build in `dist/`
- Backend: Flask/Gunicorn WSGI app in `server/`
- Auth: first-party FemmeVoice username and passphrase accounts with server-side sessions
- Database: MongoDB progress storage
- Service: Gunicorn/Flask backend

Progress sync stores only app progress data. Audio analysis runs in the browser. Recordings are never uploaded by default; people can explicitly save a recording to their private vault, where it is encrypted in the browser before upload.

Training includes selectable Starter, Steady, and Deep session tiers, guided hum-to-vowel warmups, adaptive pitch matching, brightness exploration, speech transfer, and rest reminders so users do not overtrain. The pitch ladder begins from an easy detected hum (or a gentle starter note), uses small intervals, and accepts a close, steady match rather than demanding exact cents.

The product intentionally does not claim to detect resonance, vocal weight, or vocal health from microphone data. It measures pitch, pitch stability, and level locally in the browser, then presents listening prompts and safe-practice guidance for the rest.

The app stores only the selected username, a salted slow passphrase hash, and the practice progress/settings required for sync. The optional private vault includes 100 MB of encrypted recording storage; the server stores ciphertext, not playable audio. A short-term account-transfer path is available through 1 August 2026 for existing saved progress.

## Local

```bash
npm install
npm run dev -- --port 5178
```

## Build

```bash
npm run build
python3 -m py_compile server/app.py server/wsgi.py
```
