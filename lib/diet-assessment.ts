// The Dietary Assessment Summary — the companion document to the diet plan.
//
// Most of it is already in the app: the client record, the Diet questionnaire
// and the InBody. So this drafts itself and the dietitian corrects, rather than
// being retyped from a consultation that already happened.
//
// What was NOT already captured, and so lives on the assessment row: occupation
// and activity level, the exercise-routine table, sleep, BMR/TEE, target weight
// and timeline, meal frequency, and the medication table.

export type ExerciseRow = { type: string; frequency: string; duration: string };
export type MedicationRow = { medication: string; notes: string };

export type StressLevel = "low" | "medium" | "high" | null;

export type Assessment = {
  // ---- consultation -------------------------------------------------------
  consulted_on: string | null;
  dietitian: string | null;
  medical_history: string | null;
  existing_condition: string | null;
  medications: MedicationRow[];
  allergies: string | null;
  family_history: string | null;

  // ---- lifestyle ----------------------------------------------------------
  occupation: string | null;
  daily_activity: string | null;
  exercise: ExerciseRow[];
  sleep_hours: string | null;
  sleep_quality: string | null;
  stress_level: StressLevel;
  gut_health: string | null;
  weight_change: string | null;

  // ---- dietary preference -------------------------------------------------
  diet_type: string | null;
  food_allergies: string | null;
  food_dislikes: string | null;
  supplements: string | null;

  // ---- current health status ---------------------------------------------
  height: number | null;
  weight: number | null;
  bmi: number | null;
  bmr: number | null;
  tee: number | null;
  muscle_mass: number | null;
  fat_mass: number | null;
  body_fat: number | null;
  visceral_fat: number | null;
  waist_hip: number | null;

  // ---- goals --------------------------------------------------------------
  primary_goals: string | null;
  target_weight: number | null;
  timeline_weeks: number | null;
  objectives: string | null;

  // ---- intake -------------------------------------------------------------
  meal_frequency: string | null;
  meals_per_day: string | null;
  snacking: string | null;
  hydration: string | null;

  notes: string | null;
};

/**
 * Activity multipliers applied to BMR to reach total daily energy expenditure.
 * The standard Harris–Benedict factors; the labels are what the dietitian picks
 * from, so they match the words on the issued document.
 */
export const ACTIVITY_FACTORS: [string, number][] = [
  ["Sedentary", 1.2],
  ["Lightly active", 1.375],
  ["Moderately active", 1.55],
  ["Very active", 1.725],
  ["Extremely active", 1.9],
];

export function activityFactor(label: string | null | undefined): number | null {
  if (!label) return null;
  const hit = ACTIVITY_FACTORS.find(([l]) => l.toLowerCase() === String(label).trim().toLowerCase());
  return hit ? hit[1] : null;
}

/**
 * Estimated BMR by Mifflin–St Jeor.
 *
 * An ESTIMATE, and only a fallback. The InBody measures BMR directly and its
 * figure is the one the clinic uses — on the sample assessment the machine said
 * 1500 where this formula gives 1644, a 10% gap. Showing a computed number
 * where a measured one exists would quietly change the client's calorie target.
 */
export function mifflinStJeor(sex: string | null, kg: number | null, cm: number | null, age: number | null): number | null {
  if (!kg || !cm || !age) return null;
  const base = 10 * kg + 6.25 * cm - 5 * age;
  const female = String(sex ?? "").trim().toLowerCase().startsWith("f");
  return Math.round(base + (female ? -161 : 5));
}

/** Total daily energy expenditure: BMR × activity factor. */
export function estimateTee(bmr: number | null, activity: string | null): number | null {
  const f = activityFactor(activity);
  if (!bmr || !f) return null;
  // Rounded to the nearest 50: a calorie target of 1837 implies a precision
  // nobody has, and the clinic writes round numbers.
  return Math.round((bmr * f) / 50) * 50;
}

export function bmiFrom(kg: number | null, cm: number | null): number | null {
  if (!kg || !cm) return null;
  const m = cm / 100;
  return Math.round((kg / (m * m)) * 10) / 10;
}

export function waistHipFrom(waist: number | null, hip: number | null): number | null {
  if (!waist || !hip) return null;
  return Math.round((waist / hip) * 100) / 100;
}

/** Fat mass in kg, from weight and body-fat percentage. */
export function fatMassFrom(kg: number | null, bodyFatPct: number | null): number | null {
  if (!kg || !bodyFatPct) return null;
  return Math.round(kg * (bodyFatPct / 100) * 10) / 10;
}

/** Age in whole years on a given day. */
export function ageOn(dob: string | null | undefined, on: Date = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(`${String(dob).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(+d)) return null;
  let age = on.getUTCFullYear() - d.getUTCFullYear();
  const m = on.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < d.getUTCDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

/**
 * Find a questionnaire answer by matching the question text.
 *
 * Matched on the question rather than an index, for the same reason the console
 * posts the question alongside the answer: the list is filtered by gender and
 * by which diet milestone it is, so position is not stable.
 */
export function answerTo(answers: [string, string][], re: RegExp): string | null {
  for (const [q, a] of answers) {
    if (re.test(q)) {
      const v = String(a ?? "").trim();
      if (v) return v;
    }
  }
  return null;
}

/** Read a stress level out of free text. The questionnaire asks about stress in
 *  prose; the document wants one of three boxes ticked. */
export function stressFrom(text: string | null): StressLevel {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\bhigh\b|severe|constant|overwhelm/.test(t)) return "high";
  if (/\bmoderate\b|\bmedium\b|manageable|some stress/.test(t)) return "medium";
  if (/\blow\b|minimal|rarely|no stress|none/.test(t)) return "low";
  return null;
}

export type DraftSources = {
  client: { dob: string | null; gender: string | null; occupation: string | null; height: number | null; weight: number | null; conditions: string | null; goals: string[] | null };
  measurement: { weight: number | null; bmi: number | null; body_fat: number | null; muscle_mass: number | null; visceral_fat: number | null; waist: number | null; hip: number | null; bmr?: number | null } | null;
  allergies: string[];
  answers: [string, string][];
  dietitian: string | null;
  consultedOn: string | null;
};

/**
 * Assemble a first draft from everything already recorded.
 *
 * Every field here is editable afterwards. The point is that a dietitian who
 * has just spent an hour on the questionnaire shouldn't then retype it into a
 * second document — they should be correcting a draft.
 */
export function draftAssessment(s: DraftSources, today: Date = new Date()): Assessment {
  const m = s.measurement;
  const age = ageOn(s.client.dob, today);
  const kg = m?.weight ?? s.client.weight ?? null;
  const cm = s.client.height ?? null;
  // Measured beats estimated, always.
  const bmr = m?.bmr ?? mifflinStJeor(s.client.gender, kg, cm, age);

  return {
    consulted_on: s.consultedOn,
    dietitian: s.dietitian,
    medical_history: answerTo(s.answers, /medical (history|conditions)/i),
    existing_condition: s.client.conditions,
    medications: [],
    allergies: s.allergies.length ? s.allergies.join(", ") : null,
    family_history: answerTo(s.answers, /family history/i),

    occupation: s.client.occupation,
    daily_activity: null,
    exercise: [],
    sleep_hours: null,
    sleep_quality: null,
    stress_level: stressFrom(answerTo(s.answers, /stress/i)),
    gut_health: answerTo(s.answers, /gut health|bowel habits/i) ?? answerTo(s.answers, /gut\/digestive/i),
    weight_change: answerTo(s.answers, /weight patterns/i),

    diet_type: answerTo(s.answers, /special diets/i),
    food_allergies: answerTo(s.answers, /preferences \/ intolerances \/ allergies|food.*allerg/i),
    food_dislikes: answerTo(s.answers, /aversions or dislikes/i),
    supplements: answerTo(s.answers, /supplement/i),

    height: cm,
    weight: kg,
    bmi: m?.bmi ?? bmiFrom(kg, cm),
    bmr,
    tee: null,                      // needs the activity level, which is asked below
    muscle_mass: m?.muscle_mass ?? null,
    fat_mass: fatMassFrom(kg, m?.body_fat ?? null),
    body_fat: m?.body_fat ?? null,
    visceral_fat: m?.visceral_fat ?? null,
    waist_hip: waistHipFrom(m?.waist ?? null, m?.hip ?? null),

    primary_goals: s.client.goals?.length ? s.client.goals.join("\n") : answerTo(s.answers, /health goals/i),
    target_weight: null,
    timeline_weeks: null,
    objectives: s.client.goals?.length ? s.client.goals.join("\n") : null,

    meal_frequency: null,
    meals_per_day: null,
    snacking: answerTo(s.answers, /cravings and comfort/i),
    hydration: answerTo(s.answers, /water intake/i),

    notes: null,
  };
}

/** What still needs a human before the document is worth issuing. */
export function assessmentGaps(a: Assessment): string[] {
  const gaps: string[] = [];
  if (!a.height || !a.weight) gaps.push("Height and weight — the whole health-status page depends on them.");
  if (!a.daily_activity) gaps.push("Daily activity level — without it there is no TEE, and no calorie target.");
  if (!a.bmr) gaps.push("BMR — take it from the InBody, or it will be estimated.");
  if (!a.primary_goals) gaps.push("Primary goals.");
  return gaps;
}
