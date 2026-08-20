# suds — working notes

Job management + social-media management for a car detailing shop, in one app.
The two halves feed each other: jobs collect before/after photos, and the social
side turns those photos into a posting queue with captions and a content
calendar. Single business, no tenancy; a handful of users.

> **Next.js 16 is not the Next.js in your training data.** Read the relevant
> guide under `node_modules/next/dist/docs/` before writing routing, metadata,
> or caching code. `middleware.ts` is now `proxy.ts` (this app uses neither);
> `params`, `searchParams`, `cookies()`, and `headers()` are all async.
>
> **Prisma 7 is not Prisma 5.** Connection URLs live in `prisma.config.ts`, not
> in `schema.prisma` — `url` in a datasource block is a hard error. The client
> is generated as TypeScript into `lib/generated/prisma/` (gitignored, so
> `npm run db:generate` after a clean clone).

## Environment — read this first

Runs **Linux-native under WSL** on Node 24 via nvm (`.nvmrc`), like the other
new projects here (tradecms, sixth-pick) and unlike the older trees that carry
Windows `node_modules`. Never install through Windows npm.

```bash
nvm use                # or: export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
npm install
cp .env.example .env   # fill in the Neon URLs below
npm run db:generate
npm run db:migrate     # applies migrations, then seeds via prisma.config.ts
npm run dev
```

**Assume no compiler.** `gcc`/`make` are absent and `sudo` needs a password, so
node-gyp is unavailable. That is why auth uses Node's built-in **scrypt** (not
bcrypt), image dimensions are parsed **by hand from file headers** (not sharp),
and the seed's placeholder photos come from a **hand-rolled PNG encoder**
(`lib/png.ts`). A dependency that needs to compile is a dependency that doesn't
work here.

**npm 11 blocks install scripts.** The approvals are committed in `package.json`
under `allowScripts` (prisma, @prisma/engines, esbuild). If you add a dependency
with an install script: `npm approve-scripts <pkg> && npm rebuild <pkg>`, and
commit the updated map. The keys pin exact versions, so a version bump of those
packages needs the map updated too.

### `.env`

Gitignored; holds live Neon credentials — never print or commit it.

- `DATABASE_URL` — **pooled** Neon connection for the app runtime.
  Neon project `suds` (`autumn-flower-67361637`), branch `main`.
- `DIRECT_URL` — the same host minus the `-pooler` suffix, for migrations.
  Neon's pooler cannot hold the advisory locks `prisma migrate` needs.
- `SEED_OWNER_PASSWORD` — what the seed gives `owner@suds.local`; empty falls
  back to a printed dev default. Set it before seeding anything shared.

## Commands

```bash
npm run dev            # next dev
npm run build          # prisma generate && next build
npm run typecheck      # tsc --noEmit
npm run lint           # biome check .      (lint:ci must pass before a commit)
npm test               # vitest run — pure-logic units, no DB
npm run smoke          # tsx scripts/smoke.ts — ops E2E against the real DB,
                       #   creates and removes its own records; safe on dev data

npm run db:migrate     # prisma migrate dev   (append-only — never edit applied)
npm run db:seed        # wipes EVERYTHING (rows + photo files) and rebuilds demo
npm run db:studio
```

The full gate before calling work done: `test`, `typecheck`, `lint:ci`,
`build`, `smoke`.

Seeded logins: `owner@suds.local` / `staff@suds.local`, password
`$SEED_OWNER_PASSWORD` or the printed default.

## Layout

```
app/
  (app)/                 authenticated shell (sidebar) — every page ALSO calls
                         requireUser() itself; see Gotchas
    dashboard/           stat tiles, today's jobs, social queue, needs-attention
    schedule/            week calendar; overlap lanes from lib/calendar.ts
    jobs/                list, new/edit (JobForm), detail, printable invoice
    customers/           list, new, detail (vehicles inline, job history)
    social/              month content calendar + queue, composer (PostComposer)
    library/             every photo, filterable, standalone uploads
    settings/            business, services catalog, caption templates, users
  login/                 public sign-in page
  actions/               server actions — thin: requireUser → parse → op →
                         revalidatePath('/', 'layout') → redirect
  api/login, api/logout  form-post route handlers (curl-testable auth)
  api/photos/[id]        auth-gated photo bytes from disk
  api/jobs/[id]/photos   multipart upload onto a job
  api/library/upload     multipart upload, no job

lib/
  ops/                   the domain layer — actions and scripts/smoke.ts both
                         drive these; put behavior here, not in actions
  db/client.ts           Prisma singleton (PrismaPg driver adapter)
  generated/prisma/      generated client — gitignored, never edit
  auth/                  scrypt passwords, DB-token sessions, login rate limit
  dates.ts               ALL timezone logic; see Conventions
  calendar.ts            week-grid lane math (pure, tested)
  captions.ts            {{token}} templates, deterministic caption suggestions
  images.ts              magic-byte sniffing + header-parsed dimensions
  uploads.ts             data/uploads/ file IO behind a path-safety regex
  png.ts                 minimal PNG encoder (seed images, tests)
  money.ts, forms.ts, http.ts, socialLinks.ts

prisma/                  schema, migrations (append-only), seed + seedImages
scripts/smoke.ts         the ops-level end-to-end check
data/uploads/            photo bytes — gitignored, not serverless-safe
```

## Conventions

- **Biome**: single quotes, no semicolons, 100 columns. TypeScript `strict` +
  `noUncheckedIndexedAccess` — indexed access yields `T | undefined`; handle it.
- **Money is integer cents** everywhere; format at the edge with
  `lib/money.ts`. Parse human input once, at the form boundary
  (`parseMoneyToCents`).
- **Times are stored UTC and rendered in the business timezone**
  (`Settings.timezone`) through `lib/dates.ts`. Nothing may read the server's
  local zone; `<input type="datetime-local">` values convert through
  `parseDatetimeLocal`/`toDatetimeLocalValue` with the business zone.
- **Server Actions are thin**; behavior lives in `lib/ops/*` so
  `scripts/smoke.ts` can drive the same code paths. Mutations end with the
  blunt `revalidatePath('/', 'layout')` — precision isn't worth staleness bugs
  in a single-tenant tool.
- A `'use server'` file may only export async functions, and **every export is
  a public, callable endpoint** — each one authenticates itself
  (`requireUser`/`requireOwner`), never relies on the caller.
- Redirect targets carried in hidden `back` fields go through `safeBackPath`.

## Gotchas

- **Layout auth is not page auth.** On soft navigation Next fetches only the
  page segment — the `(app)/layout.tsx` guard does not re-run. Every page under
  `(app)` therefore calls `requireUser()` itself (React `cache()` dedupes the
  session lookup within a request). A new page without it is a bug.
- **Job lines snapshot the catalog at save time** (`JobItem.name/priceCents/
  durationMin`). Editing a service never changes past jobs. Re-saving a job
  re-snapshots from today's catalog; lines whose service was deleted come back
  as editable custom lines (see `jobs/[id]/edit`). Prices are resolved
  server-side from serviceIds — client-sent prices are only accepted for
  custom lines.
- **Invoice numbers** come from the `Settings.nextInvoiceNumber` counter inside
  a transaction (`ensureInvoice`) and are assigned exactly once per job; a lost
  race wastes a number, never reuses one. Don't hand-set `invoiceNumber`
  outside the seed.
- **Status transitions are whitelisted** in `TRANSITIONS` (`lib/ops/jobs.ts`);
  the job page derives its buttons from `availableTransitions`. Add new states
  there, not ad hoc.
- **Photos are a row + a file.** Create/delete only through `lib/ops/photos.ts`
  so both sides stay in sync (`deleteJob` unlinks files too). Filenames are
  app-generated and validated by `SAFE_FILENAME` in `lib/uploads.ts` — a stored
  name can never traverse paths. Uploads are validated by **magic bytes**,
  never the client's content type.
- **`/api/photos/[id]` is auth-gated**, which is exactly why the app uses plain
  `<img>` and not `next/image`: the optimizer fetches server-side without the
  session cookie and would 401. Biome's `noImgElement` is off deliberately.
- **Sessions are DB rows** (sha256 of the cookie token); deactivating a user
  deletes their sessions — revocation is immediate. The login route verifies a
  decoy hash for unknown emails so timing doesn't leak account existence, and
  rate-limits per ip+email in memory (single-instance assumption).
- **Social posting is a planning queue, not an API integration.** Nothing
  publishes to Instagram/Facebook/TikTok — the posting kit (copy caption,
  download photos, open platform) plus "Mark posted" is the whole workflow.
  Meta's API approval process is why; don't wire tokens in casually.
- **`db:seed` is destructive**: it wipes every table and every file under
  `data/uploads/`. The smoke script, by contrast, cleans up after itself and is
  safe to run anytime.
- **The `data/uploads` local store is not serverless-safe.** Swap the
  `lib/uploads.ts` seam for object storage before deploying anywhere with an
  ephemeral filesystem.
- **Never edit or squash an applied migration.**
