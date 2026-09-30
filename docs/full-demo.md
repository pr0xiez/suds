# Full app demo

From the project directory with Linux Node 24:

```bash
npm run demo:prepare
npm run demo
```

Open http://localhost:4184/demo. The tour has normal sign-in buttons for the
fictional owner, customer and staff accounts, links to every product area, and
an inbox for queued email. It covers instant bookings and an approval business,
jobs, payments, invoices, photo uploads and consent, assistant drafts, social
planning, services, settings, staff invitations and customer access.

The owner is `owner@suds.local`, customer `customer@suds.local`, and staff
`staff@suds.local`. Each uses the deliberately public password `SudsDemo2026!`.
Use separate browser profiles for simultaneous owner/customer views. Sign out
before trying a fresh signup. Open the demo inbox after signup, recovery or an
invitation, then follow the local confirmation link. Nothing is emailed.

Preparation creates a random separate Neon schema, applies migrations there,
and seeds only that new schema. It never seeds or migrates the existing public
application schema. A private ignored `.env.demo.local` holds its connection.
Running preparation again reuses the existing demo without deleting changes.
Photo uploads are local development files; the demo stays available until the
server is stopped. Restart with `npm run demo`.

The marketing assistant uses labeled sample responses derived from the selected
task and real demo context. Runs, edits, permission checks, and handoff to the
post composer persist normally. Paid provider credentials are blank in the demo
environment. Photo/video rendering is demonstrated in an explicitly simulated
storyboard workflow linked from the shorts editor; it does not render a real
video. Cloud upload/storage, live AI editing, and outbound email need provider
setup before a live pilot. Social publication remains manual.

The tour, inbox, sample assistant and login shortcuts require an explicit demo
flag, development/test mode and the exact disposable schema-name format.
Production never enables them, including if the flag is mistakenly set.
