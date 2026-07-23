// The Personal Training (PT) package protocol — the trainer-only track.
//
// PT is Comprehensive minus the medical/diet side: no blood panel, no doctor or
// dietitian, no consolidated report. What remains is the fitness spine —
// an initial assessment, twelve strength sessions per 28-day cycle, a mid-cycle
// reassessment, and a written plan. Kept in its own module so the trainer track
// has one source of truth, mirroring lib/comprehensive.ts.
//
// MILESTONES are calendar dates from the package start (the reassessment).
// DELIVERABLES are turnaround windows from an event (the workout plan, each
// session-summary sign-off). Both pause on a client-side hold.

import { HOUR } from "@/lib/sla-clock";

export const PT_CATEGORY = "training";

// ---- turnaround windows (deliverables) -------------------------------------

/** The trainer signs off their fitness-assessment summary within 24h. */
export const SIGNOFF_MS = 24 * HOUR;

/** Trainer writes at least a one-week plan within 24h of the fitness
 *  assessment completing. */
export const WORKOUT_PLAN_MS = 24 * HOUR;

/** All 12 strength sessions complete within the 28-day cycle. */
export const PT_SESSIONS_PER_CYCLE = 12;
export const CYCLE_DAYS = 28;

// ---- calendar milestones ---------------------------------------------------

export type Milestone = {
  key: string;
  label: string;
  owner: "trainer";
  /** earliest bookable, in days from package start */
  from: number;
  /** deadline, in days from package start */
  due: number;
  /** appointments.type to match when checking whether it happened */
  apptType: string;
};

/**
 * PT has a single milestone: the fitness reassessment, bookable at day 21 and
 * due by day 28 so the trainer can adjust the plan before the cycle rolls over.
 */
export const MILESTONES: Milestone[] = [
  { key: "reassess_28", label: "Fitness reassessment", owner: "trainer", from: 21, due: 28, apptType: "Fitness Services" },
];

/** The one initial booking at day 0. The 12 strength sessions are prompted
 *  separately (front desk picks times), never auto-scheduled. */
export const INITIAL_BOOKINGS = [
  { key: "trainer", label: "Book initial fitness assessment", apptType: "Fitness Services", consultKind: "Trainer" },
] as const;

export const PT_BOOKING_LABEL = "Book 12 strength sessions";

/** How long front desk has to get the initial bookings into the diary. */
export const BOOKING_DUE_DAYS = 2;

// ---- date helpers ----------------------------------------------------------

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * How many 28-day cycles a PT package runs. pt4 = 12 sessions / 28 days = 1
 * cycle; pt12 = 36 sessions / 84 days = 3 cycles, so the reassessment recurs
 * every cycle rather than once at the start of a 12-week block.
 */
export function cyclesFor(validityDays: number | null | undefined): number {
  const v = Number(validityDays ?? CYCLE_DAYS);
  return Math.max(1, Math.round(v / CYCLE_DAYS));
}

export type DatedMilestone = Milestone & {
  cycle: number;          // 1-based
  fromDate: string;
  dueDate: string;
  /** unique per cycle so the sweep can dedupe per occurrence */
  gate: string;
};

/** Every milestone date for a client, anchored on the package start and
 *  repeated once per cycle. */
export function milestoneDates(startISO: string, cycles = 1): DatedMilestone[] {
  const out: DatedMilestone[] = [];
  for (let c = 0; c < Math.max(1, cycles); c++) {
    const base = c * CYCLE_DAYS;
    for (const m of MILESTONES) {
      out.push({
        ...m,
        cycle: c + 1,
        fromDate: addDaysISO(startISO, base + m.from),
        dueDate: addDaysISO(startISO, base + m.due),
        gate: cycles > 1 ? `${m.key}#${c + 1}` : m.key,
      });
    }
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Deadline for finishing the cycle's strength sessions. */
export function ptDeadline(startISO: string, cycle = 1): string {
  return addDaysISO(startISO, cycle * CYCLE_DAYS);
}

/**
 * A milestone is bookable once `fromDate` arrives and no appointment of its
 * type has landed since (scheduled or completed).
 */
export function bookableNow(
  m: DatedMilestone,
  today: string,
  appointments: { type: string | null; date: string | null; status: string }[],
): boolean {
  if (today < m.fromDate) return false;
  const satisfied = appointments.some(
    (a) => a.type === m.apptType && a.date && a.date >= m.fromDate &&
      (a.status === "completed" || a.status === "scheduled"),
  );
  return !satisfied;
}

/** Task title for a milestone booking. Matched on to avoid duplicates, so
 *  don't reword without a data migration. */
export function bookingTaskTitle(m: DatedMilestone, clientName: string): string {
  return `Book ${m.label.toLowerCase()} — ${clientName}`;
}
