# Suds launch runbook

The launch implementation is present in the repository. The existing private
GitHub repo is `pr0xiez/suds`, with `main` linked to Vercel's `suds` project under
`hall3aducgmailcoms-projects`. The production origin is
`https://suds.ahall.tech`; the `ahall.tech` zone uses Vercel DNS in the same team.

On September 30, 2026, the business-launch migration was rehearsed on Neon branch
`suds-launch-rehearsal-20260930`, including all three smoke suites and a digest
comparison of every legacy field. It was then applied to the existing `main`
branch and the same preservation comparison passed. Customers, vehicles, jobs,
payments, invoices, photo references, and posts were retained. The pre-migration
branch `suds-prelaunch-20260930` has no compute endpoint and is retained as a
recovery reference. Application previews use the separate rehearsal branch.

The production owner is `alex@ahall.tech`; the known `owner@suds.local` and
`staff@suds.local` accounts are disabled in production and preview. Owner password
setup uses an operator-issued, one-use link kept in the ignored private release
artifacts. The fictional local demo stays separate and retains its demo logins.

Production and preview database connections, public origin, pilot invitation
code, and worker secret are configured in Vercel. Standard deployment protection
keeps previews protected while the stable production domain is public. Node 24
and `iad1` align the web functions with the existing Neon region. The Pro plan
supports the every-minute cron in `vercel.json`; builds never apply migrations.

Cloudflare R2 Standard is selected for media. The authenticated Cloudflare account
is `alex@ahall.tech`; R2 is enabled and private production/preview buckets are
created with exact-origin CORS and one-day pending-upload cleanup. Bucket-scoped
S3 credentials are still needed before the app can store or serve media.
Transactional email and the paid AI providers also need credentials. Deployment
and live service checks are recorded in [verification.md](verification.md).

Start with an invite-only solo-detailer pilot; `SIGNUP_CODE` can restrict owner
signup while verified customers can still register from a booking page.

## Connections to configure

| Connection | Server configuration | Check |
| --- | --- | --- |
| Postgres/Neon | pooled DATABASE_URL, unpooled DIRECT_URL | health endpoint and migration preview |
| Public origin | PUBLIC_APP_URL, HTTPS origin without a path | verification and booking links |
| Private R2/S3 | STORAGE_DRIVER=s3, S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY | browser PUT, finalize, preview, delete |
| Transactional email | EMAIL_PROVIDER_URL, EMAIL_PROVIDER_TOKEN, EMAIL_FROM | verified sender, token email, booking receipt |
| Worker | CRON_SECRET, at least 32 random characters | authenticated scheduled tick or persistent process |
| Hosted marketing | OPENAI_API_KEY, explicit supported MARKETING_MODEL | prepare, edit, review, save campaign |
| Uploaded video edits | SUBMAGIC_API_KEY | approved clip submit, progress, durable result |
| Photo shorts | SHOTSTACK_API_KEY, SHOTSTACK_ENV | stage render first; v1 is production |

`AI_MEDIA_ALLOWED_HOSTS` adds exact approved output hostnames if a provider uses
an output host outside the built-in list. Do not use arbitrary user-provided URLs.
Run `npm run preflight`; it reports connection names, never secret values. This
checks configuration shape/presence, not credentials or provider account balances.

Choose R2 Standard storage for the pilot; see [media-storage.md](media-storage.md).
Keep the bucket private. Scope bucket credentials to this bucket. Set CORS to
the exact application origin with PUT, GET, and HEAD allowed and appropriate
Content-Type headers. Add a one-day lifecycle rule for the `pending/` prefix.
Test uploads in an actual browser: CORS and signed headers must both succeed.

## Validate before migrating existing data

Use Node 24 and `npm ci`. Run test, typecheck, lint:ci, build, smoke, smoke:launch,
and smoke:auth against a disposable database or isolated verification schema.
The database smoke scripts own and clean only their fixture records. They never
reset existing data. The GitHub workflow performs the same gates on Postgres 17.

For a credentialed local preservation check, `scripts/prepare-verification.mjs`
creates a new schema, inserts representative legacy relationships, applies both
migrations, and writes a gitignored `.env.verification.local`. Invoke smoke files
with Node's `--env-file=.env.verification.local` to use that schema; the adapter
honors it for both Prisma and raw SQL. `scripts/cleanup-verification.mjs` refuses
to drop any schema without the generated verification prefix. These helpers do
not apply a migration to the current application's schema.

Neon verification connections use DIRECT_URL for both runtime and migration,
because its pooler rejects the startup search_path needed for isolated raw SQL.

Do not run `db:seed` or `db:reset` on a shared database. The seed is explicitly
guarded and destructive. Inspect the SQL migration and take a backup before
applying `npm run db:deploy` to an existing environment.

## Web and worker deployment

The Dockerfile builds a Node 24 web image. Supply runtime secrets through the
hosting platform; `.dockerignore` excludes local envs and media. Run the same
image as a worker with command `npm run worker:loop`, or schedule an authenticated
GET/POST to `/api/internal/worker` at least once per minute. Do not run both
unless intentionally sizing concurrency; atomic claims still protect jobs.
The web process starts with `npm start` on port 3000. Use a HTTPS reverse proxy.

A Next.js host such as Vercel can serve the web app using private object storage.
For background work choose a separate persistent worker or a scheduler with
sufficient duration and frequency; heavy uploads must use the direct-upload path.
Do not depend on a function's local filesystem or a request staying alive after
its response. The worker endpoint declares a five-minute limit; host limits may
be lower and must be verified before choosing the schedule.

Apply migrations as a distinct release step with unpooled DIRECT_URL. Then start
the compatible app/worker version and verify health, signup/verification, owner
setup/publication, instant booking, approval booking, customer reschedule/cancel,
invoice isolation, an approved-media upload, and both AI paths. External API
checks may be billable; use test environments and pilot credentials deliberately.

Existing local photos are not automatically copied during a schema migration.
Keep their persistent volume and, after the schema migration, use
`npm run media:migrate` for a dry run. With private S3/R2 configured, run
`npm run media:migrate -- --apply` to copy each legacy photo to a scoped private
key, verify its complete bytes, and then change the database pointer. Originals
are retained; do not discard them until the new deployment reads every photo.
An interrupted copy can leave an unreferenced object for later cleanup.
Treat missing legacy media
as a failed migration check, not permission to delete its rows or files.

## Monitoring, backup, and rollback

Monitor `/api/health`, web/worker logs, `/settings/operations` failed queues,
oldest pending job, email delivery failures, provider usage, and R2 byte growth.
Logs deliberately exclude submitted customer data and credentials. A healthy DB
does not prove mail, editing, or storage works; check those after every release.
Terminal AI failures and UNCERTAIN submissions need review before retrying.

Enable Neon restore history suitable for the pilot and private object-storage
retention. `npm run backup` writes a custom-format pg_dump under gitignored
`.backups/` with restricted permissions and requires PostgreSQL client tools.
Move backups to a separately controlled destination and test restoring a dump
and media into a new staging database/bucket before relying on the procedure.
Google Workspace Drive can be that optional archive once an adapter is added;
no Drive connection or scheduled backup is implemented here.

Keep the previous application image and migration records. Roll back the
application only to a version compatible with the migrated schema. Do not roll
back to the old single-business app: its unscoped queries violate isolation.
On a migration incident, stop writers/workers and recover to a verified clone
or apply a forward corrective migration. Never edit an applied migration or
reset the existing database to make deployment pass.

## Pilot limits and follow-ups

The app has one scheduling resource per business and a fixed travel buffer.
Online deposits/Stripe, SMS, route optimization, multi-operator dispatch,
automatic social publication, resumable larger-video uploads, Google Drive
exports, and native mobile apps are outside this release. Marketing generation
is a bounded draft assistant; output review remains an owner action.

The unit and database gates validate logic and preservation. Paid provider
credentials, live delivery, bucket CORS, container hosting, backup restoration,
and production deployment still need their own environment checks.
