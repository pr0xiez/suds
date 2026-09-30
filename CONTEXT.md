# Suds domain and invariants

Suds serves a solo mobile detailing business with one scheduling resource. The
owner runs jobs and prepares marketing; verified customers book and manage their
own appointments in a separate portal. This document describes the implemented
application. The standalone concept in `docs/product-preview.html` uses samples.

## Identity and business access

The local full-app demo uses a fresh `suds_demo_<12 hex>` database schema.
`SUDS_DEMO_MODE=1` enables its tour, fictional-account login forms, and local
outbox viewer only in development/test with that schema. Production always
denies these routes. The demo marketing provider uses labeled deterministic
responses; normal authentication, business scoping, consent checks, queues,
caption review and post creation still apply. No email is dispatched by the
demo worker. Shorts preview uses the separate clearly labeled concept workflow.

`User` is a global identity. `BusinessMembership` grants an accepted, active
OWNER or STAFF relationship to one business. Never authorize from legacy
`User.role`. A customer can also own a business; those are independent relations.
The selected business cookie is a preference that must resolve to an accepted
membership on every request. Changing a membership must not change the global
identity, password, or another business's access.

`getSessionUser` returns an identity, including customers. `getBusinessSessionUser`
resolves business access. `requireUser` requires verified membership;
`requireOwner` requires its OWNER role; `requireVerifiedIdentity` is appropriate
for customer actions. Every page, action, and API authenticates independently.

Sessions and account capabilities store SHA-256 hashes, never raw bearer values.
Account verification, password reset, staff invitations, and customer-history
invitations have expiries and are consumed atomically once. Email scanners may
open the confirmation page, but only POST consumes the token. Recovery revokes
sessions. Invitations cannot reactivate revoked membership via an old link.
Persistent database rate limits apply across app instances.

`Customer.userId` links a customer record to a verified identity, unique within
its business. A typed email or phone is not proof of ownership. Existing owner
records link only after an explicit email invitation is confirmed. A new public
booking may create a separate customer record instead of taking over an existing
unlinked record with the same email. Private owner notes stay private.

## Business-owned records

Settings, customers, vehicles, services, jobs, photos, posts, caption templates,
bookings, uploads, and AI runs carry business ownership. Domain operations take
businessId first. Scope reads as well as writes and validate related identifiers.
Composite foreign keys and relation guards protect cross-business links; they
supplement application checks. The preservation migration moves legacy records
to `suds-legacy` and existing users to accepted memberships without changing IDs.

Each business has exactly one Settings record. Invoice numbers use its atomic
counter and are unique within the business. Money is integer cents. Job lines
snapshot service names, prices, and duration; catalog changes do not change a
confirmed booking. Customer invoices expose customer-facing details only.

## Booking and calendar

`Business.status=PUBLISHED` and completed setup expose `/b/[slug]`. Working
hours use Monday=0 through Sunday=6 and `{day,start,end}` windows. All persisted
times are UTC; display, local form conversion, and availability use Settings.timezone.
Availability advances real UTC instants, so DST gaps and repeated times are handled.

Default booking mode is INSTANT. REQUEST records a pending proposal without a
confirmed job. Pending requests do not reserve capacity unless a future
reservedUntil explicitly exists. Acceptance checks availability and creates one
linked job once. Repeated submission/acceptance is idempotent.

Every calendar mutation locks the same Business row before reading busy time:
owner jobs, booking acceptance, customer changes, and availability blocks. The
full duration and configured buffer must fit working hours without crossing a
break, job, or block. Lead time and booking horizon apply to public changes.
Cancellation and rescheduling follow the business policy; replacement time is
reserved in the same transaction as releasing the original.

Booking request state and job progress are separate. Owner changes preserve
the customer and vehicle on linked jobs and synchronize customer-facing time,
price, lines, duration, state, and notifications. Decline/cancel releases capacity.
Customer operations cannot set prices, discounts, payments, internal notes,
or work status. Completed/in-progress jobs are not freely rescheduled.

## Media and marketing

Original media stays private. Photo.approvedForMarketing defaults false; owner
approval is explicit and revocable. Composer and assistant selections require
approved photos in the selected business. AI dispatch rechecks membership and
approval. Recheck availability before using an availability campaign; preparing
one does not reserve a slot.

Direct uploads first create a MediaUpload authorization with expected size/type,
business/user, purpose, and expiry. Browser PUT uses a short-lived signed private
pending key. Finalization verifies size and magic bytes, copies the accepted
version to a fresh private key, and validates it before creating media records.
The upload URL cannot overwrite that accepted key. An atomic FINALIZING claim
prevents duplicate completion. Expired and rejected uploads are cleaned by the
worker. Legacy flat local filenames remain readable until deliberately migrated.
Local storage is development-only; never deploy depending on ephemeral files.

The first upload path is single PUT: photos at most 10 MB, video clips at most
50 MB. Persistent pilot caps limit upload authorizations and retained sources;
see the storage module for exact limits. Larger/resumable uploads and storage
tiers are follow-up work. Copy legacy files and verify them before discarding
the persistent local volume.

The hosted marketing assistant gets an allowlist of business/catalog/job fields
and approved media IDs, not customer names, plates, private addresses, internal
notes, or stored filenames. Provider calls use structured output and token caps.
Runs and drafts are business-scoped, owner-only, persisted, and idempotent.
No assistant action publishes, messages customers, buys ads, or changes bookings.
Manual publication is review, copy/download, post, then mark posted.

Submagic edits uploaded clips; Shotstack renders ordered photos into vertical
shorts. Photo rendering is automated slideshow editing, not generated footage.
Providers receive only explicitly selected, temporarily signed sources. Outputs
are bounded, restricted to provider hosts, and copied to private object storage
before completion. A provider link alone is not permanent Suds storage.

## Background work and operations

AiRun and NotificationOutbox are durable queues. Workers atomically claim leases
with SKIP LOCKED. An uncertain paid AI submission becomes UNCERTAIN instead of
being retried into another billable request. Known provider jobs may be polled
again. Saved quota limits apply across processes; browser refreshes do not reset
history. Queue failures stay visible in `/settings/operations`.

Booking/account events enqueue emails in their database transaction. Delivery
uses a provider idempotency key and bounded retries. Cancel/reschedule invalidates
stale reminders; dispatch rechecks the appointment under the calendar lock.
No email is sent by page rendering. Promotional communication is separate scope.

Run one persistent worker or invoke `/api/internal/worker` regularly using a
Bearer CRON_SECRET of at least 32 characters. `/api/health` checks the database;
it is not evidence that external providers are connected. Preflight checks
configuration presence without revealing values. Structured logs omit customer
payloads, addresses, media URLs, and credentials. See the launch runbook for
backups, migration, monitoring, and application rollback.
