export const BASELINE_VERSION = "Cureocity HC360 baseline v1.0";

export type BaselineAnswer = string | number | null;
export type BaselineAnswers = Record<string, BaselineAnswer>;

type ShowWhen = { id: string; equals: string };
export type BaselineQuestion = {
  id: string;
  text: string;
  type: "text" | "number" | "time" | "select" | "scale";
  options?: readonly string[];
  min?: number;
  max?: number;
  required?: boolean;
  showWhen?: ShowWhen;
  help?: string;
};

export type BaselineModule = {
  key: string;
  title: string;
  purpose: string;
  questions: BaselineQuestion[];
};

const YES_NO = ["Yes", "No"] as const;
const DAYS = ["0", "1", "2", "3", "4", "5", "6", "7"] as const;

export const STAGES = [
  "1 — Not considering change",
  "2 — Considering change",
  "3 — Preparing",
  "4 — Acting",
  "5 — Maintaining",
] as const;

export const BASELINE_MODULES: BaselineModule[] = [
  {
    key: "communication", title: "Identity & communication",
    purpose: "How the client wants to be contacted and what affects availability.",
    questions: [
      { id: "preferred_name", text: "Preferred name", type: "text", required: true },
      { id: "language", text: "Preferred coaching language", type: "text", required: true },
      { id: "channel", text: "Preferred routine check-in channel", type: "select", options: ["WhatsApp", "App", "Phone", "In person"], required: true },
      { id: "response_window", text: "Easiest time to respond", type: "text", required: true, help: "For example: 7–9 pm" },
      { id: "schedule_changes", text: "Does the work/study schedule change regularly?", type: "select", options: YES_NO, required: true },
      { id: "shift_work", text: "Night or rotating shifts?", type: "select", options: YES_NO, required: true },
      { id: "travel", text: "Work/personal travel frequency", type: "select", options: ["Never", "Less than monthly", "1–3 times a month", "Weekly", "More than weekly"], required: true },
      { id: "caregiving", text: "How often do caregiving duties affect routines?", type: "select", options: ["Never", "Rarely", "Sometimes", "Often", "Almost always"], required: true },
    ],
  },
  {
    key: "motivation", title: "Goals, motivation & stage",
    purpose: "What matters, why it matters and how ready the client is now.",
    questions: [
      { id: "start_reason", text: "What made the client decide to start now?", type: "text", required: true },
      { id: "primary_change", text: "Most important change wanted from the programme", type: "text", required: true },
      { id: "personal_why", text: "Why does that change matter?", type: "text", required: true },
      { id: "importance", text: "Importance now", type: "scale", min: 0, max: 10, required: true, help: "0 = not important at all · 10 = extremely important" },
      { id: "confidence", text: "Confidence in taking the first step", type: "scale", min: 0, max: 10, required: true, help: "0 = not at all confident · 10 = completely confident" },
      { id: "readiness", text: "Readiness to act now", type: "scale", min: 0, max: 10, required: true, help: "0 = not ready · 10 = ready to act now" },
      { id: "stage", text: "Coach-selected stage of change", type: "select", options: STAGES, required: true },
      { id: "prior_strength", text: "What helped when change worked before?", type: "text", required: true },
      { id: "usual_stop", text: "What usually caused the client to stop?", type: "text", required: true },
    ],
  },
  {
    key: "routine", title: "Daily routine",
    purpose: "Objective timing and disruption rather than a vague routine score.",
    questions: [
      { id: "wake_workday", text: "Usual workday wake time", type: "time", required: true },
      { id: "work_start", text: "Usual work/study start", type: "time", required: true },
      { id: "work_finish", text: "Usual work/study finish", type: "time", required: true },
      { id: "seated_hours", text: "Hours seated/inactive per day", type: "number", min: 0, max: 24, required: true },
      { id: "difficult_window", text: "Hardest part of day for routines", type: "select", options: ["Morning", "Afternoon", "Evening", "Night", "Variable"], required: true },
      { id: "routine_disrupted_days", text: "Days disrupted by work/family/travel in the past 7 days", type: "select", options: DAYS, required: true },
    ],
  },
  {
    key: "sleep", title: "Sleep",
    purpose: "Timing and symptoms first; formal screening opens only when indicated.",
    questions: [
      { id: "bed_time", text: "Usual bedtime in the past 7 days", type: "time", required: true },
      { id: "wake_time", text: "Usual wake time in the past 7 days", type: "time", required: true },
      { id: "sleep_hours", text: "Average hours slept per night", type: "number", min: 0, max: 24, required: true },
      { id: "wake_struggle_days", text: "Nights waking and struggling to return to sleep", type: "select", options: DAYS, required: true },
      { id: "unrefreshed_days", text: "Days waking unrefreshed", type: "select", options: DAYS, required: true },
      { id: "snoring_pauses", text: "Loud snoring or breathing pauses noticed?", type: "select", options: ["Yes", "No", "Unknown"], required: true },
      { id: "caffeine_after_2", text: "Caffeinated drinks after 2 pm on an average day", type: "select", options: ["0", "1", "2", "3+"], required: true },
      { id: "screen_in_bed_days", text: "Nights using a screen in bed after intending to sleep", type: "select", options: DAYS, required: true },
    ],
  },
  {
    key: "activity", title: "Physical activity",
    purpose: "Current movement and symptoms; the coach does not alter an exercise prescription.",
    questions: [
      { id: "activity_days", text: "Days with at least 10 minutes intentional activity", type: "select", options: DAYS, required: true },
      { id: "activity_minutes", text: "Usual minutes on those days", type: "number", min: 0, max: 1440, required: true },
      { id: "strength_days", text: "Strength/resistance exercise days", type: "select", options: DAYS, required: true },
      { id: "walk_days", text: "Planned walk/moderate activity days", type: "select", options: DAYS, required: true },
      { id: "activity_barrier", text: "Main activity barrier", type: "text", required: true },
      { id: "activity_symptom", text: "Pain, unusual breathlessness, dizziness, chest discomfort or fainting during activity?", type: "select", options: YES_NO, required: true },
      { id: "activity_symptom_detail", text: "Record the symptom and when it occurred", type: "text", required: true, showWhen: { id: "activity_symptom", equals: "Yes" } },
    ],
  },
  {
    key: "nutrition", title: "Nutrition behaviour & environment",
    purpose: "Implementation of the dietitian's plan—not a new diet prescription.",
    questions: [
      { id: "meal_structure_days", text: "Days following the agreed meal structure", type: "select", options: [...DAYS, "Not applicable"], required: true },
      { id: "food_log_days", text: "Days completing the requested food log/photo", type: "select", options: [...DAYS, "Not requested"], required: true },
      { id: "hardest_meal", text: "Hardest meal to follow", type: "select", options: ["Breakfast", "Lunch", "Dinner", "Snacks", "Variable", "Not applicable"], required: true },
      { id: "eating_disruption_days", text: "Days work/travel/social events changed the eating routine", type: "select", options: DAYS, required: true },
      { id: "emotional_eating", text: "Eating in response to emotions in the past 7 days", type: "select", options: ["Never", "1–2 days", "3–4 days", "5–6 days", "7 days"], required: true },
      { id: "loss_of_control", text: "Loss of control while eating in the past 7 days", type: "select", options: ["Never", "1–2 days", "3–4 days", "5–6 days", "7 days"], required: true },
      { id: "meal_preparer", text: "Who usually decides/prepares main meals?", type: "select", options: ["Self", "Partner", "Family", "Shared", "Outside food"], required: true },
      { id: "diet_plan_barrier", text: "Is cost, availability, cooking time or family preference making the current plan difficult?", type: "select", options: YES_NO, required: true },
      { id: "diet_plan_barrier_detail", text: "Which practical barrier?", type: "text", required: true, showWhen: { id: "diet_plan_barrier", equals: "Yes" } },
    ],
  },
  {
    key: "stress_mood", title: "Stress, mood & anxiety triggers",
    purpose: "Objective interference questions decide whether an approved screener is needed.",
    questions: [
      { id: "work_blocked_days", text: "Days work/study prevented a planned health behaviour", type: "select", options: DAYS, required: true },
      { id: "no_time_days", text: "Days with no usable time for health routines", type: "select", options: DAYS, required: true },
      { id: "stress_sleep_days", text: "Days stress interfered with sleep", type: "select", options: DAYS, required: true },
      { id: "stress_source", text: "Main source of stress", type: "select", options: ["None", "Work", "Family", "Financial", "Health", "Relationship", "Other"], required: true },
      { id: "worry_concern", text: "Current worry, restlessness or anxiety concern?", type: "select", options: YES_NO, required: true },
      { id: "low_mood_concern", text: "Current low mood or loss-of-interest concern?", type: "select", options: YES_NO, required: true },
    ],
  },
  {
    key: "substance", title: "Alcohol, nicotine & other substances",
    purpose: "Non-judgemental gates open only the applicable validated pathway.",
    questions: [
      { id: "uses_alcohol", text: "Currently consumes alcohol?", type: "select", options: YES_NO, required: true },
      { id: "heavy_daily_alcohol", text: "Heavy daily use or possible withdrawal concern?", type: "select", options: YES_NO, required: true, showWhen: { id: "uses_alcohol", equals: "Yes" } },
      { id: "uses_nicotine", text: "Currently smokes, vapes or uses tobacco?", type: "select", options: YES_NO, required: true },
      { id: "uses_other_drugs", text: "Non-medical or recreational drug use?", type: "select", options: YES_NO, required: true },
    ],
  },
  {
    key: "support", title: "Support, environment & access",
    purpose: "The people and practical conditions affecting follow-through.",
    questions: [
      { id: "support_people", text: "People the client could realistically ask for help", type: "select", options: ["0", "1", "2", "3+"], required: true },
      { id: "supported_days", text: "Days supported in health goals in the past 7 days", type: "select", options: DAYS, required: true },
      { id: "social_barrier_days", text: "Days family/social situations made the plan harder", type: "select", options: DAYS, required: true },
      { id: "practical_place", text: "Practical place at home/work for the planned behaviour?", type: "select", options: YES_NO, required: true },
      { id: "cost_barrier", text: "Is cost preventing any agreed part of the plan?", type: "select", options: YES_NO, required: true },
      { id: "cost_barrier_detail", text: "Record the exact cost/access barrier", type: "text", required: true, showWhen: { id: "cost_barrier", equals: "Yes" } },
    ],
  },
];

export function questionIsVisible(question: BaselineQuestion, answers: BaselineAnswers) {
  return !question.showWhen || String(answers[question.showWhen.id] ?? "") === question.showWhen.equals;
}

function validBaselineAnswer(question: BaselineQuestion, value: unknown): value is string | number {
  if (question.type === "select") return typeof value === "string" && Boolean(question.options?.includes(value));
  if (question.type === "text") return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 2000;
  if (question.type === "time") return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (question.type === "number" || question.type === "scale") {
    return typeof value === "number" && Number.isFinite(value)
      && (question.min == null || value >= question.min)
      && (question.max == null || value <= question.max)
      && (question.type !== "scale" || Number.isInteger(value));
  }
  return false;
}

/** Keep only values that match the declared module, option and numeric range.
 * This runs on the server so browser controls are never the only protection
 * on a clinical baseline record. */
export function sanitizeBaselineAnswers(raw: Record<string, unknown>): BaselineAnswers {
  const questions = BASELINE_MODULES.flatMap((module) => module.questions);
  const firstPass: BaselineAnswers = {};
  for (const question of questions) {
    const value = raw[question.id];
    if (validBaselineAnswer(question, value)) firstPass[question.id] = typeof value === "string" ? value.trim() : value;
  }
  return Object.fromEntries(Object.entries(firstPass).filter(([id]) => {
    const question = questions.find((candidate) => candidate.id === id);
    return Boolean(question && questionIsVisible(question, firstPass));
  }));
}

export function baselineProgress(answers: BaselineAnswers) {
  const required = BASELINE_MODULES.flatMap((module) => module.questions)
    .filter((question) => question.required && questionIsVisible(question, answers));
  const complete = required.filter((question) => {
    const value = answers[question.id];
    return value !== null && value !== undefined && String(value).trim() !== "";
  });
  return {
    completed: complete.length,
    total: required.length,
    percent: required.length ? Math.round((complete.length / required.length) * 100) : 0,
    missing: required.filter((question) => !complete.includes(question)).map((question) => question.id),
  };
}

const positiveNumber = (answers: BaselineAnswers, id: string) => Number(answers[id] ?? 0) > 0;

export function triggeredBaselinePathways(answers: BaselineAnswers) {
  const pathways: string[] = [];
  if (positiveNumber(answers, "wake_struggle_days") || positiveNumber(answers, "unrefreshed_days") || answers.snoring_pauses === "Yes") pathways.push("PSQI sleep screening");
  if (answers.activity_symptom === "Yes") pathways.push("Official PAR-Q+ / clinical clearance");
  if (positiveNumber(answers, "stress_sleep_days") || (answers.stress_source && answers.stress_source !== "None")) pathways.push("PSS-10 stress screening");
  if (answers.worry_concern === "Yes") pathways.push("GAD-7 anxiety screening");
  if (answers.low_mood_concern === "Yes") pathways.push("PHQ-9 mood screening");
  if (answers.uses_alcohol === "Yes") pathways.push("AUDIT-C alcohol screening");
  if (answers.uses_nicotine === "Yes") pathways.push("Fagerström nicotine screening");
  if (answers.uses_other_drugs === "Yes") pathways.push("DAST-10 drug screening");
  if (answers.heavy_daily_alcohol === "Yes") pathways.push("Urgent alcohol/withdrawal clinical review");
  if (answers.loss_of_control && answers.loss_of_control !== "Never") pathways.push("Eating-behaviour review");
  return pathways;
}
