# Suds

Suds helps a solo mobile detailer launch a business, accept customer bookings,
manage the resulting jobs, and prepare marketing from approved photos and clips.
Owners and customers have separate interfaces and permissions.

Source: private [pr0xiez/suds](https://github.com/pr0xiez/suds). Hosting uses the
existing Vercel `suds` project, Node 24, and Neon Postgres. Cloudflare R2 Standard
is the selected private media store. See [launch setup and status](docs/launch.md)
for configured services and remaining connections.

Try the full local demo with `npm run demo:prepare` followed by `npm run demo`,
then open http://localhost:4184/demo. The guided tour has fictional owner,
customer and staff logins, sample work, an email inbox, simulated marketing,
and a photo/video editing workflow preview. See [demo details](docs/full-demo.md).

## Built in this version

- Business signup, email verification, recovery, accepted staff invitations,
  and memberships. Existing shop records migrate into `suds-legacy`.
- Owner setup: services, business timezone, mobile service area, working hours,
  booking policy, and a published `/b/[slug]` booking page.
- Instant bookings by default or owner approval by business choice. Calendar
  locks protect the full duration and travel buffer against competing bookings.
- A separate `/portal` for verified customers: appointments, cancellation,
  rescheduling, vehicles, and customer-facing invoices. Existing customer history
  links only through an explicit verified invitation.
- The existing owner schedule, customer records, job progress, payments,
  printable invoices, photo library, composer, and content calendar.
- Interactive marketing tasks in `/marketing`: show a completed job, advertise
  an open appointment, or introduce the business. The hosted assistant produces
  editable drafts using business data and approved media, with saved run history.
- Photo-to-short rendering through Shotstack and uploaded video editing through
  Submagic. Private direct browser uploads and retained rendered output use
  an S3-compatible storage adapter suitable for Cloudflare R2.
- Persisted AI jobs, quotas, transactional email outbox, background worker,
  health endpoint, launch preflight, CI workflow, container recipe, and backup
  command. Provider connections stay disabled until configured.

Social publication remains manual: review, copy or download, post from your
social account, then mark posted. Online payment collection, SMS, native apps,
route optimization, and multi-operator scheduling are later work.

The [interactive concept](docs/product-preview.html) is still available with
fictional local records. It is separate from the real application described here.
See the [product scope](docs/product-plan.md), [launch runbook](docs/launch.md),
and [storage comparison](docs/media-storage.md).
The [verification record](docs/verification.md) includes screenshots of the
working application and distinguishes completed checks from live setup.

## Run locally

Use Linux-native Node 24 under WSL. No native compiler is required.

```bash
nvm use
npm ci
cp .env.example .env
# Configure DATABASE_URL and DIRECT_URL for a disposable development database.
npm run db:generate
npm run db:deploy
npm run dev
```

Open `http://localhost:3000/signup` for a new owner account. Verification links
are queued for the configured email worker; credentials are server-only.
A destructive demo seed is optional and requires
`ALLOW_DESTRUCTIVE_DEMO_SEED=yes`; never seed a shared or live database.

## Verify

```bash
npm test
npm run typecheck
npm run lint:ci
npm run build
npm run smoke
npm run smoke:launch
npm run smoke:auth
```

The database smoke scripts create only their own fixture businesses and clean
up those records. They do not reset existing data. Set the database connection
explicitly before running them.

Production setup requires private object storage, transactional email,
editing and model credentials, HTTPS, and a scheduled or persistent worker.
`npm run preflight` reports missing configuration without printing secrets.
See [AGENTS.md](AGENTS.md) and [CONTEXT.md](CONTEXT.md) before changing the app.

Stack: Next.js 16, Prisma 7/Postgres, Tailwind v4, Biome, Vitest, built-in scrypt,
header-parsed images, and HTTP provider adapters.
