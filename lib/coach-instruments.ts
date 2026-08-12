// Health Coach screening instruments. Embedded questionnaires are kept only
// where the official source permits digital reproduction. Restricted tools use
// the official form and store a verified result instead of a Cureocity rewrite.

import type { MarkerKey } from "@/lib/coach-markers";

export type AItem = {
  id: string;
  text: string;
  kind: "opt" | "num" | "time";
  options?: { label: string; v: number }[];
  unit?: string;
  min?: number;
  max?: number;
  showWhen?: { id: string; equals: number };
};

export type InstrumentResult = {
  score: number;
  detail: Record<string, number>;
  safetyTrigger?: boolean;
};

export type Instrument = {
  marker: MarkerKey;
  title: string;
  version: string;
  sourceUrl: string;
  mode: "embedded" | "external" | "hybrid";
  administrationMode: "Embedded official form" | "Official external form";
  instruction?: string;
  permissionNote?: string;
  items: AItem[];
  compute?: (answers: Record<string, number>) => InstrumentResult;
  scoreMin: number;
  scoreMax: number;
  externalResultLabel?: string;
  externalResultOptions?: string[];
};

const FREQ5 = [
  { label: "Never", v: 0 }, { label: "Almost never", v: 1 }, { label: "Sometimes", v: 2 },
  { label: "Fairly often", v: 3 }, { label: "Very often", v: 4 },
];
const DAYS4 = [
  { label: "Not at all", v: 0 }, { label: "Several days", v: 1 },
  { label: "More than half the days", v: 2 }, { label: "Nearly every day", v: 3 },
];
const YESNO = [{ label: "No", v: 0 }, { label: "Yes", v: 1 }];
const sum = (answers: Record<string, number>, ids: string[]) => ids.reduce((total, id) => total + Number(answers[id] ?? 0), 0);

const PSS: Instrument = {
  marker: "stress", title: "PSS-10 · Perceived Stress Scale", version: "PSS-10",
  sourceUrl: "https://www.cmu.edu/dietrich/psychology/stress-immunity-disease-lab/scales/index.html",
  mode: "embedded", administrationMode: "Embedded official form", scoreMin: 0, scoreMax: 40,
  instruction: "In the last month, how often has the client…",
  items: [
    { id: "p1", text: "Been upset because of something that happened unexpectedly?", kind: "opt", options: FREQ5 },
    { id: "p2", text: "Felt unable to control the important things in life?", kind: "opt", options: FREQ5 },
    { id: "p3", text: "Felt nervous and stressed?", kind: "opt", options: FREQ5 },
    { id: "p4", text: "Felt confident about the ability to handle personal problems?", kind: "opt", options: FREQ5 },
    { id: "p5", text: "Felt that things were going their way?", kind: "opt", options: FREQ5 },
    { id: "p6", text: "Found they could not cope with all the things they had to do?", kind: "opt", options: FREQ5 },
    { id: "p7", text: "Been able to control irritations in life?", kind: "opt", options: FREQ5 },
    { id: "p8", text: "Felt that they were on top of things?", kind: "opt", options: FREQ5 },
    { id: "p9", text: "Been angered because of things outside their control?", kind: "opt", options: FREQ5 },
    { id: "p10", text: "Felt difficulties were piling up so high they could not overcome them?", kind: "opt", options: FREQ5 },
  ],
  compute: (answers) => {
    const reversed = new Set(["p4", "p5", "p7", "p8"]);
    const score = PSS.items.reduce((total, item) => total + (reversed.has(item.id) ? 4 - answers[item.id] : answers[item.id]), 0);
    return { score, detail: { pss10: score } };
  },
};

const PSQI: Instrument = {
  marker: "sleep", title: "PSQI · Pittsburgh Sleep Quality Index", version: "Official PSQI form",
  sourceUrl: "https://www.sleep.pitt.edu/research/measures-and-study-instruments",
  mode: "external", administrationMode: "Official external form", scoreMin: 0, scoreMax: 21, items: [],
  instruction: "Use the official, licensed PSQI form without changing its wording. Enter the verified global score below.",
  permissionNote: "Commercial use requires permission/licensing from the University of Pittsburgh.",
};

const IPAQ: Instrument = {
  marker: "activity", title: "Official PAR-Q+ + IPAQ-SF", version: "PAR-Q+ 2025 / IPAQ-SF 2005 scoring protocol",
  sourceUrl: "https://eparmedx.com/",
  mode: "hybrid", administrationMode: "Official external form", scoreMin: 0, scoreMax: 100000,
  instruction: "Complete the current official PAR-Q+ outside Cureocity. Record its outcome, then enter the IPAQ-SF activity quantities.",
  permissionNote: "PAR-Q+ must remain unaltered and cannot be embedded electronically without written permission.",
  externalResultLabel: "Official PAR-Q+ outcome",
  externalResultOptions: ["No follow-up required", "Follow-up required", "Clearance received"],
  items: [
    { id: "vigDays", text: "Vigorous activity — days in the last 7 days", kind: "num", unit: "days", min: 0, max: 7 },
    { id: "vigMin", text: "Vigorous activity — minutes on one of those days", kind: "num", unit: "minutes", min: 0, max: 960 },
    { id: "modDays", text: "Moderate activity — days in the last 7 days", kind: "num", unit: "days", min: 0, max: 7 },
    { id: "modMin", text: "Moderate activity — minutes on one of those days", kind: "num", unit: "minutes", min: 0, max: 960 },
    { id: "walkDays", text: "Walking — days in the last 7 days", kind: "num", unit: "days", min: 0, max: 7 },
    { id: "walkMin", text: "Walking — minutes on one of those days", kind: "num", unit: "minutes", min: 0, max: 960 },
  ],
  compute: (answers) => {
    const met = 8 * answers.vigMin * answers.vigDays + 4 * answers.modMin * answers.modDays + 3.3 * answers.walkMin * answers.walkDays;
    return { score: Math.round(met), detail: { met_min_week: Math.round(met) } };
  },
};

const AUDITC_Q = [
  { id: "a1", text: "How often does the client have a drink containing alcohol?", options: [{ label: "Never", v: 0 }, { label: "Monthly or less", v: 1 }, { label: "2–4 times a month", v: 2 }, { label: "2–3 times a week", v: 3 }, { label: "4+ times a week", v: 4 }] },
  { id: "a2", text: "How many standard drinks on a typical drinking day?", options: [{ label: "1–2", v: 0 }, { label: "3–4", v: 1 }, { label: "5–6", v: 2 }, { label: "7–9", v: 3 }, { label: "10+", v: 4 }] },
  { id: "a3", text: "How often are six or more drinks consumed on one occasion?", options: [{ label: "Never", v: 0 }, { label: "Less than monthly", v: 1 }, { label: "Monthly", v: 2 }, { label: "Weekly", v: 3 }, { label: "Daily or almost daily", v: 4 }] },
];
const DAST_Q = [
  { id: "d1", text: "Used drugs other than those required for medical reasons?", reversed: false },
  { id: "d2", text: "Used more than one drug at a time?", reversed: false },
  { id: "d3", text: "Always able to stop using drugs when wanted?", reversed: true },
  { id: "d4", text: "Had blackouts or flashbacks because of drug use?", reversed: false },
  { id: "d5", text: "Felt bad or guilty about drug use?", reversed: false },
  { id: "d6", text: "Has family or a partner complained about drug use?", reversed: false },
  { id: "d7", text: "Neglected family because of drug use?", reversed: false },
  { id: "d8", text: "Engaged in illegal activities to obtain drugs?", reversed: false },
  { id: "d9", text: "Experienced withdrawal symptoms after stopping?", reversed: false },
  { id: "d10", text: "Had medical problems because of drug use?", reversed: false },
];
const FAGERSTROM_ITEMS: AItem[] = [
  { id: "n0", text: "Does the client currently smoke cigarettes?", kind: "opt", options: YESNO },
  { id: "n1", text: "How soon after waking is the first cigarette?", kind: "opt", showWhen: { id: "n0", equals: 1 }, options: [{ label: "Within 5 minutes", v: 3 }, { label: "6–30 minutes", v: 2 }, { label: "31–60 minutes", v: 1 }, { label: "After 60 minutes", v: 0 }] },
  { id: "n2", text: "Difficult to refrain where smoking is forbidden?", kind: "opt", showWhen: { id: "n0", equals: 1 }, options: YESNO.map((x) => ({ ...x })) },
  { id: "n3", text: "Which cigarette would be hardest to give up?", kind: "opt", showWhen: { id: "n0", equals: 1 }, options: [{ label: "First in the morning", v: 1 }, { label: "Any other", v: 0 }] },
  { id: "n4", text: "Cigarettes per day", kind: "opt", showWhen: { id: "n0", equals: 1 }, options: [{ label: "10 or fewer", v: 0 }, { label: "11–20", v: 1 }, { label: "21–30", v: 2 }, { label: "31 or more", v: 3 }] },
  { id: "n5", text: "Smokes more frequently during the first hours after waking?", kind: "opt", showWhen: { id: "n0", equals: 1 }, options: YESNO.map((x) => ({ ...x })) },
  { id: "n6", text: "Smokes even when ill enough to stay in bed?", kind: "opt", showWhen: { id: "n0", equals: 1 }, options: YESNO.map((x) => ({ ...x })) },
];
const SUBSTANCE: Instrument = {
  marker: "substance", title: "AUDIT-C + DAST-10 + Fagerström", version: "WHO AUDIT-C / DAST-10 / FTND",
  sourceUrl: "https://www.who.int/publications/i/item/WHO-MSD-MSB-01.6a",
  mode: "embedded", administrationMode: "Embedded official form", scoreMin: 0, scoreMax: 12,
  instruction: "Use non-judgemental language. Nicotine questions open only when cigarette use is recorded.",
  items: [
    { id: "a0", text: "Does the client currently consume alcohol?", kind: "opt", options: YESNO },
    ...AUDITC_Q.map((question) => ({ id: question.id, text: `Alcohol · ${question.text}`, kind: "opt" as const, options: question.options, showWhen: { id: "a0", equals: 1 } })),
    { id: "d0", text: "Any non-medical or recreational drug use in the past 12 months?", kind: "opt", options: YESNO },
    ...DAST_Q.map((question) => ({ id: question.id, text: `Drugs · ${question.text}`, kind: "opt" as const, options: YESNO, showWhen: { id: "d0", equals: 1 } })),
    ...FAGERSTROM_ITEMS,
  ],
  compute: (answers) => {
    const auditc = answers.a0 === 1 ? sum(answers, ["a1", "a2", "a3"]) : 0;
    const dast = answers.d0 === 1 ? DAST_Q.reduce((total, question) => total + (question.reversed ? (answers[question.id] === 0 ? 1 : 0) : answers[question.id]), 0) : 0;
    const fagerstrom = answers.n0 === 1 ? sum(answers, ["n1", "n2", "n3", "n4", "n5", "n6"]) : 0;
    return { score: auditc, detail: { auditc, dast, fagerstrom, uses_cigarettes: answers.n0 } };
  },
};

const GAD7: Instrument = {
  marker: "anxiety", title: "GAD-7 · Generalized Anxiety Disorder scale", version: "GAD-7",
  sourceUrl: "https://www.phqscreeners.com/", mode: "embedded", administrationMode: "Embedded official form",
  scoreMin: 0, scoreMax: 21, instruction: "Over the last two weeks, how often has the client been bothered by…",
  items: [
    "Feeling nervous, anxious, or on edge", "Not being able to stop or control worrying",
    "Worrying too much about different things", "Trouble relaxing", "Being so restless that it is hard to sit still",
    "Becoming easily annoyed or irritable", "Feeling afraid as if something awful might happen",
  ].map((text, index) => ({ id: `g${index + 1}`, text, kind: "opt" as const, options: DAYS4 })),
  compute: (answers) => { const score = sum(answers, ["g1", "g2", "g3", "g4", "g5", "g6", "g7"]); return { score, detail: { gad7: score } }; },
};

const PHQ9: Instrument = {
  marker: "mood", title: "PHQ-9 · Patient Health Questionnaire", version: "PHQ-9",
  sourceUrl: "https://www.phqscreeners.com/", mode: "embedded", administrationMode: "Embedded official form",
  scoreMin: 0, scoreMax: 27, instruction: "Over the last two weeks, how often has the client been bothered by…",
  items: [
    "Little interest or pleasure in doing things", "Feeling down, depressed, or hopeless",
    "Trouble falling or staying asleep, or sleeping too much", "Feeling tired or having little energy",
    "Poor appetite or overeating", "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
    "Trouble concentrating on things, such as reading or watching television",
    "Moving or speaking so slowly that other people could have noticed, or the opposite — being so fidgety or restless that you have been moving around more than usual",
    "Thoughts that you would be better off dead, or of hurting yourself in some way",
  ].map((text, index) => ({ id: `q${index + 1}`, text, kind: "opt" as const, options: DAYS4 })),
  compute: (answers) => {
    const score = sum(answers, ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"]);
    return { score, detail: { phq9: score, q9: answers.q9 }, safetyTrigger: answers.q9 > 0 };
  },
};

export const INSTRUMENTS: Partial<Record<MarkerKey, Instrument>> = {
  stress: PSS,
  sleep: PSQI,
  activity: IPAQ,
  substance: SUBSTANCE,
  anxiety: GAD7,
  mood: PHQ9,
  // Nutrition remains a structured behaviour assessment rather than a clinical scale.
};

export function visibleInstrumentItems(instrument: Instrument, answers: Record<string, number>) {
  return instrument.items.filter((item) => !item.showWhen || answers[item.showWhen.id] === item.showWhen.equals);
}

export function instrumentIsComplete(instrument: Instrument, answers: Record<string, number>, externalResult: string) {
  if (instrument.mode === "external") return externalResult.trim() !== "";
  if (instrument.mode === "hybrid" && !externalResult.trim()) return false;
  return visibleInstrumentItems(instrument, answers).every((item) => {
    const value = answers[item.id];
    if (!Number.isFinite(value)) return false;
    if (item.kind === "opt" && !item.options?.some((option) => option.v === value)) return false;
    if (item.min != null && value < item.min) return false;
    if (item.max != null && value > item.max) return false;
    if (item.kind === "time" && (value < 0 || value > 1439)) return false;
    return true;
  });
}
