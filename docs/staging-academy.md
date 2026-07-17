# Local Academy Staging

Run `docker compose -f docker-compose.staging.yml up --build -d`, then seed only the isolated staging database with `docker compose -f docker-compose.staging.yml exec app python server/seed_staging.py`.

Open `http://127.0.0.1:5180`. The development usernames are `academy-author`, `academy-reviewer`, `academy-publisher`, and `academy-admin`; the default passphrase is `FemmeVoice staging passphrase 2026`. Set `FEMMEVOICE_STAGING_PASSWORD` before seeding to change it.

Use the Admin Academy to load Foundations references, save every lesson and course as drafts, submit them with the author account, approve the checks with the reviewer account, then publish with the publisher account. Confirm `/api/academy/content` omits drafts and returns the complete path only after every item is published. Stop the stack and reset with `docker compose -f docker-compose.staging.yml down -v`.

The seed script refuses to run unless `FEMMEVOICE_ENV=staging`; Compose uses a separate Mongo volume and database and must never be pointed at production.

The local Compose profile explicitly disables the cookie `Secure` attribute because it is served over loopback HTTP. Production defaults to secure cookies and must not reuse this override.

The Milestone 5 validation used separate author, reviewer, and publisher sessions. Draft and approved-but-unpublished records returned an empty public catalogue. After all four Foundations lessons and the course were published, the catalogue returned one course with four lessons and `Cache-Control: public, max-age=60, stale-while-revalidate=300`. A clean `down -v` and restart recreated an empty isolated database and the accounts seeded successfully again.

Milestone 6 media validation uses the same identities in the **Educational media** section. Save a private asset draft as the author, submit it only after its source, checksum, rights, and accessible alternative are complete, approve all three review areas as the reviewer, and publish as the publisher. `GET /api/academy/media` must remain empty before publication and return the published revision with `Cache-Control: public, max-age=300, stale-while-revalidate=3600` afterward. Published media fields are read-only; replacements and localizations begin as new private revisions.
