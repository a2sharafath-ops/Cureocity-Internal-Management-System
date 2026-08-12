// Health-Coach SOP model — the screening markers the coach tracks per client, with the
// validated tool, cadence, scoring bands and referral thresholds from the
// Cureocity Health Coaching Handbook. Pure data + banding helpers.

export const MARKER_KEYS = ["stress", "sleep", "activity", "nutrition", "substance", "anxiety", "mood"] as const;
export type MarkerKey = (typeof MARKER_KEYS)[number];

export type Band = { min: number; max: number; label: string; tone: "good" | "warn" | "bad" };

export type MarkerCadence =
  | { kind: "phased"; initialDays: number; initialPhaseDays: number; maintenanceDays: number; referralDays?: number }
  | { kind: "fixed"; days: number; referralDays?: number }
  | { kind: "clinical-plan" };

export type Marker = {
  key: MarkerKey;
  label: string;
  icon: string;
  tool: string;            // validated instrument
  range: string;           // score range / unit
  frequency: string;       // cadence from the SOP
  bands: Band[];           // ascending by score
  referral: string;        // threshold that triggers action / referral
  cadence: MarkerCadence;  // determines the stored next-review date
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
    cadence: { kind: "phased", initialDays: 7, initialPhaseDays: 30, maintenanceDays: 14 },
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
    cadence: { kind: "phased", initialDays: 7, initialPhaseDays: 30, maintenanceDays: 14, referralDays: 28 },
  },
  {
    key: "activity", label: "Physical Activity", icon: "🏃", tool: "Official PAR-Q+ + IPAQ-SF", range: "MET-min/week",
    frequency: "Official PAR-Q+ + IPAQ-SF at S1 · weekly in Month 1 · biweekly from Month 2",
    bands: [
      { min: 0, max: 599, label: "Low", tone: "warn" },
      { min: 600, max: 2999, label: "Moderate", tone: "good" },
      { min: 3000, max: 100000, label: "High", tone: "good" },
    ],
    referral: "Any PAR-Q 'Yes' — require medical clearance before coaching exercise.",
    cadence: { kind: "phased", initialDays: 7, initialPhaseDays: 30, maintenanceDays: 14 },
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
    cadence: { kind: "fixed", days: 42 },
  },
  {
    key: "substance", label: "Substance Use", icon: "🚭", tool: "AUDIT-C + DAST-10", range: "AUDIT-C 0–12",
    frequency: "AUDIT-C + DAST-10 + tobacco screen at S1 · biweekly · tobacco readiness each session",
    bands: [
      { min: 0, max: 3, label: "Low risk", tone: "good" },
      { min: 4, max: 12, label: "Positive", tone: "bad" },
    ],
    referral: "AUDIT-C ≥4 (≥3 for women) or DAST-10 ≥3 — immediate action / referral.",
    cadence: { kind: "fixed", days: 14 },
  },
  {
    key: "anxiety", label: "Anxiety", icon: "💬", tool: "GAD-7", range: "0–21",
    frequency: "Baseline S1 · weekly in Month 1 · biweekly from Month 2",
    bands: [
      { min: 0, max: 4, label: "Minimal", tone: "good" },
      { min: 5, max: 9, label: "Mild", tone: "warn" },
      { min: 10, max: 14, label: "Moderate", tone: "bad" },
      { min: 15, max: 21, label: "Severe", tone: "bad" },
    ],
    referral: "GAD-7 ≥10 — psychology referral pathway; ≥15 requires faster clinical review.",
    cadence: { kind: "phased", initialDays: 7, initialPhaseDays: 30, maintenanceDays: 14 },
  },
  {
    key: "mood", label: "Mood", icon: "🌤️", tool: "PHQ-9", range: "0–27",
    frequency: "At baseline when indicated · repeat per clinical plan",
    bands: [
      { min: 0, max: 4, label: "Minimal", tone: "good" },
      { min: 5, max: 9, label: "Mild", tone: "warn" },
      { min: 10, max: 14, label: "Moderate", tone: "bad" },
      { min: 15, max: 19, label: "Moderately severe", tone: "bad" },
      { min: 20, max: 27, label: "Severe", tone: "bad" },
    ],
    referral: "PHQ-9 ≥10 — psychology pathway; any item 9 response overrides the routine flow and opens safety escalation.",
    cadence: { kind: "clinical-plan" },
  },
];

export const MARKER_BY_KEY: Record<MarkerKey, Marker> = Object.fromEntries(MARKERS.map((m) => [m.key, m])) as Record<MarkerKey, Marker>;

/** The band a score falls into for a marker. */
/**
 * AUDIT-C is scored differently for women.
 *
 * The threshold is ≥4 for men and ≥3 for women — which the `referral` text on
 * the substance marker has said all along, while `bandFor` took no gender and
 * used the male cut-off for everyone. A woman scoring 3 was banded "Low risk",
 * so `markerNeedsReferral` stayed false and the referral flag never fired. The
 * code and its own documented protocol disagreed, and the code was winning.
 *
 * Applied here rather than by editing MARKERS, because the band table is also
 * what the UI renders as the scale, and that scale is genuinely 0–12 for both.
 */
const FEMALE_CUTOFF: Partial<Record<MarkerKey, number>> = { substance: 3 };

export function bandFor(key: MarkerKey, score: number, gender?: string | null): Band | null {
  const m = MARKER_BY_KEY[key];
  if (!m) return null;

  const cutoff = FEMALE_CUTOFF[key];
  if (cutoff != null && isFemale(gender) && score >= cutoff) {
    // Same band the male scale gives at its own cut-off — the "positive" one.
    return m.bands[m.bands.length - 1];
  }
  return m.bands.find((b) => score >= b.min && score <= b.max) ?? m.bands[m.bands.length - 1];
}

/** Gender is free text on the client record, so be generous about spelling. */
function isFemale(gender?: string | null): boolean {
  const g = (gender ?? "").trim().toLowerCase();
  return g === "f" || g === "female" || g === "woman";
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

export type MarkerState = {
  marker: MarkerKey;
  date: string;
  tone: string | null;
  band: string | null;
  next_review_date?: string | null;
};

export const SCREENING_PATHWAY_MARKER: Readonly<Record<string, MarkerKey>> = {
  "PSQI sleep screening": "sleep",
  "Official PAR-Q+ / clinical clearance": "activity",
  "PSS-10 stress screening": "stress",
  "GAD-7 anxiety screening": "anxiety",
  "PHQ-9 mood screening": "mood",
  "AUDIT-C alcohol screening": "substance",
  "Fagerström nicotine screening": "substance",
  "DAST-10 drug screening": "substance",
};

/**
 * A validated instrument is applicable only when the baseline triggered its
 * pathway or a clinician has already started that marker. The latter preserves
 * an explicit clinical decision even when the original trigger later resolves.
 */
export function applicableMarkerKeys(pathways: string[], assessedMarkers: Iterable<string>) {
  const keys = new Set<MarkerKey>();
  for (const pathway of pathways) {
    const marker = SCREENING_PATHWAY_MARKER[pathway];
    if (marker) keys.add(marker);
  }
  for (const marker of assessedMarkers) {
    if ((MARKER_KEYS as readonly string[]).includes(marker)) keys.add(marker as MarkerKey);
  }
  return keys;
}

const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * The next review written with a completed result. Mood is deliberately not
 * auto-scheduled: its SOP says the clinical plan owns the interval.
 */
export function markerNextReviewDate(
  marker: Marker,
  assessedOn: string,
  firstAssessedOn: string | null,
  tone: string | null,
  plannedReviewDate: string | null = null,
): string | null {
  if (marker.cadence.kind === "clinical-plan") return plannedReviewDate;
  if (tone === "bad" && marker.cadence.referralDays) return addDays(assessedOn, marker.cadence.referralDays);
  if (marker.cadence.kind === "fixed") return addDays(assessedOn, marker.cadence.days);
  const first = firstAssessedOn ?? assessedOn;
  const interval = daysBetween(first, assessedOn) < marker.cadence.initialPhaseDays
    ? marker.cadence.initialDays
    : marker.cadence.maintenanceDays;
  return addDays(assessedOn, interval);
}

/** Days an applicable marker is overdue, or null when it is not. Callers own
 * applicability; `neverDays` covers the grace period for a triggered first use. */
export function markerOverdueDays(
  m: Marker,
  last: MarkerState | undefined,
  today: string,
  neverDays = 0,
  firstAssessedOn: string | null = null,
): number | null {
  const day = (a: string, b: string) =>
    Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
  if (!last) return neverDays;               // no baseline on file at all
  const due = last.next_review_date
    ?? markerNextReviewDate(m, last.date, firstAssessedOn, last.tone);
  if (!due) return null; // cadence is owned by a clinical plan and no repeat is scheduled
  const over = day(due, today);
  return over > 0 ? over : null;
}

/**
 * A marker whose LAST reading was in the referral band.
 *
 * This is the one that matters most and the one nothing surfaced: a GAD-7 of
 * 10+ or an AUDIT-C of 4+ sat in the coach's tab with a red chip and raised
 * nothing anywhere else. `tone: "bad"` is the stored form of "referral band"
 * (see saveCoachAssessment, which stores the validated interpretation and
 * recommended action used by the attention queue).
 */
export function markerNeedsReferral(last: MarkerState | undefined): boolean {
  return last?.tone === "bad";
}
