# Local Academy Staging

Run `docker compose -f docker-compose.staging.yml up --build -d`, then seed only the isolated staging database with `docker compose -f docker-compose.staging.yml exec app python server/seed_staging.py`.

Open `http://127.0.0.1:5180`. The development usernames are `academy-author`, `academy-reviewer`, `academy-publisher`, and `academy-admin`; the default passphrase is `FemmeVoice staging passphrase 2026`. Set `FEMMEVOICE_STAGING_PASSWORD` before seeding to change it.

Use the Admin Academy to load Foundations references, save every lesson and course as drafts, submit them with the author account, approve the checks with the reviewer account, then publish with the publisher account. Confirm `/api/academy/content` omits drafts and returns the complete path only after every item is published. Stop the stack and reset with `docker compose -f docker-compose.staging.yml down -v`.

The seed script refuses to run unless `FEMMEVOICE_ENV=staging`; Compose uses a separate Mongo volume and database and must never be pointed at production.
