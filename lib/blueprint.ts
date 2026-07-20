// The Personal Health Blueprint — 9 validated scores across 4 domains.
// Each score is 0–100 (higher = healthier).

export const BP_DOMAINS = [
  { key: "metabolic", label: "Metabolic / Diabetes" },
  { key: "cardio", label: "Cardiovascular" },
  { key: "liver", label: "Liver" },
  { key: "gut", label: "Gut & Inflammation" },
] as const;

export const BP_SCORES = [
  { key: "diabetes", label: "Diabetes Risk", domain: "metabolic" },
  { key: "insulin", label: "Insulin Sensitivity", domain: "metabolic" },
  { key: "cardio_fit", label: "Cardiovascular Fitness", domain: "cardio" },
  { key: "bp", label: "Blood Pressure", domain: "cardio" },
  { key: "lipids", label: "Lipid Profile", domain: "cardio" },
  { key: "liver_fn", label: "Liver Function", domain: "liver" },
  { key: "fatty_liver", label: "Fatty Liver Index", domain: "liver" },
  { key: "gut", label: "Gut Health", domain: "gut" },
  { key: "inflammation", label: "Inflammation", domain: "gut" },
] as const;

export type BpScores = Record<string, number>;

export function band(v: number | null | undefined): { label: string; bg: string; color: string } {
  if (v == null || Number.isNaN(v)) return { label: "—", bg: "var(--neutral-bg)", color: "var(--muted)" };
  if (v >= 70) return { label: "Good", bg: "var(--green-bg)", color: "var(--green-text)" };
  if (v >= 40) return { label: "Moderate", bg: "var(--amber-bg)", color: "var(--amber-text)" };
  return { label: "Needs attention", bg: "var(--red-bg)", color: "var(--red-text)" };
}

export function scoresFilled(scores: BpScores | null | undefined): number {
  if (!scores) return 0;
  return BP_SCORES.filter((s) => typeof scores[s.key] === "number").length;
}
