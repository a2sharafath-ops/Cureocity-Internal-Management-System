export const COACH_PROGRAMME_STATUSES = [
  "Active", "Paused", "Completed", "Disengaged", "Clinically Transferred",
] as const;

export type CoachProgrammeStatus = (typeof COACH_PROGRAMME_STATUSES)[number];

export type CoachProgrammeLifecycle = {
  client_id: string;
  status: CoachProgrammeStatus;
  status_reason: string | null;
  effective_date: string | null;
  next_contact_date: string | null;
  next_contact_plan: string | null;
  changed_by_name: string | null;
  changed_by_role: string | null;
  updated_at: string | null;
};

export type CoachProgrammeLifecycleEvent = {
  id: string;
  client_id: string;
  // The first recorded Active programme has no prior lifecycle state.
  from_status: CoachProgrammeStatus | null;
  to_status: CoachProgrammeStatus;
  reason: string;
  effective_date: string;
  next_contact_date: string | null;
  next_contact_plan: string | null;
  actor_name: string;
  actor_role: string;
  created_at: string;
};

const TRANSITIONS: Record<CoachProgrammeStatus, CoachProgrammeStatus[]> = {
  Active: ["Paused", "Completed", "Disengaged", "Clinically Transferred"],
  Paused: ["Active", "Completed", "Disengaged", "Clinically Transferred"],
  Completed: ["Active"],
  Disengaged: ["Active", "Clinically Transferred"],
  "Clinically Transferred": ["Active"],
};

export function coachProgrammeTransitionAllowed(from: CoachProgrammeStatus, to: CoachProgrammeStatus) {
  return TRANSITIONS[from].includes(to);
}

export function coachProgrammeTransitionProblem(values: {
  from: CoachProgrammeStatus;
  to: unknown;
  initialising?: boolean;
  reason: unknown;
  effectiveDate: unknown;
  currentEffectiveDate?: unknown;
  nextContactDate: unknown;
  nextContactPlan: unknown;
  today: string;
}): string | null {
  const to = String(values.to) as CoachProgrammeStatus;
  if (!COACH_PROGRAMME_STATUSES.includes(to)) return "Choose a valid programme status.";
  const initialActiveProgramme = values.initialising === true && values.from === "Active" && to === "Active";
  if (!initialActiveProgramme && !coachProgrammeTransitionAllowed(values.from, to)) return `Programme cannot move from ${values.from} to ${to}.`;
  const reason = String(values.reason ?? "").trim();
  if (reason.length < 12) return "Record a transition reason of at least 12 characters.";
  if (reason.length > 1000) return "Keep the transition reason within 1,000 characters.";
  const effectiveDate = String(values.effectiveDate ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || effectiveDate > values.today) {
    return "Choose an effective date that is not in the future.";
  }
  const currentEffectiveDate = String(values.currentEffectiveDate ?? "");
  if (currentEffectiveDate && effectiveDate < currentEffectiveDate) {
    return `Choose an effective date on or after ${currentEffectiveDate}.`;
  }
  if (["Active", "Paused", "Disengaged"].includes(to)) {
    const nextContactDate = String(values.nextContactDate ?? "");
    const nextContactPlan = String(values.nextContactPlan ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextContactDate) || nextContactDate < values.today || nextContactDate < effectiveDate) {
      return "Choose a next-contact date that is not in the past.";
    }
    if (nextContactPlan.length < 12) return "Record a next-contact plan of at least 12 characters.";
    if (nextContactPlan.length > 1000) return "Keep the next-contact plan within 1,000 characters.";
  }
  return null;
}

export function coachProgrammeLifecycleSummary(events: Pick<CoachProgrammeLifecycleEvent, "from_status" | "to_status">[]) {
  return {
    transitions: events.length,
    disengaged: events.filter((event) => event.to_status === "Disengaged").length,
    reactivated: events.filter((event) => event.to_status === "Active" && event.from_status !== null && event.from_status !== "Active").length,
    paused: events.filter((event) => event.to_status === "Paused").length,
    completed: events.filter((event) => event.to_status === "Completed").length,
    transferred: events.filter((event) => event.to_status === "Clinically Transferred").length,
  };
}
