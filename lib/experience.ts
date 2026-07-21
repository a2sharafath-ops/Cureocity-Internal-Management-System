// Free experience sessions — the pre-sale trial a lead gets before buying.
//
// Two things, once each per lead:
//   • a Fitness Assessment (an `appointments` row — a booked consultation)
//   • a Fitness Training session (a `sessions` row — an actual workout)
//
// Free, so there's no invoice and no payment state. A no-show costs a slot,
// not money: worth recording, not worth chasing.
//
// The one-each limit is enforced in the database by partial unique indexes
// (0080), not here. This file decides what to *offer*; the index decides what
// is *possible*. Both, because a UI that offers a button which then errors is
// worse than one that greys it out — and a limit that lives only in the UI
// isn't a limit.

/** `appointments.type` for the trial assessment. Matches the value the
 *  Comprehensive milestones already use, so a lead who converts keeps a
 *  consistent history. */
export const EXPERIENCE_ASSESSMENT_TYPE = "Fitness Services";

export const EXPERIENCE_ASSESSMENT_TITLE = "Free fitness assessment";
export const EXPERIENCE_TRAINING_TITLE = "Free trial training session";

/** Experience sessions sit outside any numbered plan. seq 0 keeps them clear
 *  of a real 12-session block if the lead later buys one. */
export const EXPERIENCE_SEQ = 0;

export type ExperienceKind = "assessment" | "training";

export type ExperienceRow = {
  kind: ExperienceKind;
  id: string;
  date: string | null;
  hour: number | null;
  status: string;
  providerName?: string | null;
};

export type ExperienceState = {
  assessment: ExperienceRow | null;
  training: ExperienceRow | null;
  /** what front desk is still allowed to book */
  canBookAssessment: boolean;
  canBookTraining: boolean;
  /** both booked and both attended — the lead has had the full experience */
  completed: boolean;
  /** any booking exists at all */
  any: boolean;
};

/**
 * What this lead has used and what's still available.
 *
 * A cancelled booking does NOT consume the entitlement — the lead never got
 * the thing. A no-show does: they were given the slot and didn't come, and
 * letting no-shows rebook indefinitely is how a free trial becomes free
 * training. That asymmetry is deliberate; front desk can always cancel a
 * no-show to give someone a second chance, which keeps the judgement with a
 * human rather than in a rule.
 */
export function experienceState(
  appointments: { id: string; type: string | null; date: string | null; hour: number | null; status: string; is_experience?: boolean | null; providerName?: string | null }[],
  sessions: { id: string; date: string | null; hour: number | null; status: string; is_experience?: boolean | null; providerName?: string | null }[],
): ExperienceState {
  const live = (s: string) => s !== "cancelled";

  const a = appointments.find(
    (x) => x.is_experience && x.type === EXPERIENCE_ASSESSMENT_TYPE && live(x.status),
  );
  const t = sessions.find((x) => x.is_experience && live(x.status));

  const assessment: ExperienceRow | null = a
    ? { kind: "assessment", id: a.id, date: a.date, hour: a.hour, status: a.status, providerName: a.providerName ?? null }
    : null;
  const training: ExperienceRow | null = t
    ? { kind: "training", id: t.id, date: t.date, hour: t.hour, status: t.status, providerName: t.providerName ?? null }
    : null;

  return {
    assessment,
    training,
    canBookAssessment: !assessment,
    canBookTraining: !training,
    completed: assessment?.status === "completed" && training?.status === "completed",
    any: Boolean(assessment || training),
  };
}

/** One-line summary for a lead row or card. */
export function experienceLabel(s: ExperienceState): string {
  if (!s.any) return "No experience session booked";
  if (s.completed) return "Experience complete — assessment and training done";
  const bits: string[] = [];
  if (s.assessment) bits.push(`assessment ${s.assessment.status}`);
  else bits.push("assessment not booked");
  if (s.training) bits.push(`training ${s.training.status}`);
  else bits.push("training not booked");
  return bits.join(" · ");
}
