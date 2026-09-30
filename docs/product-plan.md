# Suds product scope

The first release serves solo mobile detailers starting a business and their
customers. It completes the loop from setup to booking, job completion, and
reviewed marketing. The five launch areas below are now implemented in source;
production accounts and deployment remain setup work in the launch runbook.

The [interactive concept](product-preview.html) uses fictional data and local
browser state. The real web application has separate owner and customer routes.

## Three experiences

| Experience | Main task | Entry |
| --- | --- | --- |
| Business owner | Set up, schedule, serve customers, prepare marketing | /signup, /onboarding, /dashboard |
| Public business page | See services, prices, service area, available appointments | /b/[slug] |
| Verified customer | Book and manage own appointments and vehicles | /portal |

A customer can also own a detailing business. Permissions derive from verified
identity and explicit business membership, not a global owner/customer switch.
The customer portal does not expose internal notes, revenue, other customers,
or the owner's media library and assistant drafts.

## The five launch areas

1. **Business isolation and accounts:** per-business records and settings,
   accepted memberships, signup, verification, recovery, staff invitations,
   explicit customer-history linking, database-backed sessions and rate limits.
   The preservation migration retains existing IDs, relationships and invoices.
2. **Owner setup and public page:** services, prices and durations, timezone,
   mobile service area, working hours, policy and draft/publish controls. Owners
   receive a working booking link after publishing; customers need no native app.
3. **Booking and customer portal:** instant confirmation by default, optional
   owner approval, full-duration/buffer availability, shared atomic calendar
   locks, blocked time, idempotent retries, customer cancellation/rescheduling,
   vehicle management, invoices and queued transactional email reminders.
4. **Marketing loop:** interactive task selection and a hosted draft assistant,
   saved runs and reviewed campaigns; approved-media captions and a manual
   posting kit; photo-to-short rendering and uploaded-video automatic editing.
5. **Deployment foundation:** private S3-compatible storage and direct browser
   uploads, retained outputs, persistent quotas/worker, notification outbox,
   readiness checks, health, structured logs, CI, container recipe and backup
   command. See [launch.md](launch.md) for remaining live environment checks.

## What the hosted assistant does

The owner chooses a completed job, an open appointment, or a business
introduction and supplies a short brief, platform and voice. The assistant reads
allowlisted business/catalog/job fields and approved photo IDs. It returns an
editable caption and publishing guidance with the real booking link. Customers'
private contact details, notes, plates, addresses, and stored filenames stay out
of the prompt. Runs are recorded and business-scoped, with token caps and quotas.

The owner reviews before saving or copying. Availability campaigns recheck the
live schedule before sharing; generating a post does not reserve an appointment.
The assistant cannot publish, buy ads, message customers, or change appointments.
It is hosted by Suds; detailers do not bring a model-provider account.

## Photos and video shorts

Submagic edits an approved uploaded MP4/MOV clip of at most 50 MB. Shotstack
renders 2–8 approved photos in order into a vertical slideshow with motion and
fades; this does not synthesize new footage or AI music. Both paths persist run
state and retain successful output in private object storage before completion.
The owner reviews and downloads the result for manual publication. Generated
video is separate from the existing photo-only SocialPost composer.

Provider adapters need server credentials, private storage, and a working worker.
A disabled connection is shown explicitly; sample responses are confined to the
standalone concept. No paid edit, email delivery, or production connection is
implied by having the adapter in source.

## First pilot and next choices

Ship a phone-friendly web app to a small number of invited solo mobile detailers.
Validate the whole setup → verified booking → job → approved media → reviewed
campaign loop before expanding. Capture pilot feedback about setup completion,
booking failures, reminders, editing quality and cost, and repeat usage.

Stripe/deposits, promotional SMS, automatic social publishing, multi-operator
scheduling, route optimization, recurring plans, campaign attribution, native
apps, larger resumable uploads, and Google Drive exports are follow-up work.
Use [media-storage.md](media-storage.md) for the low-cost storage comparison;
Cloudflare R2 is recommended as primary, Workspace Drive as an optional archive.
