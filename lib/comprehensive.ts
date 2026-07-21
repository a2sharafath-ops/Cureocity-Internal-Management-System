// The Comprehensive package care protocol — one definition, canonical.
//
// Three definitions of this protocol already existed and disagreed:
//   • services.day_offset (seeded, 9 rows, says fitness reassessment = day 21)
//   • DAY_PROTOCOL in lib/followups.ts (says day 2 is a *fitness* check-in)
//   • package_services (mapping only, no timing)
// None of them drove anything. This file is now the source of truth; the
// others should be read as data *about* services, not as the protocol.
//
// Two kinds of commitment live here and they behave differently:
//
//   MILESTONES are calendar dates — day 10, day 21, day 28 from the package
//   start. They're bookings that must happen by a date.
//
//   DELIVERABLES are turnaround windows — 24h from an event. They're work
//   that must be finished within a window of something else happening.
//
// Both pause on a client-side hold. Neither starts until its trigger fires.

import { DAY, HOUR } from "@/lib/sla-clock";

export const COMPREHENSIVE_CATEGORY = "comprehensive";

// ---- turnaround windows ----------------------------------------------------

/** Each clinician approves their own summary within 24h of their appointment
 *  completing. Same commitment as BluePrint. */
export const SIGNOFF_MS = 24 * HOUR;

/** Consolidated summary approved within 48h of the LAST of the three initial
 *  appointments completing. Comprehensive does NOT produce a BluePrint — the
 *  9-score document stays exclusive to the bp1 package. */
export const CONSOLIDATED_MS = 48 * HOUR;

/** Dietitian drafts the diet chart within 24h of the initial diet consult. */
export const DIET_DRAFT_MS = 24 * HOUR;

/** Trainer writes at least a one-week plan. The intent is "by the end of the
 *  first session"; where that has already passed, the deadline is 24h from the
 *  fitness assessment completing. Encoding the fallback rather than the intent
 *  keeps it measurable. */
export const WORKOUT_PLAN_MS = 24 * HOUR;

/** A prescription, when the doctor says one is needed, reaches the client
 *  portal within 24h of the doctor's appointment completing.
 *
 *  The clock only runs when the doctor answered YES on the consultation's
 *  `prescription_needed` toggle. Without that trigger the system cannot tell
 *  "no prescription was required" from "the doctor forgot", and would flag
 *  every healthy client as overdue. A recorded "no" is a fact; an absence
 *  isn't. */
export const PRESCRIPTION_MS = 24 * HOUR;

/** All 12 strength sessions complete within the 4-week cycle. */
export const PT_SESSIONS_PER_CYCLE = 12;
export const CYCLE_DAYS = 28;

// ---- calendar milestones ---------------------------------------------------

export type Milestone = {
  key: string;
  label: string;
  /** discipline that owns it — matches client_assignments.discipline */
  owner: "doctor" | "dietitian" | "trainer" | "coach";
  /** earliest the milestone becomes bookable, in days from package start */
  from: number;
  /** deadline, in days from package start */
  due: number;
  /** appointments.type to match when checking whether it happened */
  apptType: string;
};

/**
 * Ordered by deadline. `from` and `due` differ only for the fitness
 * reassessment: it becomes bookable at day 21 but must be finished by day 28,
 * *before* the doctor's month-end review, so the doctor has current numbers in
 * front of them. Everything else is a single date.
 */
export const MILESTONES: Milestone[] = [
  { key: "diet_10",     label: "Day 10 diet follow-up",     owner: "dietitian", from: 10, due: 10, apptType: "Diet Consultation" },
  { key: "diet_21",     label: "Day 21 diet review",        owner: "dietitian", from: 21, due: 21, apptType: "Diet Consultation" },
  { key: "reassess_28", label: "Fitness reassessment",      owner: "trainer",   from: 21, due: 28, apptType: "Fitness Services" },
  { key: "doctor_28",   label: "Day 28 doctor review",      owner: "doctor",    from: 28, due: 28, apptType: "Doctor Consultation" },
];

/** The three initial appointments booked at day 0. The coach is assigned but
 *  doesn't hold an initial consult — they schedule the diet chart explanation
 *  once the dietitian's draft exists. */
export const INITIAL_BOOKINGS = [
  { key: "doctor",    label: "Book initial doctor consultation",   apptType: "Doctor Consultation",  consultKind: "Doctor" },
  { key: "dietitian", label: "Book initial diet consultation",     apptType: "Diet Consultation",    consultKind: "Diet" },
  { key: "trainer",   label: "Book initial fitness assessment",    apptType: "Fitness Services",     consultKind: "Trainer" },
] as const;

/** Front desk also books the 12 strength sessions — prompted, not auto. The
 *  existing buildSessions() auto-scheduler hardcodes trainer "t0" at 9am on
 *  alternate days, which is why it isn't used here. */
export const PT_BOOKING_LABEL = "Book 12 strength sessions";

/** How long front desk has to get the initial bookings into the diary. Not a
 *  clinical SLA — the clinical clocks only start once an appointment
 *  completes — but it stops a sold package sitting untouched. */
export const BOOKING_DUE_DAYS = 2;

/** The blood panel for Comprehensive is a different set of reports from the
 *  BluePrint panel, so blood_requests carries a `panel` discriminator and a
 *  client can hold one of each. */
export const BLOOD_PANEL = "comprehensive";

export const DISCIPLINE_KINDS = ["Doctor", "Diet", "Trainer"] as const;
export type DisciplineKind = (typeof DISCIPLINE_KINDS)[number];

export const KIND_LABEL: Record<DisciplineKind, string> = {
  Doctor: "Doctor", Diet: "Dietitian", Trainer: "Trainer",
};

// ---- date helpers ----------------------------------------------------------

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * How many 28-day cycles a Comprehensive package runs.
 * comp4 = 12 sessions / 28 days = 1 cycle. comp12 = 36 sessions / 84 days =
 * the same rhythm three times over, so the full protocol repeats rather than
 * running once and leaving eight weeks of unstructured sessions.
 */
export function cyclesFor(validityDays: number | null | undefined): number {
  const v = Number(validityDays ?? CYCLE_DAYS);
  return Math.max(1, Math.round(v / CYCLE_DAYS));
}

export type DatedMilestone = Milestone & {
  cycle: number;          // 1-based
  fromDate: string;
  dueDate: string;
  /** unique per cycle, so the SLA ledger can dedupe per occurrence */
  gate: string;
};

/**
 * Every milestone date for a client, anchored on their package start date and
 * repeated once per cycle. Cycle 2 of a comp12 client gets its day-10 diet
 * follow-up at day 38, and so on.
 */
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
 * A milestone is bookable once `fromDate` arrives and no completed appointment
 * of its type has landed since. Front desk gets a task then, rather than at
 * day 0 — twelve booking prompts on the day someone buys comp12 would be
 * noise, and the day-77 one couldn't be actioned anyway.
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

/**
 * The day-28 doctor review should happen *after* the fitness reassessment, so
 * the doctor has current numbers. This reports the ordering problem rather
 * than blocking the booking — a clinic that needs to see the doctor first has
 * a reason, and a hard block would just get worked around.
 */
export function reassessmentOutOfOrder(
  startISO: string,
  cycles: number,
  appointments: { type: string | null; date: string | null; status: string }[],
): { cycle: number; doctorDate: string }[] {
  const out: { cycle: number; doctorDate: string }[] = [];
  for (const m of milestoneDates(startISO, cycles)) {
    if (m.key !== "doctor_28") continue;
    const doc = appointments.find(
      (a) => a.type === "Doctor Consultation" && a.date && a.date >= m.fromDate && a.status !== "cancelled",
    );
    if (!doc?.date) continue;
    const reassessDone = appointments.some(
      (a) => a.type === "Fitness Services" && a.status === "completed" &&
        a.date && a.date >= addDaysISO(startISO, (m.cycle - 1) * CYCLE_DAYS + 21) && a.date <= doc.date!,
    );
    if (!reassessDone) out.push({ cycle: m.cycle, doctorDate: doc.date });
  }
  return out;
}

export { DAY };
