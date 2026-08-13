import type { AdherenceOutcome } from "@/lib/coach-goals";
import { clientGoalOutcomeSummary } from "@/lib/client-goal-outcome";
import { coachProgrammeLifecycleSummary, type CoachProgrammeLifecycleEvent } from "@/lib/coach-programme-lifecycle";

export const COACH_AUDIT_DOMAINS = [
  { key: "assessment_completeness", label: "Assessment completeness", question: "Was the correct baseline module completed?" },
  { key: "measurement_quality", label: "Measurement quality", question: "Were validated tools used without modification?" },
  { key: "goal_quality", label: "Goal quality", question: "Is the goal observable and measurable?" },
  { key: "if_then_planning", label: "If–then planning", question: "Does the goal contain a cue/action plan?" },
  { key: "scope_compliance", label: "Scope compliance", question: "Did the coach remain within scope?" },
  { key: "referral_quality", label: "Referral quality", question: "Was a referral made when the recorded rule triggered?" },
  { key: "safety", label: "Safety", question: "Was every safety event escalated according to protocol?" },
  { key: "documentation", label: "Documentation", question: "Are the required session fields complete?" },
  { key: "mdt_coordination", label: "MDT coordination", question: "Were relevant issues communicated and owned?" },
  { key: "client_experience", label: "Client experience", question: "Was the language collaborative and non-judgemental?" },
] as const;

export type CoachAuditDomain = (typeof COACH_AUDIT_DOMAINS)[number]["key"];
export type CoachAuditRating = "Met" | "Not met" | "Not applicable";
export type CoachAuditRatings = Record<CoachAuditDomain, CoachAuditRating>;

export type RateMetric = { met: number; total: number; percent: number | null };

export type CoachQualityInput = {
  clientCount: number;
  appointments: { status: string }[];
  followups: { status: string; no_answer: boolean }[];
  goals: { name: string; cadence: string; target_per_week: number; status: string; if_then_plan: string | null }[];
  adherenceCurrent: { outcome: AdherenceOutcome }[];
  adherencePrevious: { outcome: AdherenceOutcome }[];
  clientGoalOutcomes: { goal_id: string; achievement_rating: number; support_requested: boolean; reported_at: string }[];
  programmeLifecycleEvents: Pick<CoachProgrammeLifecycleEvent, "from_status" | "to_status">[];
  barriers: { status: string }[];
  referrals: { status: string }[];
  safetyEvents: { opened_at: string; acknowledged_at: string | null }[];
  mdtTasks: { status: string }[];
  baselines: { status: string }[];
  assessments: { instrument_version: string | null; administration_mode: string | null }[];
  sessions: { status: string; completion_percent: number }[];
  huddles: { id: string }[];
  huddleTaskIds: string[];
};

export type CoachQualityMetrics = {
  scheduledCheckins: RateMetric;
  responseRate: RateMetric;
  goalCompletion: RateMetric;
  clientReportedProgress: { averageRating: number | null; total: number; supportRequested: number };
  programmeLifecycle: { transitions: number; disengaged: number; reactivated: number; paused: number; completed: number; transferred: number };
  adherence: RateMetric & { previousPercent: number | null; change: number | null };
  ifThenPlanning: RateMetric;
  barriersAddressed: RateMetric;
  referralCompletion: RateMetric;
  safetyAcknowledgement: RateMetric & { averageMinutes: number | null };
  mdtClosure: RateMetric;
  baselineCompleteness: RateMetric;
  measurementQuality: RateMetric;
  goalQuality: RateMetric;
  documentation: RateMetric;
  mdtCoordination: RateMetric;
};

export type CoachPracticeAction = {
  key: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
};

export function rate(met: number, total: number): RateMetric {
  return { met, total, percent: total ? Math.round((met / total) * 100) : null };
}

function adherenceRate(events: { outcome: AdherenceOutcome }[]) {
  const reviewed = events.filter((event) => event.outcome !== "Excused");
  return rate(reviewed.filter((event) => event.outcome === "Completed").length, reviewed.length);
}

export function calculateCoachQuality(input: CoachQualityInput): CoachQualityMetrics {
  const appointments = input.appointments.filter((row) => row.status !== "cancelled");
  const knownContacts = input.followups.filter((row) => row.status === "done" || row.no_answer);
  const currentGoals = input.goals.filter((goal) => goal.status !== "Stopped");
  const goalQuality = currentGoals.filter((goal) =>
    Boolean(goal.name.trim() && goal.cadence.trim() && goal.target_per_week >= 1 && goal.target_per_week <= 7),
  );
  const referrals = input.referrals.filter((referral) => referral.status !== "Cancelled");
  const tasks = input.mdtTasks.filter((task) => task.status !== "Cancelled");
  const currentAdherence = adherenceRate(input.adherenceCurrent);
  const previousAdherence = adherenceRate(input.adherencePrevious);
  const acknowledged = input.safetyEvents.filter((event) => event.acknowledged_at);
  const acknowledgementMinutes = acknowledged.map((event) =>
    Math.max(0, Math.round((Date.parse(event.acknowledged_at!) - Date.parse(event.opened_at)) / 60_000)),
  );
  const huddleTaskIds = new Set(input.huddleTaskIds);
  const latestClientGoalOutcomes = new Map<string, (typeof input.clientGoalOutcomes)[number]>();
  for (const outcome of input.clientGoalOutcomes) {
    const current = latestClientGoalOutcomes.get(outcome.goal_id);
    if (!current || outcome.reported_at > current.reported_at) latestClientGoalOutcomes.set(outcome.goal_id, outcome);
  }

  return {
    scheduledCheckins: rate(appointments.filter((row) => row.status === "completed").length, appointments.length),
    responseRate: rate(knownContacts.filter((row) => row.status === "done").length, knownContacts.length),
    goalCompletion: rate(currentGoals.filter((goal) => goal.status === "Completed").length, currentGoals.length),
    clientReportedProgress: clientGoalOutcomeSummary([...latestClientGoalOutcomes.values()]),
    programmeLifecycle: coachProgrammeLifecycleSummary(input.programmeLifecycleEvents),
    adherence: {
      ...currentAdherence,
      previousPercent: previousAdherence.percent,
      change: currentAdherence.percent == null || previousAdherence.percent == null
        ? null : currentAdherence.percent - previousAdherence.percent,
    },
    ifThenPlanning: rate(currentGoals.filter((goal) => Boolean(goal.if_then_plan?.trim())).length, currentGoals.length),
    barriersAddressed: rate(input.barriers.filter((barrier) => ["Addressed", "Resolved"].includes(barrier.status)).length, input.barriers.length),
    referralCompletion: rate(referrals.filter((referral) => referral.status === "Completed").length, referrals.length),
    safetyAcknowledgement: {
      ...rate(acknowledged.length, input.safetyEvents.length),
      averageMinutes: acknowledgementMinutes.length
        ? Math.round(acknowledgementMinutes.reduce((sum, minutes) => sum + minutes, 0) / acknowledgementMinutes.length)
        : null,
    },
    mdtClosure: rate(tasks.filter((task) => task.status === "Completed").length, tasks.length),
    baselineCompleteness: rate(input.baselines.filter((baseline) => baseline.status === "Completed").length, input.clientCount),
    measurementQuality: rate(input.assessments.filter((assessment) =>
      Boolean(assessment.instrument_version && assessment.administration_mode
        && !/legacy/i.test(assessment.instrument_version)
        && !/legacy/i.test(assessment.administration_mode)),
    ).length, input.assessments.length),
    goalQuality: rate(goalQuality.length, currentGoals.length),
    documentation: rate(input.sessions.filter((session) => session.status === "Completed" && session.completion_percent === 100).length, input.sessions.filter((session) => session.status === "Completed").length),
    mdtCoordination: rate(input.huddles.filter((huddle) => huddleTaskIds.has(huddle.id)).length, input.huddles.length),
  };
}

/** Turn recorded caseload gaps into neutral, practical prompts for the coach. */
export function buildCoachPracticeActions(metrics: CoachQualityMetrics): CoachPracticeAction[] {
  const actions: CoachPracticeAction[] = [];
  const addGap = (
    key: string, metric: RateMetric, title: (open: number) => string,
    detail: string, href: string, cta: string,
  ) => {
    const open = metric.total - metric.met;
    if (open <= 0) return;
    actions.push({ key, title: title(open), detail, href, cta });
  };

  addGap(
    "checkins", metrics.scheduledCheckins,
    (open) => `${open} check-in${open === 1 ? "" : "s"} to close the loop on`,
    "Review today’s appointment outcome and record what happened.",
    "/workspace?role=coach&tab=appts", "Review check-ins",
  );
  addGap(
    "responses", metrics.responseRate,
    (open) => `${open} client${open === 1 ? "" : "s"} did not respond`,
    "Choose the next appropriate contact step without increasing message volume for its own sake.",
    "/workspace?role=coach&tab=followups", "Plan follow-up",
  );
  addGap(
    "goals", metrics.goalCompletion,
    (open) => `${open} current goal${open === 1 ? " is" : "s are"} still in progress`,
    "Use the next conversation to confirm that the goal is still realistic and meaningful to the client.",
    "/workspace?role=coach&tab=coaching", "Review goals",
  );
  addGap(
    "adherence", metrics.adherence,
    (open) => `${open} reviewed action${open === 1 ? " needs" : "s need"} support`,
    "Explore what got in the way and agree a smaller or better-timed next step.",
    "/workspace?role=coach&tab=coaching", "Explore barriers",
  );
  addGap(
    "barriers", metrics.barriersAddressed,
    (open) => `${open} recorded barrier${open === 1 ? " is" : "s are"} still open`,
    "Return to the barrier with the client and record the agreed response.",
    "/workspace?role=coach&tab=coaching", "Address barriers",
  );
  addGap(
    "referrals", metrics.referralCompletion,
    (open) => `${open} referral${open === 1 ? " needs" : "s need"} follow-through`,
    "Check whether the receiving clinician has acknowledged, scheduled or completed it.",
    "/workspace?role=coach&tab=coaching", "Check referrals",
  );
  addGap(
    "safety", metrics.safetyAcknowledgement,
    (open) => `${open} safety item${open === 1 ? " needs" : "s need"} acknowledgement`,
    "Open the safety record now and follow the escalation protocol.",
    "/workspace?role=coach&tab=coaching", "Open safety items",
  );
  addGap(
    "mdt", metrics.mdtClosure,
    (open) => `${open} MDT action${open === 1 ? " remains" : "s remain"} open`,
    "Confirm the owner, decision and next step with the care team.",
    "/workspace?role=coach&tab=board", "Open MDT board",
  );
  return actions;
}

export function auditReviewProblems(
  ratings: Partial<Record<CoachAuditDomain, string>>,
  overall: string,
  note: string,
): string[] {
  const valid = new Set<CoachAuditRating>(["Met", "Not met", "Not applicable"]);
  const missing: string[] = COACH_AUDIT_DOMAINS.filter((domain) => !valid.has(ratings[domain.key] as CoachAuditRating)).map((domain) => domain.label);
  if (!new Set(["Meets standard", "Needs coaching", "Clinical review required"]).has(overall)) missing.push("Overall result");
  if ((overall !== "Meets standard" || Object.values(ratings).includes("Not met")) && !note.trim()) missing.push("Reviewer note");
  return missing;
}
