# Launch implementation verification

Checked September 30, 2026, with Linux-native Node 24.18.0 and the installed
Next.js 16.3.1 / Prisma 7.9.1 packages. Initial checks used isolated schemas and
fictional records; smoke fixtures clean up their own records. The production
migration was later rehearsed on a separate Neon branch and applied to the
existing database after every original field passed a preservation comparison.
The production database was never reset or seeded.

## Passed

- 108 unit tests across 22 files, covering timezones/DST, reservation boundaries,
  membership isolation, redirect safety, media headers, AWS signing, provider
  adapters, marketing privacy, quotas, uncertain submissions, output retention,
  and production denial of demo helpers and simulated provider dispatch.
- TypeScript, Biome CI, diff whitespace check, and the production webpack build.
- Existing operations smoke: job/service snapshots, lifecycle, payment recording,
  stable invoices, photo upload, approved post creation and cleanup.
- Launch database smoke: two customers competing for one time, idempotent retry,
  approval, rescheduling, cancellation, stale reminder invalidation, blocked time,
  cross-business record guards and per-business invoice numbering. Extended checks
  confirm deleted catalog services retain booked prices, linked jobs cannot be
  reassigned to another customer, and owner edits/cancellation update bookings.
- Account database smoke: concurrent one-use/expired tokens, verification session
  revocation, accepted invitations, membership deactivation, password recovery,
  explicit customer history links, corrected-email invitation invalidation,
  an existing customer's new business, and persistent throttling.
- Preservation migration: representative existing customer, vehicle, job, item,
  invoice, photo, post, and user relationships survived under `suds-legacy`.
- Prisma migrate deploy applied both migrations to a separate empty verification
  schema, exercising the actual deployment command without changing the app DB.
  Prisma migrate diff reported no difference from the final schema.
- Browser checks: desktop owner and interactive marketing tasks; mobile instant
  booking, separate customer access, reschedule/cancel; owner choosing approval
  mode, mobile request, owner acceptance, and the confirmed customer view.
- Unauthenticated worker endpoint rejected; database health succeeded. A worker
  CLI tick completed with external providers unconfigured and sent no emails.
- Media migration dry run completed against the empty isolated schema. Actual
  S3 copying still requires configured storage and local source files.

## Review screenshots

These capture the actual application using fictional preview records; the
assistant and editing connections are deliberately disabled without credentials.

- [Owner dashboard](demos/launch-owner.png)
- [Interactive marketing tasks](demos/launch-marketing.png)
- [Mobile booking page](demos/launch-public-booking.png)
- [Customer appointment](demos/launch-customer-appointment.png)
- [Photo/video editing screen](demos/launch-shorts.png)
- [Connection and queue status](demos/launch-operations.png)

## Full local demo

The guided demo at `/demo` uses a separately migrated and seeded schema, with
normal owner/customer/staff logins and a local notification inbox. All owner
screens opened successfully in the browser. A simulated marketing request went
through the durable worker queue and opened the real post composer. The customer
portal showed confirmed/pending bookings and invoice history; customer access to
the owner dashboard redirected to its portal. Production requests to `/demo`,
`/demo/inbox` and `/demo/workflow` returned 404 even with demo configuration set.
See [full-demo.md](full-demo.md) for the entry point and limits.

- [Guided tour](demos/full-app-tour.png)
- [Simulated assistant in the app](demos/full-app-marketing.png)
- [Customer demo portal](demos/full-app-customer.png)

## Live connections

The private GitHub repository is connected to Vercel and the production deployment
is ready at `https://suds-hall3aducgmailcoms-projects.vercel.app`. GitHub Actions
passed all unit, type, lint, build, migration and smoke gates for commit `a8140dc`.
Sixteen owner screens opened successfully in a browser using a temporary session
that was removed afterward. Unauthenticated owner/customer pages redirected to
login, all demo routes returned 404, database health returned 200, and the worker
rejected unauthenticated calls. An authenticated worker tick returned 200 and
processed no AI jobs or email. Vercel registered the every-minute cron.

The existing Neon main branch retains all original business records. The backup
branch and separate preview/rehearsal branch are retained. The production owner
is `alex@ahall.tech`; known demo logins are disabled, and its business remains a
draft until the owner completes setup and publishes it.

Cloudflare OAuth identity and R2 activation were verified. Both private buckets,
exact-origin CORS, disabled public URLs, and one-day `pending/` lifecycle rules
were verified through the API. The production media migration dry run found 12
local photos with none missing. Actual S3 copying and browser uploads still await
bucket-scoped credentials.

Actual OpenAI/Submagic/Shotstack requests and output-host confirmation,
transactional email delivery, container deployment, and backup restoration have
not been exercised. No paid API calls, emails, or social publication occurred.
See [launch.md](launch.md) for the remaining connections before inviting users.
