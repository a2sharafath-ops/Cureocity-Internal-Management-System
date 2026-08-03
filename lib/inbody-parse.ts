// Read an InBody report's text and build a summary WITHOUT an LLM.
//
// Why this exists: the AI summary needs OPENAI_API_KEY, which isn't configured
// yet. Rather than leaving Generate dead until then, this pulls the standard
// InBody fields out of the extracted PDF text and writes a plain, factual
// summary from them. When the key is added the AI takes over and this stays as
// the fallback for any AI outage — so the button always does something useful.
//
// Deliberately conservative: it only reports numbers it actually found, and it
// never invents clinical advice beyond what the numbers plainly show.

export type InbodyMetrics = {
  weight?: number; bmi?: number; bodyFat?: number; fatMass?: number;
  smm?: number; ffm?: number; visceral?: number; whr?: number;
  bmr?: number; score?: number; targetWeight?: number;
  fatControl?: number; muscleControl?: number;
  testDate?: string;
};

/** First capture group of the first pattern that matches, as a number. */
function num(text: string, patterns: RegExp[]): number | undefined {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      // strip thousands separators and normalise the unicode minus InBody prints
      const n = Number(m[1].replace(/,/g, "").replace(/[−–—]/g, "-"));
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

/** Pull the standard InBody fields out of report text. Tolerant of label variants. */
export function parseInbodyText(text: string): InbodyMetrics {
  const t = text.replace(/ /g, " ");
  const N = "(-?[\\d,]+(?:\\.\\d+)?)";
  const m: InbodyMetrics = {
    weight: num(t, [new RegExp(`\\bWeight\\b[^\\n\\d-]{0,20}${N}\\s*kg`, "i")]),
    bmi: num(t, [new RegExp(`\\bBMI\\b[^\\n\\d-]{0,20}${N}`, "i")]),
    bodyFat: num(t, [
      new RegExp(`Percent\\s*Body\\s*Fat[^\\n\\d-]{0,20}${N}`, "i"),
      new RegExp(`\\bPBF\\b[^\\n\\d-]{0,20}${N}`, "i"),
      new RegExp(`Body\\s*Fat\\s*(?:%|Percentage)[^\\n\\d-]{0,20}${N}`, "i"),
    ]),
    fatMass: num(t, [new RegExp(`Body\\s*Fat\\s*Mass[^\\n\\d-]{0,20}${N}\\s*kg`, "i")]),
    smm: num(t, [
      new RegExp(`Skeletal\\s*Muscle\\s*Mass[^\\n\\d-]{0,20}${N}\\s*kg`, "i"),
      new RegExp(`\\bSMM\\b[^\\n\\d-]{0,20}${N}\\s*kg`, "i"),
    ]),
    ffm: num(t, [new RegExp(`Fat\\s*Free\\s*Mass[^\\n\\d-]{0,20}${N}\\s*kg`, "i")]),
    visceral: num(t, [new RegExp(`Visceral\\s*Fat(?:\\s*Level|\\s*Area)?[^\\n\\d-]{0,20}${N}`, "i")]),
    whr: num(t, [new RegExp(`Waist[-\\s]*Hip\\s*Ratio[^\\n\\d-]{0,20}${N}`, "i"), new RegExp(`\\bWHR\\b[^\\n\\d-]{0,20}${N}`, "i")]),
    bmr: num(t, [new RegExp(`Basal\\s*Metabolic\\s*Rate[^\\n\\d-]{0,20}${N}`, "i"), new RegExp(`\\bBMR\\b[^\\n\\d-]{0,20}${N}`, "i")]),
    score: num(t, [new RegExp(`InBody\\s*Score[^\\n\\d-]{0,20}${N}`, "i")]),
    targetWeight: num(t, [new RegExp(`Target\\s*Weight[^\\n\\d-]{0,20}${N}`, "i")]),
    fatControl: num(t, [new RegExp(`Fat\\s*Control[^\\n\\d+−–-]{0,20}([+-−–]?[\\d,]+(?:\\.\\d+)?)`, "i")]),
    muscleControl: num(t, [new RegExp(`Muscle\\s*Control[^\\n\\d+−–-]{0,20}([+-−–]?[\\d,]+(?:\\.\\d+)?)`, "i")]),
  };
  const d = t.match(/Test\s*date\s*:?\s*([^\n]+)/i);
  if (d?.[1]) m.testDate = d[1].trim().slice(0, 40);
  return m;
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/**
 * The report's own test date as YYYY-MM-DD, or null if it can't be read
 * confidently. A measurement must be dated when it was *taken*, not when
 * someone got round to uploading it — otherwise the progress chart lies.
 * Handles "03 Aug 2026", "3 August 2026", "2026-08-03" and "03/08/2026"
 * (day-first, matching Indian convention).
 */
export function parseInbodyDate(text: string): string | null {
  const raw = text.match(/Test\s*date\s*:?\s*([^\n]+)/i)?.[1]?.trim();
  if (!raw) return null;

  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dMonY = raw.match(/(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})/);
  if (dMonY) {
    const mm = MONTHS[dMonY[2].slice(0, 3).toLowerCase()];
    if (mm) return `${dMonY[3]}-${mm}-${dMonY[1].padStart(2, "0")}`;
  }
  const dmy = raw.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);   // day-first
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return null;
}

/** How many fields were recognised — used to decide whether parsing was worthwhile. */
export function metricCount(m: InbodyMetrics): number {
  return Object.values(m).filter((v) => v !== undefined && v !== null).length;
}

const one = (n: number) => (Math.round(n * 10) / 10).toString();

/**
 * A short, factual summary built only from what was parsed. Mirrors the shape
 * the AI produces (a few lines, metrics then observations) so the care team
 * reads the same thing either way.
 */
export function inbodySummaryFromText(text: string, gender?: string | null): string | null {
  const m = parseInbodyText(text);
  if (metricCount(m) < 3) return null;   // not enough recognised — don't guess

  const g = (gender ?? "").trim().toLowerCase();
  const fatHigh = m.bodyFat !== undefined && (g.startsWith("f") ? m.bodyFat > 30 : m.bodyFat > 20);
  const bmiNormal = m.bmi !== undefined && m.bmi >= 18.5 && m.bmi < 25;

  const head: string[] = [];
  if (m.weight !== undefined) head.push(`weight ${one(m.weight)} kg`);
  if (m.bmi !== undefined) head.push(`BMI ${one(m.bmi)}`);
  if (m.bodyFat !== undefined) head.push(`body fat ${one(m.bodyFat)}%`);
  if (m.smm !== undefined) head.push(`skeletal muscle ${one(m.smm)} kg`);
  if (m.visceral !== undefined) head.push(`visceral fat level ${one(m.visceral)}`);

  const lines: string[] = [];
  lines.push(`InBody${m.testDate ? ` (${m.testDate})` : ""}: ${head.join(" · ")}.`);

  const extra: string[] = [];
  if (m.ffm !== undefined) extra.push(`fat-free mass ${one(m.ffm)} kg`);
  if (m.fatMass !== undefined) extra.push(`fat mass ${one(m.fatMass)} kg`);
  if (m.whr !== undefined) extra.push(`WHR ${m.whr}`);
  if (m.bmr !== undefined) extra.push(`BMR ${Math.round(m.bmr)} kcal/day`);
  if (m.score !== undefined) extra.push(`InBody score ${Math.round(m.score)}`);
  if (extra.length) lines.push(`Also recorded: ${extra.join(" · ")}.`);

  if (bmiNormal && fatHigh) {
    lines.push("BMI sits in the normal range while body fat is above target — a normal-weight, high-body-fat pattern that weight alone would miss.");
  } else if (fatHigh) {
    lines.push("Body fat percentage is above the target range.");
  } else if (m.bodyFat !== undefined) {
    lines.push("Body fat percentage is within the expected range.");
  }
  if (m.visceral !== undefined && m.visceral > 9) {
    lines.push(`Visceral fat level ${one(m.visceral)} is above the usual cut-off of 9 — worth tracking alongside the metabolic markers.`);
  }

  const goals: string[] = [];
  if (m.fatControl !== undefined && m.fatControl !== 0) goals.push(`fat ${m.fatControl > 0 ? "+" : ""}${one(m.fatControl)} kg`);
  if (m.muscleControl !== undefined && m.muscleControl !== 0) goals.push(`muscle ${m.muscleControl > 0 ? "+" : ""}${one(m.muscleControl)} kg`);
  if (m.targetWeight !== undefined) goals.push(`target weight ${one(m.targetWeight)} kg`);
  if (goals.length) lines.push(`Device targets: ${goals.join(" · ")}.`);

  lines.push("Auto-extracted from the uploaded InBody report — figures not yet reviewed by a clinician.");
  return lines.join("\n");
}
