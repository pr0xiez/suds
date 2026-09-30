# Launch implementation verification

Checked September 30, 2026, with Linux-native Node 24.18.0 and the installed
Next.js 16.3.1 / Prisma 7.9.1 packages. The current application database was not
reset, seeded, or migrated. Database checks used isolated schemas and fictional
records, and smoke fixtures clean up their own records.

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

R2 credentials and browser CORS, actual OpenAI/Submagic/Shotstack requests and
output host confirmation, transactional email delivery, scheduled worker hosting,
container deployment, and backup restoration were not exercised. No paid API
calls, emails, or social publication occurred. Preflight correctly reports these
connections as missing. See [launch.md](launch.md) to configure and verify them
before inviting pilot users.
