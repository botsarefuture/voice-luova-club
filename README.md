# Lilt Voice

Transfemme voice-training web app.

## Production

- Frontend: Vite/React static build in `dist/`
- Backend: Flask/Gunicorn WSGI app in `server/`
- Auth: connected OAuth provider via `flask_lac`
- Database: MongoDB progress storage
- Service: Gunicorn/Flask backend

Progress sync stores only app progress data. Audio analysis runs in the browser; raw microphone audio is not uploaded.

Training includes selectable Starter, Steady, and Deep session tiers, guided hum-to-vowel warmups, adaptive pitch matching, brightness exploration, speech transfer, and rest reminders so users do not overtrain. The pitch ladder begins from an easy detected hum (or a gentle starter note), uses small intervals, and accepts a close, steady match rather than demanding exact cents.

The product intentionally does not claim to detect resonance, vocal weight, or vocal health from microphone data. It measures pitch, pitch stability, and level locally in the browser, then presents listening prompts and safe-practice guidance for the rest.

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
