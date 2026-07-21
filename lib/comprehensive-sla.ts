// Every Comprehensive commitment for one client, as clocks.
//
// Two shapes, and they behave differently:
//
//   TURNAROUNDS are windows from an event — 24h from an appointment
//   completing, 48h from the last of three. They can't start until the event
//   happens, so before that they read `waiting`, not `overdue`.
//
//   MILESTONES are calendar dates — day 10, 21, 28 from the package start,
//   repeated per cycle. They exist from day 0 and simply come due.
//
// Everything pauses on a client-side hold. Nothing is inferred from absence:
// the prescription clock runs only when the doctor said one was needed,
// because "no prescription" and "forgotten prescription" look identical
// otherwise.

import {
  clock, dateClock, formatLeft, SLA_TONE, NO_HOLD,
  type Clock, type Hold,
} from "@/lib/sla-clock";
import {
  SIGNOFF_MS, CONSOLIDATED_MS, DIET_DRAFT_MS, WORKOUT_PLAN_MS, PRESCRIPTION_MS,
  PT_SESSIONS_PER_CYCLE, DISCIPLINE_KINDS, KIND_LABEL,
  milestoneDates, ptDeadline, cyclesFor,
  type DisciplineKind, type DatedMilestone,
} from "@/lib/comprehensive";

export { formatLeft, SLA_TONE };

export type ConsultRow = {
  kind: string;
  completedAt: string | null;
  approvedAt: string | null;
  /** doctor's answer; only meaningful on a Doctor consult */
  prescriptionNeeded?: boolean | null;
};

export type ComprehensiveInput = {
  /** care_protocols.start_date — anchors every milestone */
  startDate: string;
  /** package validity in days; decides how many 28-day cycles run */
  validityDays?: number | null;
  consults: ConsultRow[];
  /** care_protocols consolidated gates */
  consolidatedAt: string | null;
  approvedAt: string | null;
  /** diet_charts.drafted_at — earliest draft for this client */
  dietDraftedAt: string | null;
  /** client_workouts — earliest plan of at least a week */
  workoutPlannedAt: string | null;
  /** prescriptions.shared_at — when it reached the portal */
  prescriptionSharedAt: string | null;
  /** completed sessions and their dates, for the 12-in-4-weeks commitment */
  sessionsCompleted: number;
  /** appointments that actually happened, for milestone matching */
  appointments: { type: string | null; date: string | null; status: string }[];
  hold?: Hold;
};

export type Gate = {
  /** stable key, unique per client — what the SLA ledger dedupes on */
  gate: string;
  label: string;
  /** which discipline owes it */
  owner: "doctor" | "dietitian" | "trainer" | "coach";
  clock: Clock;
};

export type ComprehensiveReport = {
  turnarounds: Gate[];
  milestones: Gate[];
  /** null until all three initial appointments are complete */
  lastInitialAt: string | null;
  missed: boolean;
  needsAttention: boolean;
  onHold: boolean;
  cycles: number;
};

const OWNER_OF: Record<DisciplineKind, "doctor" | "dietitian" | "trainer"> = {
  Doctor: "doctor", Diet: "dietitian", Trainer: "trainer",
};

export function comprehensiveSla(
  input: ComprehensiveInput,
  now: number = Date.now(),
): ComprehensiveReport {
  const hold = input.hold ?? NO_HOLD;
  const cycles = cyclesFor(input.validityDays);
  const turnarounds: Gate[] = [];

  /** Most recent completed consult of a kind — a repeat consult restarts that
   *  discipline's clock, which is the intent: the sign-off owed is for the
   *  latest piece of work. */
  const latest = (kind: DisciplineKind): ConsultRow | null =>
    input.consults
      .filter((c) => c.kind === kind && c.completedAt)
      .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)))[0] ?? null;

  // ---- 24h sign-offs -------------------------------------------------------
  for (const kind of DISCIPLINE_KINDS) {
    const c = latest(kind);
    turnarounds.push({
      gate: `signoff:${kind}`,
      label: `${KIND_LABEL[kind]} summary sign-off`,
      owner: OWNER_OF[kind],
      clock: clock(c?.completedAt ?? null, c?.approvedAt ?? null, SIGNOFF_MS, now, hold),
    });
  }

  // ---- 48h consolidated summary -------------------------------------------
  // Starts at the LAST of the three, because the consolidated summary can't be
  // written until all three have happened. Starting earlier would set a
  // deadline that was already impossible when it was set.
  const completions = DISCIPLINE_KINDS.map((k) => latest(k)?.completedAt ?? null);
  const lastInitialAt = completions.every(Boolean)
    ? completions.slice().sort().reverse()[0]
    : null;
  const deliveredAt = input.approvedAt
    ? (input.consolidatedAt && input.consolidatedAt > input.approvedAt
        ? input.consolidatedAt : input.approvedAt)
    : null;
  turnarounds.push({
    gate: "consolidated",
    label: "Consolidated summary approved",
    owner: "doctor",
    clock: clock(lastInitialAt, deliveredAt, CONSOLIDATED_MS, now, hold),
  });

  // ---- 24h diet chart draft ------------------------------------------------
  const diet = latest("Diet");
  turnarounds.push({
    gate: "diet_draft",
    label: "Diet chart drafted",
    owner: "dietitian",
    clock: clock(diet?.completedAt ?? null, input.dietDraftedAt, DIET_DRAFT_MS, now, hold),
  });

  // ---- 24h workout plan ----------------------------------------------------
  const fit = latest("Trainer");
  turnarounds.push({
    gate: "workout_plan",
    label: "One-week workout plan",
    owner: "trainer",
    clock: clock(fit?.completedAt ?? null, input.workoutPlannedAt, WORKOUT_PLAN_MS, now, hold),
  });

  // ---- 24h prescription delivery ------------------------------------------
  // Only when the doctor said one was needed. `prescriptionNeeded !== true`
  // leaves the clock `waiting` forever, which is correct — there is nothing
  // owed. A null (unanswered) reads the same as a no; the answer being missing
  // is a data-quality problem, not an SLA breach.
  const rxNeeded = latest("Doctor")?.prescriptionNeeded === true;
  turnarounds.push({
    gate: "prescription",
    label: "Prescription to client portal",
    owner: "doctor",
    clock: rxNeeded
      ? clock(latest("Doctor")?.completedAt ?? null, input.prescriptionSharedAt, PRESCRIPTION_MS, now, hold)
      : { status: "waiting", dueAt: null, msLeft: null, missed: false },
  });

  // ---- calendar milestones -------------------------------------------------
  const done = (m: DatedMilestone): string | null => {
    // A milestone counts as met by the first completed appointment of the
    // right type that falls on or after it became bookable.
    const hit = input.appointments
      .filter((a) => a.status === "completed" && a.type === m.apptType && a.date && a.date >= m.fromDate)
      .map((a) => a.date!)
      .sort()[0];
    return hit ? `${hit}T12:00:00Z` : null;
  };

  const milestones: Gate[] = milestoneDates(input.startDate, cycles).map((m) => ({
    gate: `milestone:${m.gate}`,
    label: cycles > 1 ? `${m.label} (cycle ${m.cycle})` : m.label,
    owner: m.owner,
    clock: dateClock(m.dueDate, done(m), now, hold),
  }));

  // ---- 12 strength sessions per cycle -------------------------------------
  for (let c = 1; c <= cycles; c++) {
    const target = PT_SESSIONS_PER_CYCLE * c;
    milestones.push({
      gate: cycles > 1 ? `pt_block#${c}` : "pt_block",
      label: cycles > 1 ? `${target} strength sessions (cycle ${c})` : `${target} strength sessions`,
      owner: "trainer",
      clock: dateClock(
        ptDeadline(input.startDate, c),
        input.sessionsCompleted >= target ? new Date(now).toISOString() : null,
        now, hold,
      ),
    });
  }

  const all = [...turnarounds, ...milestones].map((g) => g.clock);
  return {
    turnarounds,
    milestones: milestones.sort((a, b) => String(a.clock.dueAt).localeCompare(String(b.clock.dueAt))),
    lastInitialAt,
    missed: all.some((c) => c.missed),
    needsAttention: all.some((c) => c.status === "breached" || c.status === "due_soon"),
    onHold: Boolean(hold.holdSince),
    cycles,
  };
}

/** Roles to notify for a gate's owner. Mirrors ownsConsultKind. */
export const OWNER_ROLES: Record<Gate["owner"], string[]> = {
  doctor: ["Doctor"],
  dietitian: ["Dietitian"],
  trainer: ["Fitness Trainer"],
  coach: ["Health Coach"],
};
