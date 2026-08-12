import type { AdherenceOutcome } from "@/lib/coach-goals";

export const COACH_AUDIT_DOMAINS = [
  { key: "assessment_completeness", label: "Assessment completeness", question: "Was the correct baseline module completed?", draftTarget: 95 },
  { key: "measurement_quality", label: "Measurement quality", question: "Were validated tools used without modification?", draftTarget: 100 },
  { key: "goal_quality", label: "Goal quality", question: "Is the goal observable and measurable?", draftTarget: 90 },
  { key: "if_then_planning", label: "If–then planning", question: "Does the goal contain a cue/action plan?", draftTarget: 90 },
  { key: "scope_compliance", label: "Scope compliance", question: "Did the coach remain within scope?", draftTarget: 100 },
  { key: "referral_quality", label: "Referral quality", question: "Was a referral made when the recorded rule triggered?", draftTarget: 100 },
  { key: "safety", label: "Safety", question: "Was every safety event escalated according to protocol?", draftTarget: 100 },
  { key: "documentation", label: "Documentation", question: "Are the required session fields complete?", draftTarget: 95 },
  { key: "mdt_coordination", label: "MDT coordination", question: "Were relevant issues communicated and owned?", draftTarget: 95 },
  { key: "client_experience", label: "Client experience", question: "Was the language collaborative and non-judgemental?", draftTarget: 90 },
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

  return {
    scheduledCheckins: rate(appointments.filter((row) => row.status === "completed").length, appointments.length),
    responseRate: rate(knownContacts.filter((row) => row.status === "done").length, knownContacts.length),
    goalCompletion: rate(currentGoals.filter((goal) => goal.status === "Completed").length, currentGoals.length),
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
