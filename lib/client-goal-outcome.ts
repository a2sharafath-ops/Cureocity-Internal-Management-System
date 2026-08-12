export type ClientGoalOutcome = {
  id: string;
  goal_id: string;
  client_id: string;
  goal_name: string;
  achievement_rating: number;
  progress_note: string | null;
  support_requested: boolean;
  reporter_name: string;
  reported_at: string;
};

export type ClientGoalOutcomeInput = {
  rating: number;
  note: string | null;
  supportRequested: boolean;
};

export function clientGoalOutcomeFromValues(values: {
  rating: unknown;
  note: unknown;
  supportRequested: unknown;
}): { outcome: ClientGoalOutcomeInput | null; error: string | null } {
  const ratingText = String(values.rating ?? "").trim();
  const rating = ratingText ? Number(ratingText) : Number.NaN;
  if (!Number.isInteger(rating) || rating < 0 || rating > 10) {
    return { outcome: null, error: "Choose a progress rating from 0 to 10." };
  }
  const note = String(values.note ?? "").trim();
  if (note.length > 1000) {
    return { outcome: null, error: "Keep the progress note within 1,000 characters." };
  }
  return {
    outcome: {
      rating,
      note: note || null,
      supportRequested: values.supportRequested === true || values.supportRequested === "on" || values.supportRequested === "true",
    },
    error: null,
  };
}

export function clientGoalOutcomeSummary(outcomes: Pick<ClientGoalOutcome, "achievement_rating" | "support_requested">[]) {
  return {
    total: outcomes.length,
    averageRating: outcomes.length
      ? Math.round((outcomes.reduce((sum, outcome) => sum + outcome.achievement_rating, 0) / outcomes.length) * 10) / 10
      : null,
    supportRequested: outcomes.filter((outcome) => outcome.support_requested).length,
  };
}
