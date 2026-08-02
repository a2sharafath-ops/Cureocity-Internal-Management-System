# Cureocity Go-Live Migration Plan

Getting daily operations off Google Sheets / Docs / Drive / Teams and onto the
platform — without disrupting a single working day.

## The one rule that keeps this safe

**Exactly one source of truth per module at any time.** Every module goes
through the same four steps, one module at a time:

1. **Import** — bring the sheet's data into the platform.
2. **Parallel run (short)** — staff keep the old habit, but also do it on the
   platform. 3–5 working days, no longer: long parallel runs breed drift.
3. **Verify** — compare platform vs sheet at the end of the run. Fix gaps.
4. **Cutover** — declare the platform the source of truth. The old sheet is
   made **read-only (frozen), never deleted**. Rollback = unfreeze the sheet.

Nothing is ever deleted from Google. Drive stays as the archive. This means
the worst-case outcome of any phase is "we went back to the sheet for a week"
— not lost data.

## Current state → target map

| Today | Platform module | Status |
|---|---|---|
| Leads sheet | CRM & Leads | **Already live** — Wati + website capture flowing in, ~1000 real leads, front desk on the pilot deployment |
| Client data sheet | Clients + Packages + Onboarding | Built, needs import + cutover |
| Teams: appointments / slots / who's coming today | Appointment Calendar + Training Schedule + workspace "Today" | Built, needs adoption cutover |
| Workout card sheet | Workout Planner (trainer workspace) | Built |
| Meal monitoring sheet | Meal Monitoring (dietitian workspace) | Built |
| Whiteboard sheet | Whiteboard (clinical daily board) | Built — mirrors the Excel structure |
| Docs: consultation/assessment summaries, questionnaires | Consultation console + Summaries | Built — new consults born on platform; old docs stay in Drive |
| Docs: prescriptions | E-prescriptions (EMR/orders) | Built |
| Drive: medical report / InBody / recipe PDFs | File uploads (client card / recipes library) | Built — migrate *forward-looking*, backfill selectively |
| HR sheets | HR module | Built |
| Finance sheets | Billing + Finance Sheets + Expenses | Billing already partially in use (invoices) |
| Teams: official comms | Notifications + Communications | Built — last thing to switch |

## Phases (order matters)

The order follows dependency and risk: master data first, then scheduling,
then clinical, then documents, then back-office, comms last.

### Phase 0 — Foundations (before anything moves)
- Every staff member has a login with the right role; they can sign in on the
  device they'll actually use (front desk PC, trainers' phones/tablets).
- One **module owner** named per phase (front desk lead for clients/calendar,
  head coach for clinical, you for HR/finance).
- Nightly backup habit: Supabase automated backups confirmed on + a weekly
  manual export while migration runs.
- A "Migration" Teams channel: during each parallel run, that's where staff
  report anything the platform can't do that the sheet could. Every item gets
  fixed or consciously deferred before that module's cutover.

### Phase 1 — Leads: finish the cutover (week 1)
Mostly done. Remaining:
- Reconcile the leads Google Sheet against the platform (the platform is
  already ahead of the sheet thanks to Wati/website capture).
- Freeze the leads sheet read-only. Announce: new enquiries only exist on the
  platform. Retire the `crm-pilot` frozen deployment once front desk is on
  production.

### Phase 2 — Clients, packages, care teams (weeks 1–2)
The keystone — everything else hangs off correct client records.
- Export the client sheet to CSV → import (see "How imports work" below):
  client, active package(s) with real start/end dates, assigned care team,
  join date, contact details.
- **Verify hard**: counts match, every active client has an active package,
  every PT/Comprehensive client has a membership (the platform enforces the
  rule the sheet never did — expect a handful of legacy clients that violate
  it; decide each one explicitly).
- Parallel run 3 days: front desk updates both. Then freeze the client sheet.
- From cutover, new clients are only onboarded via the platform (walk-in →
  lead → convert with package).

#### BluePrint is two different things — don't flatten them on import

BluePrint exists both **inside Comprehensive** and as a **standalone package**,
and the platform drives a different journey for each. The import must set the
right `category` per client or the whole ladder, blood panel and SLA clocks
come out wrong.

| | Standalone BluePrint | Comprehensive |
|---|---|---|
| `client_packages.category` | `blueprint` (legacy pkg id `bp1`) | `comprehensive` |
| Blood panel row | panel = `blueprint` | panel = `comprehensive` |
| Journey ladder | blood requested → submitted → 3 consults → **BluePrint generated** | blood panel → 3 consults → strength sessions scheduled |
| After the consults | ends at the delivered BluePrint report | continues into Day 2/10/21/28 milestones, diet chart + explanation, workout plan, consolidated approval |
| Can stand alone? | yes — a client may hold only this | needs an active membership (platform enforces it) |

Import consequences to check in the dry-run:
- A Comprehensive client must **not** get a `blueprint`-panel blood row, and
  vice versa — the client card reads the panel by name, so a mismatched panel
  makes the blood step look permanently outstanding.
- A client who bought BluePrint *and later* upgraded to Comprehensive should
  end up with **both** package rows (BluePrint historical/completed,
  Comprehensive active) — not one overwritten row.
- Flag any `comprehensive` row whose client has no active membership; decide
  each case explicitly rather than letting the import invent one.
- Comprehensive needs real `start_date` / `end_date` — the whole milestone
  calendar (and therefore every "overdue" flag) is derived from the start date.

### Phase 3 — Appointments, sessions, slots (weeks 2–3)
This is what kills the busiest Teams channels.
- No historical import needed — enter **the next 2 weeks** of bookings into
  the calendar (one afternoon of front-desk work).
- Parallel run 1 week: bookings go into the platform *first*, and the Teams
  update is posted *from* the platform view (screenshot or read-off). This
  keeps everyone informed while breaking the "Teams is the truth" habit.
- Cutover: the daily "who's coming today" Teams post is replaced by each
  role's workspace Today/Overdue list and the Appointments board. Keep a
  single daily digest post in Teams for two more weeks as a comfort blanket,
  then stop.

### Phase 4 — Clinical: workout cards, meal monitoring, whiteboard,
### consults, prescriptions (weeks 3–4)
- **Forward-cutover, minimal import.** New consultations happen in the
  console (▶ Start → complete → summary). New prescriptions via EMR. Old
  Docs stay in Drive as archive — do not re-type history.
- Workout cards: trainers rebuild each **active** client's current card in
  the Workout Planner during their next session (spreads the work naturally
  over one training cycle). Same for meal monitoring — dietitian starts
  logging on the platform from a chosen Monday.
- Whiteboard: run the platform whiteboard in the daily MDT meeting for one
  week alongside the sheet, then freeze the sheet. (The platform version
  auto-derives alive/dead and severity — the sheet can't.)
- Blood reports / InBody PDFs: from cutover, new ones are uploaded to the
  client card. Backfill only the **active** clients' latest reports (a
  one-time front-desk task, ~1–2 days); everything older stays in Drive.

### Phase 5 — HR & Finance (weeks 4–5)
- Finance first day of a month for a clean books boundary: opening balances
  into Finance Sheets, petty-cash float set, reimbursements switch on. From
  that day every invoice/payment is platform-only (billing is already
  partially there).
- HR: staff directory is already in; add leave balances and onboarding
  checklists. Freeze HR sheets after one pay cycle runs clean.

### Phase 6 — Communications & decommission (week 6)
- Official updates move to in-app notifications; Teams stays for chat only.
- Walk the Drive folder: everything superseded gets moved into an `ARCHIVE —
  pre-platform` folder (still readable, clearly dead).
- Post a one-page "where things live now" note (the table above) in Teams
  and pin it.

## How imports work (the safe pattern)

For each sheet import (clients, packages, HR, finance opening balances):

1. You export the Google Sheet as CSV and drop it in the repo's `imports/`
   folder (gitignored).
2. I write an import script per dataset with a **dry-run mode**: it prints
   exactly what it would insert/skip/flag (duplicates, missing phone, package
   with no dates, PT without membership) and touches nothing.
3. You review the dry-run output; we fix the CSV or the mapping.
4. You run the real import (or run the generated SQL in the Supabase SQL
   Editor — same as migrations today). Never me; same rule as always.
5. Verify counts + spot-check 10 random clients side by side.

One import, one dataset, one day. Never batch several datasets into one run.

## Go / no-go gate for every cutover

A module cuts over only when all four are true:
- Parallel-run data matches the sheet (or all mismatches are explained).
- The module owner says their team can do the full daily routine without
  opening the old sheet.
- Every "the sheet could do X" item from the Migration channel is fixed or
  explicitly deferred with your sign-off.
- The old sheet is frozen read-only **with a banner row**: "FROZEN <date> —
  now lives at cureocity platform → <link>".

## Rollback

Per module, at any time in the first two weeks after cutover: unfreeze the
sheet, announce it's the truth again, keep the platform in parallel, fix the
blocker, re-cut. Because sheets are frozen (not deleted) and imports are
additive (nothing is ever deleted from the platform either), rollback is a
five-minute decision, not a project.

## Timeline at a glance

| Week | Cutover |
|---|---|
| 1 | Leads finished · client import + verify |
| 2 | Clients/packages live · next-2-weeks bookings entered |
| 3 | Calendar/sessions live · Teams becomes read-from-platform |
| 4 | Clinical live (planner, meals, whiteboard, console, Rx) |
| 5 | Finance month-boundary cutover · HR |
| 6 | Comms shift · Drive archive sweep · done |

Six weeks is deliberate — one module owns each week, and no week asks any
single person to change more than one habit.
