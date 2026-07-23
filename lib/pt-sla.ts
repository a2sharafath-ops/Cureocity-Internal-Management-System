// Every PT commitment for one client, as clocks — the trainer-track counterpart
// of comprehensive-sla.ts, trimmed to the fitness spine.
//
//   TURNAROUNDS (from an event): the trainer's summary sign-off and the
//   one-week workout plan, each 24h from the fitness assessment completing.
//
//   MILESTONES (calendar): the day-28 fitness reassessment and the 12 strength
//   sessions per cycle.
//
// Everything pauses on a client-side hold.

import {
  clock, dateClock, formatLeft, SLA_TONE, NO_HOLD,
  type Clock, type Hold,
} from "@/lib/sla-clock";
import {
  SIGNOFF_MS, WORKOUT_PLAN_MS, PT_SESSIONS_PER_CYCLE,
  milestoneDates, ptDeadline, cyclesFor,
  type DatedMilestone,
} from "@/lib/pt";

export { formatLeft, SLA_TONE };

export type PtInput = {
  startDate: string;
  validityDays?: number | null;
  /** latest completed fitness assessment + its sign-off time */
  fitnessCompletedAt: string | null;
  fitnessApprovedAt: string | null;
  /** client_workouts — earliest plan of at least a week */
  workoutPlannedAt: string | null;
  sessionsCompleted: number;
  appointments: { type: string | null; date: string | null; status: string }[];
  hold?: Hold;
};

export type Gate = { gate: string; label: string; owner: "trainer"; clock: Clock };

export type PtReport = {
  turnarounds: Gate[];
  milestones: Gate[];
  missed: boolean;
  needsAttention: boolean;
  onHold: boolean;
  cycles: number;
};

export function ptSla(input: PtInput, now: number = Date.now()): PtReport {
  const hold = input.hold ?? NO_HOLD;
  const cycles = cyclesFor(input.validityDays);

  const turnarounds: Gate[] = [
    {
      gate: "signoff:Trainer",
      label: "Fitness assessment summary sign-off",
      owner: "trainer",
      clock: clock(input.fitnessCompletedAt, input.fitnessApprovedAt, SIGNOFF_MS, now, hold),
    },
    {
      gate: "workout_plan",
      label: "One-week workout plan",
      owner: "trainer",
      clock: clock(input.fitnessCompletedAt, input.workoutPlannedAt, WORKOUT_PLAN_MS, now, hold),
    },
  ];

  // A reassessment counts as met by the first completed fitness appointment on
  // or after it became bookable.
  const done = (m: DatedMilestone): string | null => {
    const hit = input.appointments
      .filter((a) => a.status === "completed" && a.type === m.apptType && a.date && a.date >= m.fromDate)
      .map((a) => a.date!)
      .sort()[0];
    return hit ? `${hit}T12:00:00Z` : null;
  };

  const milestones: Gate[] = milestoneDates(input.startDate, cycles).map((m) => ({
    gate: `milestone:${m.gate}`,
    label: cycles > 1 ? `${m.label} (cycle ${m.cycle})` : m.label,
    owner: "trainer",
    clock: dateClock(m.dueDate, done(m), now, hold),
  }));

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
    missed: all.some((c) => c.missed),
    needsAttention: all.some((c) => c.status === "breached" || c.status === "due_soon"),
    onHold: Boolean(hold.holdSince),
    cycles,
  };
}
