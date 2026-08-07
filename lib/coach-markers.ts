// Health-Coach SOP model — the six markers the coach tracks per client, with the
// validated tool, cadence, scoring bands and referral thresholds from the
// Cureocity Health Coaching Handbook. Pure data + banding helpers.

export const MARKER_KEYS = ["stress", "sleep", "activity", "nutrition", "substance", "anxiety"] as const;
export type MarkerKey = (typeof MARKER_KEYS)[number];

export type Band = { min: number; max: number; label: string; tone: "good" | "warn" | "bad" };

export type Marker = {
  key: MarkerKey;
  label: string;
  icon: string;
  tool: string;            // validated instrument
  range: string;           // score range / unit
  frequency: string;       // cadence from the SOP
  bands: Band[];           // ascending by score
  referral: string;        // threshold that triggers action / referral
  reassessDays: number;    // regular cadence used to flag "due" (biweekly baseline)
};

export const MARKERS: Marker[] = [
  {
    key: "stress", label: "Stress", icon: "🧠", tool: "PSS-10", range: "0–40",
    frequency: "Baseline S1 · weekly in Month 1 · biweekly from Month 2",
    bands: [
      { min: 0, max: 13, label: "Low", tone: "good" },
      { min: 14, max: 26, label: "Moderate", tone: "warn" },
      { min: 27, max: 40, label: "High", tone: "bad" },
    ],
    referral: "Score ≥27 (high) — re-assess next session; escalate if persistent.",
    reassessDays: 14,
  },
  {
    key: "sleep", label: "Sleep", icon: "😴", tool: "PSQI", range: "0–21",
    frequency: "Baseline S1 · weekly in Month 1 · biweekly from Month 2",
    bands: [
      { min: 0, max: 5, label: "Good", tone: "good" },
      { min: 6, max: 10, label: "Poor", tone: "warn" },
      { min: 11, max: 21, label: "Refer", tone: "bad" },
    ],
    referral: "PSQI >10 — flag for medical referral; re-assess after 4 weeks.",
    reassessDays: 14,
  },
  {
    key: "activity", label: "Physical Activity", icon: "🏃", tool: "PAR-Q + IPAQ-SF", range: "MET-min/week",
    frequency: "PAR-Q + IPAQ-SF at S1 · weekly in Month 1 · biweekly from Month 2",
    bands: [
      { min: 0, max: 599, label: "Low", tone: "warn" },
      { min: 600, max: 2999, label: "Moderate", tone: "good" },
      { min: 3000, max: 100000, label: "High", tone: "good" },
    ],
    referral: "Any PAR-Q 'Yes' — require medical clearance before coaching exercise.",
    reassessDays: 14,
  },
  {
    key: "nutrition", label: "Nutrition", icon: "🥗", tool: "3-day diary + GDR", range: "GDR 0–100",
    frequency: "Diary + GDR at S1 · 24-hr recall each session · GDR every 6 weeks",
    bands: [
      { min: 0, max: 49, label: "Refer", tone: "bad" },
      { min: 50, max: 74, label: "Fair", tone: "warn" },
      { min: 75, max: 100, label: "Good", tone: "good" },
    ],
    referral: "GDR <50 or red flags (disordered eating) — refer to Dietitian.",
    reassessDays: 14,
  },
  {
    key: "substance", label: "Substance Use", icon: "🚭", tool: "AUDIT-C + DAST-10", range: "AUDIT-C 0–12",
    frequency: "AUDIT-C + DAST-10 + tobacco screen at S1 · biweekly · tobacco readiness each session",
    bands: [
      { min: 0, max: 3, label: "Low risk", tone: "good" },
      { min: 4, max: 12, label: "Positive", tone: "bad" },
    ],
    referral: "AUDIT-C ≥4 (≥3 for women) or DAST-10 ≥3 — immediate action / referral.",
    reassessDays: 14,
  },
  {
    key: "anxiety", label: "Anxiety", icon: "💬", tool: "HAM-A", range: "0–56",
    frequency: "Baseline S1 · weekly in Month 1 · biweekly from Month 2",
    bands: [
      { min: 0, max: 17, label: "Mild", tone: "good" },
      { min: 18, max: 24, label: "Moderate", tone: "warn" },
      { min: 25, max: 56, label: "Severe", tone: "bad" },
    ],
    referral: "HAM-A ≥25 (severe) — activate referral pathway. Any self-harm disclosure → emergency protocol.",
    reassessDays: 14,
  },
];

export const MARKER_BY_KEY: Record<MarkerKey, Marker> = Object.fromEntries(MARKERS.map((m) => [m.key, m])) as Record<MarkerKey, Marker>;

/** The band a score falls into for a marker. */
export function bandFor(key: MarkerKey, score: number): Band | null {
  const m = MARKER_BY_KEY[key];
  if (!m) return null;
  return m.bands.find((b) => score >= b.min && score <= b.max) ?? m.bands[m.bands.length - 1];
}

export const TONE_STYLE: Record<Band["tone"], { bg: string; text: string }> = {
  good: { bg: "var(--green-bg)", text: "var(--green-text)" },
  warn: { bg: "var(--amber-bg)", text: "var(--amber-text)" },
  bad: { bg: "var(--red-bg)", text: "var(--red-text)" },
};


// ---- when a marker is due --------------------------------------------------
//
// Shared with the attention queue. The coach's own tab already computed this
// inline; the queue needs the identical rule, and two copies of a cadence is
// exactly how the ownership rules drifted apart elsewhere.

export type MarkerState = { marker: MarkerKey; date: string; tone: string | null; band: string | null };

/** Days a marker is overdue, or null when it is not. Never assessed = overdue
 *  from the moment the client has a coach, which is what `neverDays` covers. */
export function markerOverdueDays(
  m: Marker,
  last: MarkerState | undefined,
  today: string,
  neverDays = 0,
): number | null {
  const day = (a: string, b: string) =>
    Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
  if (!last) return neverDays;               // no baseline on file at all
  const over = day(last.date, today) - m.reassessDays;
  return over > 0 ? over : null;
}

/**
 * A marker whose LAST reading was in the referral band.
 *
 * This is the one that matters most and the one nothing surfaced: a HAM-A of
 * 25+ or an AUDIT-C of 4+ sat in the coach's tab with a red chip and raised
 * nothing anywhere else. `tone: "bad"` is the stored form of "referral band"
 * (see saveCoachAssessment, which also opens a concern on it).
 */
export function markerNeedsReferral(last: MarkerState | undefined): boolean {
  return last?.tone === "bad";
}
