import { COACH_AUDIT_DOMAINS, type CoachAuditDomain } from "@/lib/coach-quality";

export const COACH_QUALITY_REVIEW_CADENCES = ["Monthly", "Quarterly", "Semiannual"] as const;
export type CoachQualityReviewCadence = (typeof COACH_QUALITY_REVIEW_CADENCES)[number];
export type CoachQualityTargets = Record<CoachAuditDomain, number>;

export type CoachQualityStandardStatus = "Draft" | "Approved" | "Retired";

export type CoachQualityStandard = {
  id: string;
  version: number;
  status: CoachQualityStandardStatus;
  targets: CoachQualityTargets;
  review_cadence: CoachQualityReviewCadence;
  sample_size: number;
  coaching_trigger: string;
  clinical_review_trigger: string;
  rationale: string;
  proposed_by_name: string;
  proposed_by_role: string;
  proposed_at: string;
  approved_by_name: string | null;
  approved_at: string | null;
  approval_note: string | null;
  retired_by_name: string | null;
  retired_at: string | null;
  retirement_note: string | null;
};

export type CoachQualityProposal = {
  targets: CoachQualityTargets;
  reviewCadence: CoachQualityReviewCadence;
  sampleSize: number;
  coachingTrigger: string;
  clinicalReviewTrigger: string;
  rationale: string;
};

export function canProposeCoachQualityStandard(role: string) {
  return ["Super Admin", "Administrator", "Manager"].includes(role);
}

export function canApproveCoachQualityStandard(role: string) {
  return role === "Medical Director";
}

export function coachQualityProposalFromValues(values: {
  targets: Partial<Record<CoachAuditDomain, unknown>>;
  reviewCadence: unknown;
  sampleSize: unknown;
  coachingTrigger: unknown;
  clinicalReviewTrigger: unknown;
  rationale: unknown;
}): { proposal: CoachQualityProposal | null; problems: string[] } {
  const problems: string[] = [];
  const targets = {} as CoachQualityTargets;
  for (const domain of COACH_AUDIT_DOMAINS) {
    const raw = values.targets[domain.key];
    const text = String(raw ?? "").trim();
    const target = typeof raw === "number" ? raw : text ? Number(text) : Number.NaN;
    if (!Number.isInteger(target) || target < 0 || target > 100) {
      problems.push(`${domain.label} target (0–100)`);
    } else {
      targets[domain.key] = target;
    }
  }

  const reviewCadence = String(values.reviewCadence ?? "");
  if (!COACH_QUALITY_REVIEW_CADENCES.includes(reviewCadence as CoachQualityReviewCadence)) {
    problems.push("Review cadence");
  }
  const sampleSize = Number(String(values.sampleSize ?? "").trim());
  if (!Number.isInteger(sampleSize) || sampleSize < 1 || sampleSize > 100) {
    problems.push("Audit sample size (1–100 sessions per coach)");
  }
  const coachingTrigger = String(values.coachingTrigger ?? "").trim();
  const clinicalReviewTrigger = String(values.clinicalReviewTrigger ?? "").trim();
  const rationale = String(values.rationale ?? "").trim();
  if (coachingTrigger.length < 12) problems.push("Coaching-response criteria");
  if (clinicalReviewTrigger.length < 12) problems.push("Clinical-review criteria");
  if (rationale.length < 12) problems.push("Rationale");

  if (problems.length) return { proposal: null, problems };
  return {
    proposal: {
      targets,
      reviewCadence: reviewCadence as CoachQualityReviewCadence,
      sampleSize,
      coachingTrigger,
      clinicalReviewTrigger,
      rationale,
    },
    problems: [],
  };
}

export function governanceDecisionProblem(note: unknown) {
  return String(note ?? "").trim().length >= 12
    ? null
    : "Record a governance decision reason of at least 12 characters.";
}
