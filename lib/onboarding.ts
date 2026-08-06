// One place to reason about "where is this client in onboarding, and what's
// next" — across all four package journeys. Pure: the page aggregates the raw
// data per client and hands it here; this turns it into an ordered checklist,
// the current step, and the single next action (with a deep link where one
// exists). Keeps the four journeys legible for ops roles who don't live in the
// clinical screens.

export type ConsultState = { scheduled: boolean; completed: boolean; assignedName?: string | null; apptId?: string | null };

export type Assignment = { discipline: string; name: string | null };

export type ClientInput = {
  clientId: string;
  clientName: string;
  category: string;          // blueprint | comprehensive | training | membership | other
  packageName: string;
  ownerName: string | null;
  assignments?: Assignment[];   // care team, per discipline
  hasInvoice: boolean;
  bloodRequested: boolean;
  bloodSubmitted: boolean;
  doctor: ConsultState;
  diet: ConsultState;
  trainer: ConsultState;
  /** Comprehensive only, and exactly once per package. */
  psych?: ConsultState;
  blueprintGenerated: boolean;
  sessionScheduled: boolean;
};

export type Action = { cta: string; href: string };
export type Step = {
  label: string; done: boolean; action?: Action; cancelApptId?: string;
  repairClientId?: string; booked?: boolean;
  /** The appointment category this step books, when it books one. Lets the
   *  caller look the service's `day_offset` up in the catalogue and date the
   *  step, rather than this module hard-coding a deadline the clinic owns. */
  bookCategory?: string;
  /** Offered, not owed. An optional step never carries a due date, never
   *  counts toward "3 of 4 done", and is never the client's next action —
   *  otherwise onboarding would read as incomplete forever for the clients who
   *  simply don't want it. */
  optional?: boolean;
};

export type OnboardRow = {
  clientId: string;
  clientName: string;
  category: string;
  packageName: string;
  ownerName: string | null;
  assignments: Assignment[];
  steps: Step[];
  doneCount: number;
  total: number;
  complete: boolean;
  /** the first unfinished step, if any */
  nextLabel: string | null;
  next?: Action;
};

const enc = (s: string) => encodeURIComponent(s);

/** A consultation step: bookable (deep link) until scheduled, then it's the
 *  clinician's to complete. */
// Discipline (as used by the booking deep-link) → the services category the
// milestone engine matches on.
const DISC_CATEGORY: Record<string, string> = {
  Doctor: "Doctor Consultation",
  Dietitian: "Diet Consultation",
  "Fitness Trainer": "Fitness Services",
  Psychologist: "Counselling",
  "Health Coach": "Coaching",
};

function consultStep(label: string, c: ConsultState, disc: string, clientId: string): Step {
  if (c.completed) return { label: `${label} done${c.assignedName ? ` · ${c.assignedName}` : ""}`, done: true };
  // Booked and waiting on the clinician to conduct it — there's no ops "next
  // step" to open here, so we don't offer one (this board is for front-desk /
  // admin roles). Cancel stays, in case the booking was a mistake.
  if (c.scheduled) return {
    label: `${label} — booked${c.assignedName ? ` · ${c.assignedName}` : ""}`,
    done: false,
    booked: true, // scheduled & waiting on the clinician — not an open ops action
    cancelApptId: c.apptId ?? undefined,
  };
  return {
    label: `Book ${label.toLowerCase()}`, done: false,
    bookCategory: DISC_CATEGORY[disc],
    action: { cta: "Book", href: `/appointments?client=${clientId}&disc=${enc(disc)}` },
  };
}

function stepsFor(i: ClientInput): Step[] {
  const id = i.clientId;
  switch (i.category) {
    case "blueprint":
      return [
        { label: "Blood report requested", done: i.bloodRequested, action: { cta: "Request", href: "/blueprint" } },
        { label: "Blood report submitted", done: i.bloodSubmitted, action: { cta: "Chase", href: "/blueprint" } },
        consultStep("Doctor consultation", i.doctor, "Doctor", id),
        consultStep("Diet consultation", i.diet, "Dietitian", id),
        consultStep("Fitness assessment", i.trainer, "Fitness Trainer", id),
        { label: "BluePrint generated", done: i.blueprintGenerated, action: { cta: "Generate", href: "/blueprint" } },
      ];
    case "comprehensive":
      return [
        i.bloodRequested
          ? { label: "Blood panel requested", done: true }
          : { label: "Blood panel requested", done: false, repairClientId: id },
        consultStep("Doctor consultation", i.doctor, "Doctor", id),
        consultStep("Diet consultation", i.diet, "Dietitian", id),
        consultStep("Fitness assessment", i.trainer, "Fitness Trainer", id),
        { ...consultStep("Psychology consultation", i.psych ?? { scheduled: false, completed: false }, "Psychologist", id), optional: true },
        { label: "Strength sessions scheduled", done: i.sessionScheduled, action: { cta: "Schedule", href: `/clients/${id}` } },
      ];
    case "training":
      return [
        consultStep("Fitness assessment", i.trainer, "Fitness Trainer", id),
        { label: "12 sessions scheduled", done: i.sessionScheduled, action: { cta: "Schedule", href: `/clients/${id}` } },
      ];
    case "membership":
      return [
        { label: "Package sold", done: true },
        { label: "Invoice raised", done: i.hasInvoice, action: { cta: "Raise invoice", href: `/clients/${id}` } },
      ];
    default:
      return [
        { label: "Package sold", done: true },
        { label: "Invoice raised", done: i.hasInvoice, action: { cta: "Raise invoice", href: `/clients/${id}` } },
      ];
  }
}

export function onboardingRow(i: ClientInput): OnboardRow {
  const steps = stepsFor(i);
  // Completion is measured over the REQUIRED steps only. Counting an optional
  // consultation would leave every client who declines it permanently at
  // "4 of 5", which reads as a failure by the clinic rather than a choice by
  // the client.
  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;
  const firstOpen = required.find((s) => !s.done);
  return {
    clientId: i.clientId,
    clientName: i.clientName,
    category: i.category,
    packageName: i.packageName,
    ownerName: i.ownerName,
    assignments: i.assignments ?? [],
    steps,
    doneCount,
    total: required.length,
    complete: doneCount === required.length,
    nextLabel: firstOpen?.label ?? null,
    next: firstOpen?.action,
  };
}

export const CATEGORY_LABEL: Record<string, string> = {
  blueprint: "BluePrint", comprehensive: "Comprehensive", training: "PT", membership: "Membership", other: "Other",
};
