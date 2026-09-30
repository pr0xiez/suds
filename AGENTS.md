# Suds — working notes

A multi-business web app for solo mobile detailers: owner operations, a separate
verified customer portal, public booking pages, marketing drafts, and photo/video
shorts. Read [CONTEXT.md](CONTEXT.md) for the domain and access invariants and
[docs/launch.md](docs/launch.md) before deployment.

> Next.js 16 differs from earlier versions. Read the relevant installed guide in
> `node_modules/next/dist/docs/` before routing, caching, or configuration work.
> `params`, `searchParams`, `cookies()`, and `headers()` are async;
> `proxy.ts` replaces `middleware.ts`.
>
> Prisma 7 URLs live in `prisma.config.ts`, not the datasource schema. The
> generated TypeScript client goes in `lib/generated/prisma/` (gitignored).
> Run `npm run db:generate` after a clean checkout.

## Environment

Linux-native WSL, Node 24 via nvm; never install through Windows npm. The current
Node is `$HOME/.nvm/versions/node/v24.18.0/bin/node`. No `gcc`/`make` or usable
sudo: avoid dependencies requiring node-gyp. Passwords use built-in scrypt,
image dimensions use header parsing, and seed images use a pure JS PNG encoder.
npm 11 approvals for Prisma/engines/esbuild are pinned in `allowScripts`.

`.env` is gitignored and contains live Neon credentials. Never print or commit
it. Runtime uses pooled `DATABASE_URL`; migrations use unpooled `DIRECT_URL`.
Neon project: `suds` (`autumn-flower-67361637`). A validated `schema` URL parameter
is supported for isolated verification schemas, including raw SQL search paths.
All provider and storage credentials are server-only; `.env.example` lists names.
`.vercel/` and `.backups/` are private deployment/operator artifacts, ignored by
git, lint, TypeScript, and CLI uploads. Keep their contents out of logs.

GitHub: private `pr0xiez/suds`, branch `main`. Existing Vercel project: `suds`
under `hall3aducgmailcoms-projects`, Node 24, region `iad1`. `vercel.json` schedules
the authenticated worker every minute on the existing Pro plan. Apply database
migrations separately; builds generate Prisma but never migrate or seed.

## Commands

```bash
npm ci
npm run db:generate
npm run dev
npm run demo:prepare   # new isolated schema + fictional data; never the shared DB
npm run demo           # full app at :4184/demo + simulated marketing worker
npm test
npm run typecheck
npm run lint:ci
npm run build
npm run smoke          # existing operations, fixture-only cleanup
npm run smoke:launch   # memberships, concurrent booking, approval, rescheduling
npm run smoke:auth     # tokens, invitations, customer linking, rate limits
npm run preflight     # configuration presence, no secret values
npm run worker        # one background tick
npm run worker:loop   # persistent background process
npm run backup        # pg_dump; DIRECT_URL; requires PostgreSQL tools
npm run media:migrate # dry run; -- --apply copies and verifies legacy photo bytes
npm run db:deploy     # append-only migrations, no seed
```

Full gate: `test`, `typecheck`, `lint:ci`, `build`, and all three smoke scripts.
Build uses webpack because Turbopack's CSS worker cannot bind a port in the local
sandbox. Next's supported TypeScript compiler API is selected for the installed
TypeScript 5; build-time type checking remains enabled.
`db:seed` is destructive, development-only, and requires explicit
`ALLOW_DESTRUCTIVE_DEMO_SEED=yes`. Never reset or seed an existing shared DB.
Applied migrations must never be edited, removed, or squashed. New migrations
must preserve existing IDs, jobs, payments, invoices, and photo relationships.

## Module map

- `app/(app)`: business-member shell and owner operations. Every page has its
  own `requireUser` or `requireOwner`; a layout guard does not secure navigation.
  Setup: `/onboarding`; request decisions: `/bookings`; time off: `/availability`;
  marketing: `/marketing`; media editing: `/social/shorts`;
  connection/queue status: `/settings/operations`.
- `app/b/[slug]`: published profile, services, available slots, booking.
- `app/portal`: customer-only navigation, appointments, vehicles, invoices.
- `app/signup`, `verify`, `recover`, `reset-password`, `login`: identity flows.
- `app/demo`: development-only guided tour, fictional login shortcuts, demo inbox,
  and shorts workflow preview. `lib/demo.ts` requires an explicit flag and an
  isolated `suds_demo_<12 hex>` schema; production always denies access.
- `app/actions`: thin authenticated server actions. Every exported action is
  callable independently and must authenticate itself.
- `app/api/media`: scoped upload authorization/finalization; large clips go
  directly from the browser to private storage.
- `app/api/marketing`, `ai-runs`, `video-edits`: owner-scoped persisted jobs,
  review, polling, and retained output access.
- `app/api/internal/worker`: authenticated tick; `app/api/health`: DB health.
- `lib/auth`: scrypt, hashed DB sessions, one-use account tokens, persistent
  throttling. `lib/business.ts` resolves accepted active memberships.
- `lib/ops`: domain behavior shared by actions and smoke scripts. Existing
  operations take **businessId first**. Never infer a global business.
- `lib/bookingAvailability.ts`: pure timezone/buffer math;
  `bookingSchedule.ts`: shared transaction lock/conflict check;
  `ops/bookings.ts`: instant/request/customer changes and notification events.
- `lib/media/uploads.ts`, `storage.ts`: private R2/S3 uploads and validation.
  `uploads.ts` preserves legacy local-file access for development/migration.
- `lib/ai`: marketing context/provider/quotas; `lib/workers`: leased AI dispatch;
  `lib/notifications.ts`: transactional outbox and delivery.
- `lib/readiness.ts`, `observability.ts`, `instrumentation.ts`: setup diagnostics
  and structured failure logs without customer data or secret values.
- `prisma`: append-only migrations; `scripts`: checks, worker, backup; `docs`:
  scope, deployment, storage, and the standalone interactive concept.

## Coding and behavior

Biome: single quotes, no semicolons, 100 columns. TypeScript strict and
noUncheckedIndexedAccess. Money is integer cents. Time is stored UTC and rendered
with each business timezone through `lib/dates.ts`, never the server zone.
Server action hidden redirects pass `safeBackPath`; JSON mutations check origin.

Scope reads **and** writes by businessId and validate every related ID. Customers
are tied to verified user IDs, never access granted by a typed email or phone.
`User.role` is legacy data; business permissions come only from accepted active
`BusinessMembership.role`. Do not modify a global identity or password when
changing one membership. Customer pages must select only customer-visible fields.

All scheduling mutations serialize through the same business-row transaction
lock. Pending approval requests do not reserve a time unless an explicit future
hold exists. Acceptance rechecks availability and creates one job. Cancellation,
rescheduling, and owner job edits keep linked bookings and queued notices coherent.

Job lines snapshot service name/price/duration; later catalog edits cannot rewrite
booked prices. Invoice counters and invoice uniqueness are per business. Only
whitelisted status transitions are allowed. Owner payment records remain manual.

Photos are private by default. Marketing use requires explicit owner approval;
all draft creation and worker dispatch recheck it. AI context omits customer
names, plates, private addresses, notes, and stored filenames. No assistant tool
publishes, messages customers, changes appointments, or buys ads.

Social posting is the existing review/copy/download/mark-posted queue. Video and
photo editing is separate: Submagic/Shotstack credentials, private storage, quotas,
and a worker are required. Outputs are copied to durable private storage before
being marked complete; uncertain paid submissions never auto-resubmit.

Local `data/uploads` is development-only and not safe on an ephemeral host.
Keep legacy photo files until copied and verified in private object storage.
Never make the original-media bucket public. See CONTEXT.md for detailed rules.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
