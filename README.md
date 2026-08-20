# 🫧 Suds

**wash · work · post** — job management and social-media management for a car
detailing business, in one app. The two halves feed each other: every job
collects before/after photos, and one click turns a finished job into a draft
post with the money shots ordered, a caption suggested, and your hashtag bank
appended.

## What it does

**Run the shop**

- Customers and their vehicles, with notes ("two golden retrievers — expect
  pet hair")
- A service catalog with prices, durations, and categories; one-off custom
  lines and discounts per job
- A week-view schedule — overlapping jobs sit side by side, click an empty
  slot to book it
- Job lifecycle: scheduled → in progress → completed (plus canceled / no-show),
  with guarded transitions
- Before/after photo capture on every job
- Payments (cash/card/Venmo/Cash App/Zelle, tips) and printable invoices with
  stable invoice numbers
- A dashboard that surfaces what needs you: today's runsheet, month revenue,
  unpaid completed jobs, and finished jobs with no photos yet

**Run the socials**

- A photo library fed automatically by job uploads
- A composer: pick photos (click order = carousel order), write or template a
  caption with live character count, choose platforms, schedule it
- Caption templates with `{{vehicle}}`-style tokens, plus deterministic
  caption suggestions built from the job
- A month content calendar and a queue (drafts / up next / **overdue**)
- A posting kit per post: copy caption, download photos, open the platform,
  then "Mark posted"

> **Honest scope:** Suds does not publish to Instagram/Facebook/TikTok APIs
> (Meta's app-review process makes that a project of its own). It is the
> planning, queueing, and content-production half — the part that actually
> saves time — with a fast manual publish flow.

## Stack

Next.js 16 (App Router, Server Actions) · Prisma 7 + Neon Postgres ·
Tailwind CSS v4 · Biome · Vitest. Zero native modules — runs in a
compiler-less environment by design (scrypt auth, hand-parsed image headers,
hand-rolled PNG encoder for seed photos).

## Getting started

```bash
nvm use
npm install
cp .env.example .env    # add your Neon URLs (see AGENTS.md)
npm run db:generate
npm run db:migrate      # migrates, then seeds a demo shop
npm run dev
```

Sign in at `http://localhost:3000/login` as `owner@suds.local` (the seed
prints the password — `SEED_OWNER_PASSWORD` or the dev default).

## Checks

```bash
npm test          # 54 unit tests (money, timezones incl. DST, calendar lanes,
                  # captions, image parsing, auth)
npm run typecheck
npm run lint
npm run build
npm run smoke     # end-to-end ops against the real DB — books a job, walks the
                  # lifecycle, uploads photos, builds a post, cleans up
```

## Ideas for later

- Stripe payments / deposits (SqFt next door already does Stripe Connect)
- SMS reminders (Twilio) and review-request automation
- Direct publishing via Meta's Graph API once app review is worth it
- Recurring maintenance plans (monthly wash memberships)
- Object storage for photos before any serverless deploy

See `AGENTS.md` for the working notes: environment constraints, invariants,
and the gotchas that will bite you first.
