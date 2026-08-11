import { MICRONUTRIENTS, type MicroKey } from "@/lib/nutrition";

/**
 * Lab values, read against a range.
 *
 * Section 4 of the brief asks the chart to answer deficiencies found in the lab
 * report. This turns a stored number into "low", "in range" or "high", and
 * names the micronutrient that answers it — so a ferritin of 9 can point at the
 * iron column rather than waiting for somebody to make the connection.
 *
 * WHAT THIS IS NOT
 *
 * It does not diagnose and it does not treat. "Low" here means below the
 * reference range on the report, which is a laboratory statement, not a
 * clinical one — plenty of values sit outside a range for reasons that have
 * nothing to do with diet, and plenty of real deficiencies sit inside one.
 * Every message is addressed to a dietitian looking at a chart, not to a
 * client, and none of them recommends a dose.
 *
 * THE RANGE COMES FROM THE REPORT WHERE THERE IS ONE
 *
 * Laboratories differ, analysers differ, and men and women differ. A value read
 * against the wrong range is worse than a value read against none, so the range
 * printed on the report always wins. The fallbacks below are used only when the
 * report printed none, and the screen says which was used.
 */

export type LabResult = {
  marker: string;
  label: string | null;
  value: number;
  unit: string;
  low: number | null;
  high: number | null;
  taken_on: string;
};

export type Verdict = "low" | "in range" | "high" | "unknown";

/**
 * The markers a dietitian actually acts on, and the nutrient that answers each.
 *
 * Short on purpose. A longer list would drift into markers where the dietary
 * answer is contested or absent, and a food suggestion attached to one of those
 * is a confident wrong number of exactly the kind this system refuses.
 *
 * Fallback ranges are the ones commonly printed by Indian laboratories. They
 * are a last resort — see the note above.
 */
export const LAB_MARKERS: {
  key: string;
  label: string;
  unit: string;
  fallback?: { low: number; high: number };
  /** The micronutrient a chart can move in response, where there is one. */
  answers?: MicroKey;
  /** What a dietitian does about it. Never a dose, never a diagnosis. */
  whenLow?: string;
  whenHigh?: string;
}[] = [
  {
    key: "haemoglobin", label: "Haemoglobin", unit: "g/dL",
    fallback: { low: 12, high: 16 }, answers: "iron_mg",
    whenLow: "Iron-rich options, and vitamin C alongside them — it roughly triples "
      + "absorption from plant sources. Tea and coffee with the meal do the opposite.",
  },
  {
    key: "ferritin", label: "Ferritin", unit: "ng/mL",
    fallback: { low: 30, high: 300 }, answers: "iron_mg",
    whenLow: "Iron stores are down before haemoglobin falls, so this is the earlier "
      + "signal. Same answer: iron-rich options with vitamin C, away from tea.",
    whenHigh: "High ferritin also rises with inflammation and is not, on its own, a "
      + "reason to reduce dietary iron. One for the doctor.",
  },
  {
    key: "vitamin_d", label: "Vitamin D (25-OH)", unit: "ng/mL",
    fallback: { low: 30, high: 100 }, answers: "vit_d_ug",
    whenLow: "Food carries very little vitamin D and the chart cannot fix this on its "
      + "own — sunlight and a prescribed supplement do. Worth flagging to the doctor "
      + "rather than trying to chase with diet.",
  },
  {
    key: "vitamin_b12", label: "Vitamin B12", unit: "pg/mL",
    fallback: { low: 200, high: 900 },
    whenLow: "B12 comes only from animal foods and fortified ones. Ask about a "
      + "vegetarian or vegan pattern before anything else — that is usually the cause.",
  },
  {
    key: "tsh", label: "TSH", unit: "µIU/mL",
    fallback: { low: 0.4, high: 4.0 },
    whenHigh: "Consistent with an underactive thyroid. If a replacement is prescribed, "
      + "the calcium and iron timing rule applies — see the medicines check on the chart.",
  },
  {
    key: "hba1c", label: "HbA1c", unit: "%",
    fallback: { low: 4, high: 5.6 },
    whenHigh: "Average glucose over about three months. Carbohydrate quality and "
      + "distribution across the day matter more here than the daily total.",
  },
  {
    key: "fasting_glucose", label: "Fasting glucose", unit: "mg/dL",
    fallback: { low: 70, high: 99 },
    whenHigh: "One reading, one morning. Read alongside HbA1c rather than on its own.",
  },
  {
    key: "triglycerides", label: "Triglycerides", unit: "mg/dL",
    fallback: { low: 0, high: 150 },
    whenHigh: "Responds to refined carbohydrate and alcohol more than to dietary fat.",
  },
  {
    key: "ldl", label: "LDL cholesterol", unit: "mg/dL",
    fallback: { low: 0, high: 100 }, answers: "saturated_fat_g",
    whenHigh: "Saturated fat is the lever — coconut oil and ghee are the ones a Kerala "
      + "chart usually has room to move.",
  },
  {
    key: "hdl", label: "HDL cholesterol", unit: "mg/dL",
    fallback: { low: 40, high: 100 },
    whenLow: "Moves with activity more than with food.",
  },
  {
    key: "creatinine", label: "Creatinine", unit: "mg/dL",
    fallback: { low: 0.6, high: 1.3 }, answers: "potassium_mg",
    whenHigh: "Kidney function. Protein and potassium both need a doctor's number "
      + "before a chart moves them — do not adjust either on this alone.",
  },
  {
    key: "uric_acid", label: "Uric acid", unit: "mg/dL",
    fallback: { low: 3.5, high: 7.2 },
    whenHigh: "Purine-heavy foods and alcohol; fructose more than people expect.",
  },
];

export const markerFor = (key: string) => LAB_MARKERS.find((m) => m.key === key);

/**
 * Where a value sits, and which range said so.
 *
 * `usingReport` matters on screen: a verdict from the laboratory's own printed
 * range carries weight a verdict from our fallback does not.
 */
export function readValue(r: LabResult): {
  verdict: Verdict;
  usingReport: boolean;
  low: number | null;
  high: number | null;
} {
  const m = markerFor(r.marker);
  const usingReport = r.low != null || r.high != null;
  const low = r.low ?? m?.fallback?.low ?? null;
  const high = r.high ?? m?.fallback?.high ?? null;

  if (!Number.isFinite(r.value)) return { verdict: "unknown", usingReport, low, high };
  if (low == null && high == null) return { verdict: "unknown", usingReport, low, high };
  if (low != null && r.value < low) return { verdict: "low", usingReport, low, high };
  if (high != null && r.value > high) return { verdict: "high", usingReport, low, high };
  return { verdict: "in range", usingReport, low, high };
}

export type LabFinding = {
  marker: string;
  label: string;
  verdict: Verdict;
  text: string;
  /** The micronutrient a chart could move in response, if any. */
  answers?: MicroKey;
  answersLabel?: string;
};

/**
 * The findings worth putting in front of somebody writing a chart.
 *
 * Only the latest result per marker: a ferritin from March that has since been
 * repeated is history, and showing both invites the wrong one being acted on.
 * Only out-of-range ones, because a screen listing twelve normal results is a
 * screen nobody reads.
 */
export function labFindings(results: LabResult[]): LabFinding[] {
  const latest = new Map<string, LabResult>();
  for (const r of results) {
    const held = latest.get(r.marker);
    if (!held || r.taken_on > held.taken_on) latest.set(r.marker, r);
  }

  const out: LabFinding[] = [];
  for (const r of latest.values()) {
    const { verdict, usingReport, low, high } = readValue(r);
    if (verdict !== "low" && verdict !== "high") continue;
    const m = markerFor(r.marker);
    const advice = verdict === "low" ? m?.whenLow : m?.whenHigh;
    const range = low != null && high != null ? `${low}–${high}`
      : low != null ? `above ${low}` : `below ${high}`;
    const micro = m?.answers ? MICRONUTRIENTS.find((x) => x.key === m.answers) : undefined;

    out.push({
      marker: r.marker,
      label: m?.label ?? r.label ?? r.marker,
      verdict,
      answers: m?.answers,
      answersLabel: micro?.label,
      text: `${m?.label ?? r.label ?? r.marker} is ${verdict} at ${r.value} ${r.unit} `
        + `(${range}${usingReport ? "" : ", a published range — this report printed none"}), `
        + `taken ${r.taken_on}.${advice ? ` ${advice}` : ""}`,
    });
  }
  // Low first: a deficiency is what section 4 is about, and a high reading is
  // more often the doctor's business than the dietitian's.
  return out.sort((a, b) => (a.verdict === b.verdict ? 0 : a.verdict === "low" ? -1 : 1));
}
