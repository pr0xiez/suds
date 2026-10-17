# Suds architecture

How the pieces fit: who uses the app, where it runs, how requests reach the
database, and how background work talks to paid providers. The rules behind these
diagrams live in [CONTEXT.md](../CONTEXT.md); module ownership is in
[AGENTS.md](../AGENTS.md); deployment steps are in [launch.md](launch.md).

## System context

One Next.js 16 app on Vercel serves three audiences. Postgres is the only system
of record. Requests only enqueue work; paid providers and email are called from
`runBackgroundWork()`, never while a page renders. Queueing work kicks the worker
route right after the response; an hourly cron sweep covers reminders and retries.
Both, and the optional long-running loop, share that code and can run together.

```mermaid
flowchart LR
  owner(["Owner / staff"])
  customer(["Verified customer"])
  visitor(["Public visitor"])

  subgraph vercel["Vercel — project suds, iad1, Node 24"]
    app["Next.js 16 app<br/>pages · server actions · route handlers"]
    cron["Vercel Cron<br/>hourly sweep"]
  end

  loop["Optional persistent worker<br/>npm run worker:loop"]
  bg["runBackgroundWork()<br/>lib/workers"]

  subgraph data["Private data"]
    neon[("Neon Postgres")]
    r2[("Cloudflare R2<br/>private bucket")]
  end

  subgraph providers["External providers — server-only keys"]
    openai["OpenAI Responses API<br/>marketing drafts"]
    submagic["Submagic<br/>clip editing"]
    shotstack["Shotstack<br/>photos → vertical short"]
    email["Resend-compatible<br/>email HTTP API"]
  end

  owner -->|"/dashboard, /jobs, /marketing …"| app
  customer -->|"/portal, book on /b/:slug"| app
  visitor -->|"/b/:slug profile + open slots"| app
  owner -.->|"direct PUT, signed URL"| r2

  cron -->|"Bearer CRON_SECRET<br/>GET /api/internal/worker"| app
  app -.->|"kick after enqueue<br/>POST /api/internal/worker"| app
  app --> bg
  loop --> bg
  app --> neon
  app --> r2
  bg --> neon
  bg --> r2
  bg --> openai
  bg --> submagic
  bg --> shotstack
  bg --> email
  submagic -.->|"1-hour signed source URL"| r2
  shotstack -.->|"1-hour signed source URL"| r2
```

The app uses Neon's pooled `DATABASE_URL`. Migrations run separately with
`npm run db:deploy` over the unpooled `DIRECT_URL`; builds never migrate or seed. GitHub Actions runs every gate (tests, typecheck,
Biome, build, migrations, three smoke suites) against Postgres 17.

## Application layers

There is no `proxy.ts`. Every page, server action, and route handler
authenticates itself, and every domain operation takes `businessId` first.

```mermaid
flowchart TB
  subgraph routes["app/ — entry points"]
    direction LR
    ownerUi["app/(app)<br/>owner + staff pages"]
    portal["app/portal<br/>customer pages"]
    public["app/b/[slug]<br/>public booking"]
    identity["signup · verify · login<br/>recover · reset-password"]
    demo["app/demo<br/>dev-only, isolated schema"]
  end

  subgraph handlers["mutations"]
    direction LR
    actions["app/actions/*<br/>server actions"]
    api["app/api/*<br/>JSON route handlers<br/>same-origin checked"]
    workerApi["app/api/internal/worker"]
  end

  subgraph authz["access"]
    direction LR
    session["lib/auth/session<br/>hashed DB sessions<br/>getSessionUser · requireUser · requireOwner"]
    business["lib/business<br/>accepted active membership"]
    limits["lib/auth/persistentRateLimit"]
  end

  subgraph domain["domain — businessId first"]
    direction LR
    ops["lib/ops/*<br/>customers · jobs · bookings<br/>photos · social · settings · users"]
    schedule["lib/bookingSchedule<br/>business-row lock + conflict check"]
    avail["lib/bookingAvailability<br/>pure timezone / buffer math"]
    ai["lib/ai/*<br/>context · quotas · runs"]
    media["lib/media/* · lib/storage<br/>signed URLs · magic-byte checks"]
    notify["lib/notifications<br/>transactional outbox"]
    workers["lib/workers<br/>AI runs + email delivery"]
  end

  db["lib/db/client<br/>Prisma 7 + adapter-pg"]
  pg[("Postgres")]
  obj[("R2 / S3")]

  routes --> session
  handlers --> session
  session --> business
  api --> limits
  actions --> ops
  api --> ops
  api --> ai
  api --> media
  workerApi --> workers
  ops --> schedule
  schedule --> avail
  ops --> notify
  workers --> ai
  workers --> notify
  workers --> media
  ops --> db
  schedule --> db
  ai --> db
  notify --> db
  media --> db
  media --> obj
  db --> pg
```

## Data model

Every business-owned table carries `businessId`. Related rows join on composite
`(businessId, id)` foreign keys, so the database itself refuses a job that points
at another business's customer or vehicle.

### Identity and access

```mermaid
erDiagram
  User ||--o{ Session : "signs in with"
  User ||--o{ AccountToken : "verify, reset, invite, link"
  User ||--o{ BusinessMembership : "holds"
  Business ||--o{ BusinessMembership : "grants OWNER or STAFF"
  User |o--o{ Customer : "linked after verified invite"
  Business ||--o{ Customer : owns
  Business ||--|| Settings : "has exactly one"

  User {
    string email UK
    datetime emailVerifiedAt
    bool active
  }
  BusinessMembership {
    string businessId PK
    string userId PK
    enum role
    datetime acceptedAt
    bool active
  }
  Session {
    string tokenHash UK "SHA-256, never the raw token"
    datetime expiresAt
  }
  AccountToken {
    string tokenHash UK
    enum purpose
    datetime consumedAt "single use"
  }
  Business {
    string slug UK
    enum status "DRAFT or PUBLISHED"
  }
```

`RateLimitBucket` stands alone: database rate limits shared across instances.

### Operations, media, and marketing

```mermaid
erDiagram
  Business ||--o{ Service : catalog
  Business ||--o{ AvailabilityBlock : "time off"
  Customer ||--o{ Vehicle : owns
  Customer ||--o{ Job : "booked for"
  Vehicle ||--o{ Job : "worked on"
  Job ||--|{ JobItem : "snapshot lines"
  Service |o--o{ JobItem : "copied from"
  Customer ||--o{ Booking : requests
  Vehicle ||--o{ Booking : "for"
  Booking |o--o| Job : "accepted into"
  Job |o--o{ Photo : "before / after"
  Business ||--o{ Photo : library
  Business ||--o{ MediaUpload : "upload authorizations"
  Job |o--o{ MediaUpload : "attached to"
  SocialPost ||--o{ PostPhoto : uses
  Photo ||--o{ PostPhoto : "approved only"
  Job |o--o{ SocialPost : "created from"
  Business ||--o{ CaptionTemplate : has
  Business ||--o{ AiRun : "queued jobs"
  Business |o--o{ NotificationOutbox : "queued email"

  Job {
    enum status
    int invoiceNumber "unique per business"
    enum paymentMethod "recorded manually"
  }
  JobItem {
    string name "snapshot"
    int priceCents "snapshot"
  }
  Booking {
    enum status
    datetime reservedUntil "only an explicit hold reserves time"
    string idempotencyKey
  }
  Photo {
    bool approvedForMarketing "default false"
  }
  AiRun {
    string kind "MARKETING, VIDEO, PHOTOS"
    string status
    string providerId
  }
```

## Booking: one lock for every calendar change

Owner job edits, booking acceptance, customer changes, and time-off blocks all
take the same business-row lock before reading busy time, so two writers can never
both see a free slot.

```mermaid
sequenceDiagram
  autonumber
  actor C as Customer
  participant P as /b/:slug
  participant O as lib/ops/bookings
  participant DB as Postgres
  participant W as Worker
  participant E as Email provider

  C->>P: signed in, choose services, vehicle, time
  P->>O: submitPublicBooking(userId, input)
  O->>DB: BEGIN, lock Business row
  O->>O: identity active + email verified?
  O->>DB: read jobs, holds, blocks
  O->>O: fits hours + buffer, lead time, horizon?
  alt INSTANT mode
    O->>DB: insert Booking CONFIRMED + linked Job
  else REQUEST mode
    O->>DB: insert Booking PENDING, no capacity held
  end
  O->>DB: insert NotificationOutbox row
  O->>DB: COMMIT
  Note over W,DB: After the response: kick drains the queue (reminders: hourly sweep)
  W->>DB: claim outbox row (FOR UPDATE SKIP LOCKED)
  W->>DB: recheck appointment under the same lock
  W->>E: send with idempotency key
  W->>DB: mark SENT, or retry with backoff
```

If the owner accepts a REQUEST booking, availability is checked again under the
lock and exactly one job is created. Cancel and reschedule release or replace the
time in the same transaction and cancel reminders that no longer apply.

## Direct media upload

Upload bytes go straight to the private bucket. The app grants permission for one
upload, then checks the result before creating any media record.

```mermaid
sequenceDiagram
  autonumber
  actor U as Owner browser
  participant A as /api/media/uploads
  participant DB as Postgres
  participant S as R2 bucket

  U->>A: POST kind, size, content type
  A->>DB: rate + storage quota, insert MediaUpload PENDING
  A-->>U: short-lived signed PUT to pending/…
  U->>S: PUT bytes
  U->>A: POST /:id/finalize
  A->>DB: claim PENDING → FINALIZING
  A->>S: HEAD + read header, verify size and magic bytes
  A->>S: copy to a fresh media/… key, validate
  A->>DB: MediaUpload READY, create Photo for images
  Note over S: A lifecycle rule deletes leftover pending/ objects after a day
```

## Background work

`AiRun` and `NotificationOutbox` are durable Postgres queues. Each tick claims
rows with `FOR UPDATE SKIP LOCKED` and a lease, so kicks, the hourly sweep, and a
persistent worker can run at the same time without double-processing. A drain
ticks while work is due within its five-minute window (render status checks every
30 to 60 seconds, short retries) and then exits, leaving the database idle.

```mermaid
stateDiagram-v2
  [*] --> QUEUED: owner submits (quota-checked)
  QUEUED --> SUBMITTING: worker claims lease
  SUBMITTING --> COMPLETED: MARKETING draft returned
  SUBMITTING --> PROCESSING: provider accepted the job
  SUBMITTING --> UNCERTAIN: billable call failed, or lease expired mid-submit
  SUBMITTING --> FAILED: owner lost access or input invalid
  PROCESSING --> PROCESSING: poll every 30–60 s
  PROCESSING --> COMPLETED: output copied to private storage
  PROCESSING --> FAILED: provider failed, storage cap, or 30 attempts / 2 days
  UNCERTAIN --> [*]: never auto-resubmitted
  COMPLETED --> [*]
  FAILED --> [*]
```

Before calling a provider, the worker confirms the requester is still an active
owner and rereads business facts and photo approval. Rendered video is downloaded
from an allowlisted provider host, capped at 50 MB, checked as MP4, and stored in
R2 before the run is marked complete. Each tick also deletes expired upload
authorizations. Queue failures appear on `/settings/operations`.
