// Suggest clinical flags from data the console already holds.
//
// Flags were entirely manual: a BP of 180/110 sitting in the vitals box, a
// visceral fat of 14 in the InBody, or a fasting glucose of 140 typed into the
// questionnaire raised nothing unless the clinician noticed and typed it out.
// This reads those three sources and proposes flags.
//
// IMPORTANT — these are SUGGESTIONS, not findings. Nothing here is written to
// the record automatically: the console shows them and a clinician accepts the
// ones they agree with. Thresholds are deliberately conservative, standard adult
// cut-offs, and the wording states the observation rather than a diagnosis.
// "Fasting glucose 140 mg/dL — in the diabetic range" is an observation a doctor
// confirms; "diabetes" would be a call only they can make.

export type Severity = "critical" | "warning" | "info";
export type Suggestion = { text: string; severity: Severity; source: "Vitals" | "InBody" | "Labs" };

export type FlagInput = {
  vitals?: Partial<Record<"systolic" | "diastolic" | "pulse" | "spo2" | "temp_c", number | null>>;
  inbody?: { bmi?: number | null; bodyFat?: number | null; visceral?: number | null };
  /** Lab values read from the questionnaire answers. */
  labs?: Partial<Record<"glucose" | "hba1c" | "cholesterol" | "hdl" | "triglycerides" | "hscrp", number | null>>;
  gender?: string | null;
};

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Pull lab values out of the answered questionnaire. The Doctor intake asks for
 * them by name ("Labs — fasting glucose (mg/dL)"), so match on the label and
 * take the first number in the answer — clinicians often type "96 mg/dL" or
 * "~5.5", and the unit is already implied by the question.
 */
export function labsFromAnswers(answers: [string, string][]): FlagInput["labs"] {
  const find = (re: RegExp): number | null => {
    for (const [q, a] of answers) {
      if (!re.test(q)) continue;
      const m = String(a).match(/-?\d+(?:\.\d+)?/);
      if (m) { const v = Number(m[0]); if (Number.isFinite(v)) return v; }
    }
    return null;
  };
  return {
    glucose: find(/fasting\s*glucose/i),
    hba1c: find(/hba1c/i),
    cholesterol: find(/total\s*cholesterol/i),
    hdl: find(/\bHDL/i),
    triglycerides: find(/triglyceride/i),
    hscrp: find(/hsCRP|\bCRP\b/i),
  };
}

/** Suggested flags, most serious first. Never returns a diagnosis. */
export function deriveFlags(i: FlagInput): Suggestion[] {
  const out: Suggestion[] = [];
  const female = String(i.gender ?? "").trim().toLowerCase().startsWith("f");

  // ---- vitals ----------------------------------------------------------
  const sys = n(i.vitals?.systolic), dia = n(i.vitals?.diastolic);
  if (sys !== null || dia !== null) {
    const bp = `BP ${sys ?? "?"}/${dia ?? "?"}`;
    // ACC/AHA + ESC agree on the emergency threshold; 140/90 is the common
    // treatment-conversation cut-off.
    if ((sys ?? 0) >= 180 || (dia ?? 0) >= 110) out.push({ text: `${bp} — severely elevated, needs same-day review`, severity: "critical", source: "Vitals" });
    else if ((sys ?? 0) >= 140 || (dia ?? 0) >= 90) out.push({ text: `${bp} — above 140/90`, severity: "warning", source: "Vitals" });
    else if (sys !== null && sys < 90) out.push({ text: `${bp} — low systolic`, severity: "warning", source: "Vitals" });
  }
  const spo2 = n(i.vitals?.spo2);
  if (spo2 !== null) {
    if (spo2 < 92) out.push({ text: `SpO₂ ${spo2}% — hypoxaemic, assess before exercise`, severity: "critical", source: "Vitals" });
    else if (spo2 < 95) out.push({ text: `SpO₂ ${spo2}% — below 95%`, severity: "warning", source: "Vitals" });
  }
  const pulse = n(i.vitals?.pulse);
  if (pulse !== null) {
    if (pulse > 100) out.push({ text: `Resting pulse ${pulse} bpm — tachycardic`, severity: "warning", source: "Vitals" });
    else if (pulse < 50) out.push({ text: `Resting pulse ${pulse} bpm — bradycardic (may be normal if well trained)`, severity: "info", source: "Vitals" });
  }
  const temp = n(i.vitals?.temp_c);
  if (temp !== null && temp >= 38) out.push({ text: `Temperature ${temp} °C — febrile, defer exertion`, severity: "warning", source: "Vitals" });

  // ---- InBody ----------------------------------------------------------
  const bmi = n(i.inbody?.bmi);
  if (bmi !== null) {
    if (bmi >= 30) out.push({ text: `BMI ${bmi} — obese range`, severity: "warning", source: "InBody" });
    else if (bmi < 18.5) out.push({ text: `BMI ${bmi} — underweight`, severity: "warning", source: "InBody" });
  }
  const bf = n(i.inbody?.bodyFat);
  if (bf !== null && (female ? bf >= 35 : bf >= 25)) {
    out.push({ text: `Body fat ${bf}% — high for ${female ? "female" : "male"} reference range`, severity: "warning", source: "InBody" });
  }
  const vf = n(i.inbody?.visceral);
  if (vf !== null) {
    if (vf > 14) out.push({ text: `Visceral fat level ${vf} — markedly raised`, severity: "warning", source: "InBody" });
    else if (vf > 9) out.push({ text: `Visceral fat level ${vf} — above the usual cut-off of 9`, severity: "info", source: "InBody" });
  }

  // ---- labs (from the questionnaire) -----------------------------------
  const g = n(i.labs?.glucose);
  if (g !== null) {
    if (g >= 126) out.push({ text: `Fasting glucose ${g} mg/dL — in the diabetic range, confirm`, severity: "critical", source: "Labs" });
    else if (g >= 100) out.push({ text: `Fasting glucose ${g} mg/dL — impaired fasting glucose`, severity: "warning", source: "Labs" });
  }
  const a1c = n(i.labs?.hba1c);
  if (a1c !== null) {
    if (a1c >= 6.5) out.push({ text: `HbA1c ${a1c}% — in the diabetic range, confirm`, severity: "critical", source: "Labs" });
    else if (a1c >= 5.7) out.push({ text: `HbA1c ${a1c}% — pre-diabetic range`, severity: "warning", source: "Labs" });
  }
  const tc = n(i.labs?.cholesterol);
  if (tc !== null && tc >= 240) out.push({ text: `Total cholesterol ${tc} mg/dL — high`, severity: "warning", source: "Labs" });
  const hdl = n(i.labs?.hdl);
  if (hdl !== null && (female ? hdl < 50 : hdl < 40)) out.push({ text: `HDL ${hdl} mg/dL — below the ${female ? "50" : "40"} mg/dL reference`, severity: "warning", source: "Labs" });
  const tg = n(i.labs?.triglycerides);
  if (tg !== null) {
    if (tg >= 200) out.push({ text: `Triglycerides ${tg} mg/dL — high`, severity: "warning", source: "Labs" });
    else if (tg >= 150) out.push({ text: `Triglycerides ${tg} mg/dL — borderline`, severity: "info", source: "Labs" });
  }
  const crp = n(i.labs?.hscrp);
  if (crp !== null && crp > 3) out.push({ text: `hsCRP ${crp} mg/L — high cardiovascular risk band`, severity: "warning", source: "Labs" });

  const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
