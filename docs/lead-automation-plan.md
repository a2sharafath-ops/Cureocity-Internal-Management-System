# Lead automation — capture, routing, flows

A build plan for the three things Salesforce does that this app currently
doesn't. Written after an audit of the codebase on 2026-07-21; every "today"
claim below is cited to a file and line.

---

## Where we actually stand

**Capture.** One path exists: a logged-in staff member types the lead into the
form on `/leads`. `createLead` (`lib/actions.ts:658`) holds the only `insert`
into `leads` anywhere in the codebase. No public endpoint exists — `middleware.ts`
redirects every unauthenticated path to `/login`, and the four API routes that
do exist (payments webhook, FHIR, wearables ingest, cron) never touch leads.
No ad-platform webhook, no CSV import, no inbound-call handler. The tablet
kiosk looks like capture but writes to `tablet_submissions` and converts to a
**client** (`lib/actions.ts:3952`), skipping the lead pipeline entirely.

**Routing.** There is no owner column. `leads.fde` (`supabase/0001_init.sql:53`)
is free text behind a plain `<input>` (`components/LeadControls.tsx:44`) — not a
staff dropdown, not a foreign key, not validated at write time. `createLead`
never reads the acting user, so a blank box produces an unowned lead. No
round-robin, no rules of any kind, and no "my leads" view to work a queue from.

**Flows.** One nightly cron exists (`vercel.json`, 03:00 UTC) and its callback
sweep (`lib/cron/lead-followups.ts`) is genuinely good: a due → late →
escalated ladder, management looped in at 3 days, idempotent so it can't spam.
But it only sees leads where `next_follow_up IS NOT NULL` (`:36`), it notifies
**whole roles rather than the owner** (`lib/notify.ts:12`), and it is in-app
only. Nothing fires on lead creation, and nothing reads `expected_value` on a
schedule despite the column existing since `0082`.

The through-line: **the automation we have can only act on leads a human has
already committed to.** The leads nobody touched are invisible to it, and those
are the ones that leak.

---

## Two things to check before building anything

Both fail silently, and both would make this plan look broken when it isn't.

`CRON_SECRET` — if unset, `/api/cron/daily` returns 401 for every request
(`app/api/cron/daily/route.ts:11`) and **all** nightly automation is dead.

`RESEND_API_KEY` — if unset, `sendEmail` returns `{ status: "skipped" }`
without throwing (`lib/email/send.ts:9`), yet every caller still writes a row
to `email_log`. So the log will show sends that never left the building.

Verify both in Vercel before Phase 3, where the first customer-facing email lands.

---

## Phase 1 — Routing

Smallest piece, highest leverage, and it unblocks everything after it: once a
lead has a real owner, alerts can target a person instead of shouting at a role.

We already have the engine. `lib/assignment.ts` does least-load rotation with a
deterministic tie-break (`pickByRotation`, `:58`), and `lib/care-team.ts` builds
the candidate pool with live workload counts. It's keyed on `client_id` and runs
only at conversion. This phase generalises it rather than writing a second one.

**Schema.** Add `leads.owner_id text references staff(id)`, plus
`owner_assigned_at` and `owner_method text check (owner_method in
('rule','manual','round_robin'))`. Keep `fde` untouched — it's the historical
record of who handled the lead originally, and 999 rows of imported names
depend on it. New code reads `owner_id` and falls back to `fde`, exactly as
`lib/cron/lead-followups.ts:74` already does for `follow_up_owner`.

**Rules.** A small ordered table, `lead_routing_rules` — match on `source`,
`campaign`, `interest` or `location`, assign to a staff id or to a round-robin
pool, first match wins, with a default pool at the bottom so nothing falls
through unowned. Rules live in the database rather than in code so the front
desk manager can change them without a deploy.

**Wiring.** `createLead` calls the router before insert; if no rule matches, it
falls back to the acting user (`p`), which alone fixes the unowned-lead problem.
Add an owner `<select>` populated from `staff` to replace the free-text FDE
input, and a "My leads" chip alongside the existing pipeline tabs.

**Backfill.** One migration mapping existing `fde` strings to `staff.id` via the
alias map already in `app/(app)/leads/page.tsx:69`. Names that don't resolve
(the audit found at least "Rohin" has no staff row) stay null and show up in a
"needs an owner" filter rather than being silently reassigned.

---

## Phase 2 — Flows on the leads we already have

No new data required. This is the phase that pays for itself fastest, because
it acts on the 999 leads sitting in the database right now.

**Fix the targeting.** `notifyRoles` (`lib/notify.ts:7`) is the only notification
helper and all eleven call sites pass roles. Add `notifyUser(supabase, staffId,
…)` beside it and switch the callback sweep to notify the owner directly, with
role-wide escalation retained at the 3-day mark. Managers should hear about a
lead when it's genuinely stuck, not on day one.

**Close the no-callback hole.** A second sweep for leads with *no*
`next_follow_up` at all, older than N days, not disqualified, not closed —
routed to the owner as "you haven't committed to a next step." This is the
inverse of the existing query and the single highest-value alert in the plan,
because it covers the leads the current system cannot see.

**Idle high-value deals.** `lib/pipeline.ts` already computes weighted value but
is imported only by the reports page and `LeadOpportunity`. A sweep over
`expected_value` above a threshold with no remark in N days, escalating to
management — this is your "₹4 lakh sitting idle" alert, and the data for it has
existed since migration `0082`.

**Stage stagnation.** Days-in-stage needs a `stage_changed_at` column; we don't
retain transition timestamps today. Cheap to add, and it turns the pipeline
funnel from a snapshot into something that can raise its hand.

All four reuse the idempotency pattern already proven in
`lib/cron/lead-followups.ts:50` — a composite gate key in `blueprint_sla_events`,
so re-runs can't double-notify.

---

## Phase 3 — Auto-response on new leads

Blocked on a decision, not on code: **`leads` has no email column.** `LEAD_FIELDS`
(`lib/actions.ts:656`) carries `phone` and nothing else contactable. So:

- Add `leads.email`, and the welcome email becomes trivial — `tplWelcome`
  already exists (`lib/email/templates.ts:21`) and currently has no caller at all.
- Or accept that acquisition here is phone-first, and make the "auto-response"
  an auto-created **task** for the owner ("call within 15 minutes") rather than
  a message to the lead.

Worth flagging a related gap found in the audit: conversion inserts its invoice
directly (`lib/actions.ts:730`) rather than going through `createInvoice`, so
the `tplInvoiceCreated` email at `:1883` never fires for a converted lead. Same
for auto-renewal invoices (`lib/cron/daily.ts:43`). Both are one-line fixes and
belong in this phase.

WhatsApp is the honest answer for an Indian fitness business, and it's the
larger piece of work — today `channel: "whatsapp"` is only a string written to
`messages` (`lib/actions.ts:1833`), never transmitted. Treat as its own project.

---

## Phase 4 — Capture

Largest phase, and the one that needs your input on which sources you actually
run. The shared groundwork is the same regardless: a public ingest endpoint,
exempted in `middleware.ts`, writing through a single `ingestLead()` function so
that dedupe-by-phone, scoring, and Phase 1 routing apply identically no matter
where the lead came from. Secured per-source with a shared secret or signature —
the Razorpay webhook (`app/api/payments/webhook/route.ts`) is the pattern to copy.

Then, in rough order of value for this business:

**Website form** — a public POST endpoint. Straightforward once ingest exists.

**Meta lead ads** — the big one if you run Instagram/Facebook campaigns.
Requires a Meta app, webhook subscription and page token; the payload maps
cleanly onto `source` and `campaign`, which already exist and already feed
scoring (`lib/leadscore.ts`).

**Missed-call / IVR** — `lib/ivr/config.ts` is a scaffold and the provider bridge
at `lib/actions.ts:874` is an empty stub. An inbound handler creating a lead
from a missed call fits a walk-in-heavy business well.

**CSV import** — unglamorous but immediately useful given leads arrive by
spreadsheet today. Needs a dedupe-by-phone preview step before commit.

---

## Suggested order

Phase 1 → Phase 2 → Phase 3 → Phase 4.

Routing first because it's small, reuses an engine that already exists, and every
alert built afterwards can then reach a person. Phase 2 next because it acts on
data already in the database and needs no external dependency. Phase 3 needs a
decision from you (email column vs task-only). Phase 4 is the largest and its
value depends entirely on which channels you actually spend money on.

A reasonable smaller starting point, if you want one visible win first: Phase 1
plus only the no-callback sweep from Phase 2. That combination means every new
lead gets an owner, and every lead without a next step surfaces to that owner
by name — which is most of the practical distance between where we are and what
the Salesforce description promises.
