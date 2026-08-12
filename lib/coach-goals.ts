export const BARRIER_CATEGORIES = [
  "Knowledge", "Skill", "Environment", "Time or routine", "Social support",
  "Motivation", "Confidence", "Symptoms", "Cost or access", "Other",
] as const;

export const ADHERENCE_CATEGORIES = [
  "Coaching goal", "Coach check-in", "Exercise plan", "Food logging",
  "Doctor follow-up", "Test or investigation",
] as const;

export type AdherenceOutcome = "Completed" | "Missed" | "Excused";

export function adherenceSummary(events: { outcome: AdherenceOutcome }[]) {
  const completed = events.filter((event) => event.outcome === "Completed").length;
  const missed = events.filter((event) => event.outcome === "Missed").length;
  const excused = events.filter((event) => event.outcome === "Excused").length;
  const reviewed = completed + missed;
  return {
    completed,
    missed,
    excused,
    reviewed,
    percent: reviewed ? Math.round((completed / reviewed) * 100) : null,
  };
}

export function confidenceNeedsSmallerGoal(confidence: number | null) {
  return confidence != null && confidence < 7;
}

export function reviewIsDue(reviewDate: string | null, today: string) {
  return Boolean(reviewDate && reviewDate <= today);
}

