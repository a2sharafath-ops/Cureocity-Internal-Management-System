# Obligations refactor — rulings

Decided 09 Aug 2026, before `computeObligations()` was written.

The refactor plan called for parity — same results, one implementation. A full
read of the three engines found **23 places where they already disagree**, so
parity was impossible: where two engines answer differently there is no single
current behaviour to preserve. Each disagreement needed a ruling instead.

These are those rulings. Every one has a test pinning it in
`tests/obligations.test.ts`, so a later edit that quietly reopens one fails
loudly rather than drifting back.

---

## 1. An unpaid invoice is the front desk's problem immediately

**Was:** the client card showed it from day 0; the ops dashboard waited until
the invoice was 7 days old.

**Now:** shown as soon as it exists, on both.

The desk is who chases payment. Hiding an unpaid invoice from the people whose
job it is to collect, for the first week, is backwards — and the card was
already contradicting the dashboard in the meantime.

## 2. A cancelled session is not a booked session

**Was:** the client card excluded cancelled sessions; the clinical dashboard
counted them. A client whose only session was later cancelled got "no strength
sessions booked" on one screen and silence on the other.

**Now:** cancelled sessions never count. If the diary is empty, it is empty.

## 3. The blood chase covers every unsubmitted panel

**Was:** the card and the clinical dashboard chased only a Comprehensive
client's comprehensive panel. The ops dashboard chased any unsubmitted row.

**Now:** any unsubmitted panel, on any client, is chased.

This is also the fix for the dropped-panel bug: a client owing both a
Comprehensive and a BluePrint panel used to produce two flags sharing one
dedupe key, so the dashboard kept one and silently discarded the other. The key
now carries the panel.

## 4. Front Desk / Finance chase an unraised invoice

**Was:** the onboarding ladder on the client card chased the **Health Coach**
for "Invoice raised", while the ops dashboard chased **Front Desk / Finance**
for the same thing.

**Now:** Front Desk / Finance, everywhere. Money is the desk's.

## 5. "BluePrint not generated" is owned by the three clinicians AND the coach

**Was:** the client card chased the Health Coach; the clinical dashboard chased
the doctor, dietitian and trainer.

**Now:** all four — Doctor, Dietitian, Fitness Trainer **and** Health Coach.

The three clinicians each owe a sign-off and the report cannot be written
without them. The coach is the client's single point of contact and the person
who chases the other three, so leaving them off would have removed the one
person whose job is to make it happen.

## 6. Renewals appear on the front desk queue

**Was:** a package ending appeared only on that client's own card, so nobody
saw it unless they happened to open them.

**Now:** it reaches the ops dashboard as well.

## 7. The client card shows the whole picture

**Was:** open concerns, coach markers in the referral band, and the BluePrint
48-hour clock existed **only** on the dashboard. A client card could read
completely clean while that same client had five high-severity flags.

**Now:** the card shows them too.

Accepted cost: the card gets longer. One client should have one picture, and a
card that hides the urgent parts is worse than a long one.

## 8. "Due today" is not overdue

**Was:** every item treated overdue as strictly past the due date — except the
Day-2 diet explanation, which counted due-today as already open.

**Now:** overdue means the due date has passed. You have until the end of the
day, everywhere.

## 9. Deadlines are in the clinic's timezone

**Was:** the client card rendered SLA times in Asia/Kolkata, the dashboard in
UTC. A deadline at 02:00 IST on 13 Aug read "13 Aug 2:00 am" on one screen and
"12 Aug" on the other.

**Now:** Asia/Kolkata everywhere. It is one clinic, on one clock.

## 10. A completed appointment starts the deliverable clock

**Was:** the 24-hour diet-chart and workout-plan clocks read only
`consultations.completed_at`. A consultation recorded as a completed
*appointment* — which the "is this consult done?" test already accepts —
produced the obligation but no clock: no due date, never overdue.

**Now:** the appointment date starts the clock when no consultation timestamp
exists.

An obligation with no deadline is one nobody is ever late for, which is how
work sits untouched indefinitely.

---

## Not rulings, but fixed at the same time

- **Owner fallbacks.** The card showed unassigned deliverables with nobody to
  chase; the dashboard fell back to the discipline. The fallback now applies
  everywhere.
- **Deep links.** The card's diet-chart and workout links omitted `&client=`,
  landing the clinician on an unfiltered screen.
- **Hardcoded owner lists.** Two places inlined role arrays instead of using the
  constants in `lib/work-owners.ts` — the precise drift that file exists to
  prevent.
- **The Day-2 diet explanation reached no dashboard at all.** The ops queue
  subtracted it as coach-owned; the clinical queue never added a coach-owned
  version. Both assumed the other had it.
