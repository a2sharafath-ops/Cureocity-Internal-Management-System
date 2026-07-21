# Sales pipeline — gap analysis and build plan

Against *HOW CUREOCITY SELLS*. Written after auditing the app; every "absent"
below was checked in code, not assumed.

---

## Part 1 — Where we are

The document is an analysis report that contains a specification: a 12-stage
pipeline and four named fixes. The app implements very little of it.

| Requirement | Status |
|---|---|
| Pipeline stages | **Mismatch** — 7 in app vs 12 in doc |
| Book an assessment for a lead | **Absent** — structurally impossible today |
| Assessment completed → sales handoff | **Absent** — the doc's stated money leak |
| Structured loss reason | **Partial** — `leads.objection` exists, never required |
| Follow-up date on a lead | **Absent** — no such column |
| Contact attempts tracked | **Absent** — IVR is an inert stub |
| WhatsApp-first outreach | **Absent** — no click-to-WhatsApp anywhere |
| Channel conversion reporting | **Absent** — `source` never read in reports |
| Cold-lead automation | **Absent** — campaigns target clients only |
| Lead owner | **Weak** — `leads.fde` is free text, not a staff link |

### The structural blocker

`appointments.client_id` references `clients`. There is no `lead_id`. And
`convertLeadVerified` refuses to create a client without a package. So the
motion the document describes — *assess first, sell after* — cannot be
represented at all. `4-Visit/Trial` is a label with nothing behind it.

This is why the doc's Stage 7 ("this is where Cureocity currently loses money
due to no ownership") has no equivalent: we can't record that an assessment
happened for someone who isn't yet a paying client.

---

## Part 2 — Resolving the stage list

The document's list can't be implemented literally. It numbers 1–12 but skips
9, splits 6 into 6A/6B, and calls 12 a "parallel track, not linear". Three of
its entries aren't stages at all:

**6B and 11 are the same thing.** Both are "lost". A lead exits the pipeline
once; the distinction the doc draws (denied assessment vs didn't convert) is a
*reason*, not a stage. → one `Lost` stage with a structured reason.

**Stage 4 (Qualification: HOT/WARM/COLD) is a property, not a stage.** We
already compute it — `leadScore()` produces HOT/WARM/COOL/COLD from 7 signals,
and the Leads page filters on it. Making it a stage would double-encode: a lead
would be both "HOT" and "in Qualification", and the two would drift.

**Stage 5 (Lead Followup) and Stage 12 (Followups) are the same thing, and it's
an activity, not a stage.** A lead being followed up is a lead in *some* stage
with a scheduled callback. This is exactly gap #3 — the doc complains the
follow-up date is filled 17% of the time, when in our system the field doesn't
exist.

**Stage 9 is a numbering slip.**

### Proposed canonical stages — 9, not 12

| # | Stage | Means | Owner | Exit condition |
|---|---|---|---|---|
| 1 | `1-Captured` | In the system, untouched | CRE | first attempt made |
| 2 | `2-Contacted` | ≥1 outbound attempt, no reply yet | CRE | reply, or 3 attempts → Nurture/Lost |
| 3 | `3-Engaged` | Two-way conversation started | CRE | assessment booked, or nurture |
| 4 | `4-Nurture` | Interested, not ready now | CRE | has a callback date; re-enters at 3 |
| 5 | `5-Assessment booked` | Slot confirmed | CRE | attends, or no-show |
| 6 | `6-Assessment done` | Attended — **sales handoff** | Clinician → CRE | package sold or deferred |
| 7 | `7-Decision pending` | Asked for time / consulting family | CRE | won or lost |
| 8 | `8-Won` | Package sold | CRE | → client onboarding |
| 9 | `LOST` | Not converting, with a reason | CRE | terminal |

HOT / WARM / COOL / COLD stays as it is — a separate axis, already computed.

### Migration from the current 7

| Current | → | New | Note |
|---|---|---|---|
| `1-New Lead` | → | `1-Captured` | clean |
| `2-Discovery` | → | `3-Engaged` | a discovery call is two-way |
| `3-Product Match` | → | **needs your decision** | see below |
| `4-Visit/Trial` | → | `5-Assessment booked` | clean |
| `5-Close` | → | `8-Won` | clean |
| `6-Nurture` | → | `4-Nurture` | clean |
| `LOST` | → | `LOST` | clean |

**The one I can't decide for you:** `3-Product Match` currently holds leads
where a product has been discussed. That could mean still-in-conversation
(`3-Engaged`) or already-quoted-and-waiting (`7-Decision pending`). These are
very different for forecasting. Check what those leads actually are before we
migrate — it's a `select count(*) from leads where stage = '3-Product Match'`
and a look at their remarks.

Note also that `2-Contacted` has no equivalent in the current data. Every
existing lead lands in `1-Captured` or later; nothing will be in `2-Contacted`
until attempt tracking starts recording.

---

## Part 3 — Lead assessment booking

The requirement: **give a lead one Fitness Assessment and one Fitness Training
session as a paid-or-free experience, before they buy.**

### Schema

`appointments` gains a nullable `lead_id` alongside `client_id`, with a check
constraint that exactly one is set. A booking belongs to a lead *or* a client,
never both and never neither. On conversion, the lead's appointments carry over
to the new client so the history isn't orphaned.

`sessions` (the PT table) gains the same, for the training session.

### Entitlement

One assessment and one training session per lead, or the experience becomes a
way to train for free indefinitely. A small `lead_entitlements` view or a count
check at booking time — the constraint is cheap, the absence of it isn't.

### Why this unlocks Stage 6

Once an assessment can be booked against a lead and marked complete, Stage 6
becomes real, and with it the thing the document says is costing money: an
owned, timed prompt to close the sale after the assessment.

---

## Build plan

### Phase A — Stages and loss reasons *(no new tables)*
1. `lib/lead-stages.ts` — one canonical definition, replacing the three
   drifting copies (`leads/page.tsx`, `LeadControls.tsx`, `reports/page.tsx`).
2. Migration: rename stage values on existing rows.
3. Require a structured reason when setting `LOST`.
4. Update the Leads page filters and the reports funnel to the new stages.

*Blocked by:* your call on `3-Product Match`.

### Phase B — Lead bookings *(the structural fix)*
5. Migration: `appointments.lead_id`, `sessions.lead_id`, XOR check constraints,
   carry-over on conversion.
6. "Book experience session" on the lead detail page — assessment and training.
7. Entitlement guard: one of each per lead.
8. Stage auto-advances to `5-Assessment booked` on booking, `6-Assessment done`
   on completion.

### Phase C — The handoff *(the money leak)*
9. On assessment completion, create an owned task for the lead's CRE with a
   deadline, and notify them.
10. Surface "assessments done, not yet closed" as its own queue — the doc's
    stated blind spot.

### Phase D — Follow-up discipline
11. `leads.next_follow_up` date + owner, settable from the lead row.
12. Overdue follow-ups on the CRE's dashboard, and in the nightly sweep.
13. 3-attempt rule: track attempts, auto-move to Nurture or prompt for Lost.

### Phase E — Reach and reporting
14. Click-to-WhatsApp on every lead (`wa.me` link — no API needed for v1).
15. Conversion by source on the reports page; walk-in vs digital split.
16. Stage-to-stage drop-off percentages — the leak map the doc asks for.

### Phase F — Cold automation
17. Leads as a campaign audience; auto-nurture or auto-retire cold leads.

---

## Recommended order

A → B → C first. Those three are the document's actual thesis: the pipeline
doesn't match reality, you can't assess a lead, and nobody owns the sale after
the assessment. D and E are measurement — valuable, but they measure a process
that doesn't exist yet. F is last because automating a pipeline you haven't
fixed just moves leads through the wrong stages faster.

## Before Phase A starts

Two things need a human answer:

1. **What is `3-Product Match` actually?** Engaged, or quoted-and-waiting?
2. **Is the experience session free or paid?** It changes whether booking one
   needs an invoice, and whether "no-show" has a financial consequence worth
   recording.

And one thing worth confirming with whoever wrote the document: the 9-stage
list above is a deliberate simplification of their 12. If they intended
Qualification and Followup to be tracked as discrete stages rather than as a
tier and a callback date, that changes the design.
