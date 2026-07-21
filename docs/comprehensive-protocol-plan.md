# Comprehensive protocol — what's built, what's missing, and the order to build it

Status as of this session. The protocol you described has roughly four layers:
**kick-off** (day 0), **deliverables** (24h turnarounds after each appointment),
**milestones** (day 10/21/28 calendar), and **surfacing** (where staff and
clients actually see any of it). Layer 1 is done. Layers 2–4 are not.

---

## Done

| Piece | Where |
|---|---|
| Comprehensive blood panel requested on purchase | `lib/actions.ts` → `startComprehensiveJourney` |
| `blood_requests` made multi-panel so BluePrint + Comprehensive coexist | `supabase/0078` |
| Care team assigned incl. health coach (rotation) | `assignCareTeam` |
| 4 front-desk booking tasks: doctor, dietitian, trainer, 12 PT sessions | `startComprehensiveJourney` |
| `care_protocols` row — anchor date, consolidated gates, client hold | `supabase/0078` |
| Canonical protocol definition, replacing 3 that disagreed | `lib/comprehensive.ts` |
| Milestone calendar: day 10, 21, reassessment 21→28, doctor 28 | `MILESTONES` |
| Shared clock engine extracted from BluePrint | `lib/sla-clock.ts` |
| Follow-ups scoped to Comprehensive (was firing for every client) | `lib/followups.ts` |

**Not yet run:** migration `0078_comprehensive_protocol.sql`.

---

## Missing, in dependency order

### Phase 1 — Deliverable clocks (the core of your ask)

Nothing currently measures the 24h and 48h commitments for Comprehensive.
The engine exists; the evaluator does not.

1. **`lib/comprehensive-sla.ts`** — the evaluator. Per client:
   - three 24h clinician sign-off clocks (reuse the BluePrint shape)
   - one 48h consolidated summary clock, starting at the **last** of the three
     initial appointments completing
   - diet chart draft: 24h from initial diet consult completing
   - workout plan: 24h from fitness assessment completing
   - prescription delivery: 24h from doctor appointment completing, **only when
     the doctor indicated one is needed** — see open question below
   - four milestone clocks via `dateClock`

2. **`lib/cron/comprehensive-sla.ts`** — nightly sweep. Same shape as
   `blueprint-sla.ts`: load active protocols, run clocks, skip if on hold,
   dedupe via `blueprint_sla_events` (now carrying a `protocol` column), notify
   owner + escalate to management on breach.

3. **`toggleComprehensiveHold`** action — the client-delay pause, mirroring
   `toggleBlueprintHold`.

*Blocked by:* nothing. Migration 0078 must be run first.

### Phase 2 — The deliverables themselves

Each clock in Phase 1 measures something that must actually be recordable.
Two of the three are not.

4. **Prescription → client portal and client card.** Prescriptions exist
   (`prescriptions` + `prescription_items`, `supabase/0019_orders.sql`) and the
   portal RLS already permits client read. They render in exactly one place:
   the EMR chart. Not in the portal, not on the client card. This is UI-only —
   no schema work. `shared_at` was added in 0078 to mark delivery.

5. **Diet chart → client portal.** `diet_charts` is versioned and has an RLS
   policy allowing clients to read `status='Published'`. The portal never
   queries it. Also UI-only.

6. **Diet chart draft → explanation booking.** Once the dietitian saves a
   draft, the health coach needs a prompt to schedule the explanation session
   with client + dietitian. Currently nothing links the draft to a booking.

7. **Workout plan capture.** `client_workouts` exists and takes a jsonb
   `items` array. `plan_weeks` was added in 0078 so "at least one week" is
   checkable. Needs the trainer-facing form to set it, and the link back to
   the fitness assessment that started the clock.

*Blocked by:* Phase 1 defines what these need to record.

### Phase 3 — Milestone bookings

8. **Milestones become bookings, not just follow-up calls.** Today
   `followups` generates day 2/10/21/28 *call* rows. The protocol needs actual
   `appointments` for the day-10 and day-21 diet reviews, the fitness
   reassessment and the day-28 doctor review. Decide whether the follow-up row
   drives the booking (front desk calls, then books) or whether they're
   separate. The `followups.stage` pipeline already has a `BOOKED` state,
   which suggests the former was the intent.

9. **Reassessment-before-doctor enforcement.** `MILESTONES` encodes the
   ordering but nothing warns if the day-28 doctor review is booked and the
   reassessment isn't done. Should be a flag, not a hard block.

### Phase 4 — Surfacing

10. **`ComprehensiveProtocol` panel** — the client-card equivalent of
    `BlueprintSla`: every clock, the hold button, what's next. Probably lives
    on the client card and in the Quick drawer.

11. **Whiteboard + dashboard weighting** — breached Comprehensive commitments
    should raise a client onto the daily MDT board, same as
    `slaBreached` does for BluePrint.

12. **Clinician workspace queues** — "your sign-offs due today" for each
    discipline, so the 24h clock is visible to the person who owes it rather
    than only to management after it's breached.

---

## Open questions to settle before Phase 1

**How does the doctor signal a prescription is needed?** The 24h
prescription clock can't start otherwise. Options: a checkbox on the
consultation summary; infer from a `prescriptions` row existing in draft; or
treat every doctor appointment as requiring an explicit yes/no. Third is most
reliable, most friction.

**Does the 12-session PT block have its own schedule commitment?** You said
they must be scheduled at day 0, which is now a booking task. Unclear whether
there's a deadline for *completing* all 12 within the 28 days, or whether the
sessions simply run.

**comp4 vs comp12.** Two Comprehensive packages exist — 12 sessions/28 days
and 36 sessions/84 days. The protocol as described is a 28-day cycle. Does
comp12 run the same cycle three times, or a different protocol?

---

## Suggested order of work

Run migration 0078, then:

1. Settle the three open questions above — they change Phase 1's shape.
2. Phase 1 (clocks + sweep + hold). One sitting. This is the part you asked
   for and it's self-contained.
3. Phase 2 items 4 and 5 (prescription and diet chart into the portal). Small,
   high value, no schema work, and they're visible to clients immediately.
4. Phase 4 item 10 (the protocol panel), so you can actually see the clocks.
5. Everything else, informed by a real client running through the cycle.

**Recommendation:** do not build Phases 2–4 speculatively. Run one real
Comprehensive client through the cycle after Phase 1 and let the gaps show
themselves. The BluePrint protocol has been built for a while and has never
been exercised against a real client — repeating that pattern at three times
the scope would be a mistake.
