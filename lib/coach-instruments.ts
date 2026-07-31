// Validated instruments behind the Health-Coach markers. Each defines its items
// and a pure scoring function → { score, detail, forceBad }. Used by the coach
// assessment form to auto-compute the score and band from item responses.

import type { MarkerKey } from "@/lib/coach-markers";

export type AItem = { id: string; text: string; kind: "opt" | "num" | "time"; options?: { label: string; v: number }[]; unit?: string; min?: number };
export type Instrument = {
  marker: MarkerKey;
  title: string;
  instruction?: string;
  items: AItem[];
  compute: (a: Record<string, number>) => { score: number; detail: Record<string, number>; forceBad?: boolean };
};

const FREQ5 = [
  { label: "Never", v: 0 }, { label: "Almost never", v: 1 }, { label: "Sometimes", v: 2 },
  { label: "Fairly often", v: 3 }, { label: "Very often", v: 4 },
];
const HAM5 = [
  { label: "Not present", v: 0 }, { label: "Mild", v: 1 }, { label: "Moderate", v: 2 },
  { label: "Severe", v: 3 }, { label: "Very severe", v: 4 },
];
const YESNO = [{ label: "No", v: 0 }, { label: "Yes", v: 1 }];
const PSQI4 = [
  { label: "Not during the past month", v: 0 }, { label: "Less than once a week", v: 1 },
  { label: "Once or twice a week", v: 2 }, { label: "Three or more times a week", v: 3 },
];

const sum = (a: Record<string, number>, ids: string[]) => ids.reduce((n, k) => n + (Number(a[k]) || 0), 0);

// ---- STRESS · PSS-10 -------------------------------------------------------
const PSS: Instrument = {
  marker: "stress", title: "PSS-10 · Perceived Stress Scale",
  instruction: "In the last month, how often have you…",
  items: [
    { id: "p1", text: "…been upset because of something that happened unexpectedly?", kind: "opt", options: FREQ5 },
    { id: "p2", text: "…felt unable to control the important things in your life?", kind: "opt", options: FREQ5 },
    { id: "p3", text: "…felt nervous and stressed?", kind: "opt", options: FREQ5 },
    { id: "p4", text: "…felt confident about your ability to handle personal problems?", kind: "opt", options: FREQ5 },
    { id: "p5", text: "…felt that things were going your way?", kind: "opt", options: FREQ5 },
    { id: "p6", text: "…found that you could not cope with all the things you had to do?", kind: "opt", options: FREQ5 },
    { id: "p7", text: "…been able to control irritations in your life?", kind: "opt", options: FREQ5 },
    { id: "p8", text: "…felt that you were on top of things?", kind: "opt", options: FREQ5 },
    { id: "p9", text: "…been angered because of things outside your control?", kind: "opt", options: FREQ5 },
    { id: "p10", text: "…felt difficulties were piling up so high you could not overcome them?", kind: "opt", options: FREQ5 },
  ],
  compute: (a) => {
    const rev = new Set(["p4", "p5", "p7", "p8"]);
    let s = 0;
    for (const it of PSS.items) { const v = Number(a[it.id]) || 0; s += rev.has(it.id) ? 4 - v : v; }
    return { score: s, detail: { pss10: s } };
  },
};

// ---- SLEEP · PSQI (full — 7 components computed from raw items) -------------
// Global 0–21 = sum of 7 component scores (each 0–3), computed per the standard
// Pittsburgh Sleep Quality Index scoring.
const PSQI: Instrument = {
  marker: "sleep", title: "PSQI · Pittsburgh Sleep Quality Index",
  instruction: "Answer for the past month. Component & global scores auto-compute.",
  items: [
    { id: "q1_bed", text: "1. Usual bedtime", kind: "time" },
    { id: "q3_wake", text: "3. Usual getting-up time", kind: "time" },
    { id: "q2_lat", text: "2. Minutes to fall asleep each night", kind: "num", unit: "min", min: 0 },
    { id: "q4_hrs", text: "4. Hours of actual sleep per night", kind: "num", unit: "hrs", min: 0 },
    { id: "q5a", text: "5a. Cannot get to sleep within 30 minutes", kind: "opt", options: PSQI4 },
    { id: "q5b", text: "5b. Wake in the middle of the night or early morning", kind: "opt", options: PSQI4 },
    { id: "q5c", text: "5c. Have to get up to use the bathroom", kind: "opt", options: PSQI4 },
    { id: "q5d", text: "5d. Cannot breathe comfortably", kind: "opt", options: PSQI4 },
    { id: "q5e", text: "5e. Cough or snore loudly", kind: "opt", options: PSQI4 },
    { id: "q5f", text: "5f. Feel too cold", kind: "opt", options: PSQI4 },
    { id: "q5g", text: "5g. Feel too hot", kind: "opt", options: PSQI4 },
    { id: "q5h", text: "5h. Have bad dreams", kind: "opt", options: PSQI4 },
    { id: "q5i", text: "5i. Have pain", kind: "opt", options: PSQI4 },
    { id: "q5j", text: "5j. Other disturbance(s)", kind: "opt", options: PSQI4 },
    { id: "q6", text: "6. Use medicine to help sleep", kind: "opt", options: PSQI4 },
    { id: "q7", text: "7. Trouble staying awake (driving, meals, activities)", kind: "opt", options: PSQI4 },
    { id: "q8", text: "8. Problem keeping up enthusiasm to get things done", kind: "opt", options: [{ label: "No problem", v: 0 }, { label: "Slight", v: 1 }, { label: "Somewhat", v: 2 }, { label: "Very big", v: 3 }] },
    { id: "q9", text: "9. Overall sleep quality", kind: "opt", options: [{ label: "Very good", v: 0 }, { label: "Fairly good", v: 1 }, { label: "Fairly bad", v: 2 }, { label: "Very bad", v: 3 }] },
  ],
  compute: (a) => {
    const band = (x: number, cuts: number[]) => cuts.findIndex((c) => x <= c) === -1 ? 3 : cuts.findIndex((c) => x <= c);
    // C1 quality
    const c1 = a.q9 || 0;
    // C2 latency: minutes→0-3 + q5a, summed→0-3
    const latMin = band(a.q2_lat || 0, [15, 30, 60]);
    const c2 = band(latMin + (a.q5a || 0), [0, 2, 4]);
    // C3 duration
    const h = a.q4_hrs || 0;
    const c3 = h > 7 ? 0 : h >= 6 ? 1 : h >= 5 ? 2 : 3;
    // C4 efficiency = slept / in-bed
    const bed = a.q1_bed ?? null, wake = a.q3_wake ?? null;
    let c4 = 0;
    if (bed != null && wake != null) {
      let inBed = (wake - bed + 1440) % 1440; if (inBed === 0) inBed = 1440;
      const eff = inBed ? ((h * 60) / inBed) * 100 : 0;
      c4 = eff >= 85 ? 0 : eff >= 75 ? 1 : eff >= 65 ? 2 : 3;
    }
    // C5 disturbances (5b–5j)
    const dist = sum(a, ["q5b", "q5c", "q5d", "q5e", "q5f", "q5g", "q5h", "q5i", "q5j"]);
    const c5 = dist === 0 ? 0 : dist <= 9 ? 1 : dist <= 18 ? 2 : 3;
    // C6 med use
    const c6 = a.q6 || 0;
    // C7 daytime dysfunction
    const c7 = band((a.q7 || 0) + (a.q8 || 0), [0, 2, 4]);
    const global = c1 + c2 + c3 + c4 + c5 + c6 + c7;
    return { score: global, detail: { psqi_global: global, c1, c2, c3, c4, c5, c6, c7 } };
  },
};

// ---- PHYSICAL ACTIVITY · PAR-Q + IPAQ-SF ----------------------------------
const IPAQ: Instrument = {
  marker: "activity", title: "PAR-Q + IPAQ-SF",
  instruction: "Report a typical week. MET-min/week auto-computes.",
  items: [
    { id: "parq", text: "PAR-Q — any 'Yes' (heart condition, chest pain, dizziness, bone/joint problem, BP/heart meds, other reason not to exercise)?", kind: "opt", options: YESNO },
    { id: "vigDays", text: "Vigorous activity — days per week", kind: "num", unit: "days", min: 0 },
    { id: "vigMin", text: "Vigorous — minutes per day", kind: "num", unit: "min", min: 0 },
    { id: "modDays", text: "Moderate activity — days per week", kind: "num", unit: "days", min: 0 },
    { id: "modMin", text: "Moderate — minutes per day", kind: "num", unit: "min", min: 0 },
    { id: "walkDays", text: "Walking — days per week", kind: "num", unit: "days", min: 0 },
    { id: "walkMin", text: "Walking — minutes per day", kind: "num", unit: "min", min: 0 },
  ],
  compute: (a) => {
    const met = 8 * (a.vigMin || 0) * (a.vigDays || 0) + 4 * (a.modMin || 0) * (a.modDays || 0) + 3.3 * (a.walkMin || 0) * (a.walkDays || 0);
    return { score: Math.round(met), detail: { met_min_week: Math.round(met), parq_yes: a.parq || 0 }, forceBad: (a.parq || 0) === 1 };
  },
};

// ---- SUBSTANCE · AUDIT-C + DAST-10 ----------------------------------------
const AUDITC_Q = [
  { id: "a1", text: "How often do you have a drink containing alcohol?", options: [{ label: "Never", v: 0 }, { label: "Monthly or less", v: 1 }, { label: "2–4 times/month", v: 2 }, { label: "2–3 times/week", v: 3 }, { label: "4+ times/week", v: 4 }] },
  { id: "a2", text: "Standard drinks on a typical drinking day?", options: [{ label: "1–2", v: 0 }, { label: "3–4", v: 1 }, { label: "5–6", v: 2 }, { label: "7–9", v: 3 }, { label: "10+", v: 4 }] },
  { id: "a3", text: "How often 6+ drinks on one occasion?", options: [{ label: "Never", v: 0 }, { label: "Less than monthly", v: 1 }, { label: "Monthly", v: 2 }, { label: "Weekly", v: 3 }, { label: "Daily/almost", v: 4 }] },
];
const DAST_Q = [
  { id: "d1", text: "Used drugs other than those required for medical reasons?", rev: false },
  { id: "d2", text: "Abuse more than one drug at a time?", rev: false },
  { id: "d3", text: "Always able to stop using drugs when you want to?", rev: true },
  { id: "d4", text: "Had blackouts or flashbacks from drug use?", rev: false },
  { id: "d5", text: "Feel bad or guilty about your drug use?", rev: false },
  { id: "d6", text: "Does family/spouse complain about your drug use?", rev: false },
  { id: "d7", text: "Neglected family because of drug use?", rev: false },
  { id: "d8", text: "Engaged in illegal activities to obtain drugs?", rev: false },
  { id: "d9", text: "Experienced withdrawal symptoms when you stopped?", rev: false },
  { id: "d10", text: "Had medical problems from drug use (memory, hepatitis, seizures…)?", rev: false },
];
const SUBSTANCE: Instrument = {
  marker: "substance", title: "AUDIT-C + DAST-10",
  instruction: "Keep it brief and non-judgmental.",
  items: [
    ...AUDITC_Q.map((q) => ({ id: q.id, text: `Alcohol · ${q.text}`, kind: "opt" as const, options: q.options })),
    ...DAST_Q.map((q) => ({ id: q.id, text: `Drugs · ${q.text}`, kind: "opt" as const, options: YESNO })),
  ],
  compute: (a) => {
    const auditc = sum(a, ["a1", "a2", "a3"]);
    let dast = 0;
    for (const q of DAST_Q) { const yes = (a[q.id] || 0) === 1; if (q.rev ? !yes : yes) dast += 1; }
    return { score: auditc, detail: { auditc, dast }, forceBad: auditc >= 4 || dast >= 3 };
  },
};

// ---- ANXIETY · HAM-A ------------------------------------------------------
const HAMA_ITEMS = [
  "Anxious mood", "Tension", "Fears", "Insomnia", "Intellectual (cognitive)", "Depressed mood",
  "Somatic — muscular", "Somatic — sensory", "Cardiovascular symptoms", "Respiratory symptoms",
  "Gastrointestinal symptoms", "Genitourinary symptoms", "Autonomic symptoms", "Behaviour at interview",
];
const HAMA: Instrument = {
  marker: "anxiety", title: "HAM-A · Hamilton Anxiety Rating Scale",
  instruction: "Rate each symptom 0 (not present) to 4 (very severe).",
  items: HAMA_ITEMS.map((t, i) => ({ id: `h${i + 1}`, text: `${i + 1}. ${t}`, kind: "opt" as const, options: HAM5 })),
  compute: (a) => { const s = sum(a, HAMA_ITEMS.map((_, i) => `h${i + 1}`)); return { score: s, detail: { hama: s } }; },
};

export const INSTRUMENTS: Partial<Record<MarkerKey, Instrument>> = {
  stress: PSS, sleep: PSQI, activity: IPAQ, substance: SUBSTANCE, anxiety: HAMA,
  // nutrition (GDR) stays a manual score — no standard item list.
};
