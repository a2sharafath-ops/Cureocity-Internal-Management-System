// In-session intake questionnaires per consultation kind (mirrors the prototype).
// Keyed by consultation `kind` (Doctor | Diet | Trainer | Coach | Psychologist).

import type { QConditions } from "@/lib/consult-conditions";
import { YES_NO, SCALE_10, type QTypes } from "@/lib/answer-input";

export type ConsultQ = {
  label: string;
  icon: string;
  questions: string[];
  /** Follow-ups that only apply once an earlier answer opens them. */
  conditions?: QConditions;
  /** Questions answered by tapping rather than typing. Free text stays
   *  available underneath — see lib/answer-input.ts. */
  types?: QTypes;
  /**
   * What the clinician says to open a section, keyed by section heading.
   *
   * The Health Coach flow is a script, not a form: "I ask everyone about this,
   * not because something is wrong, but because it helps us plan better" is the
   * line that makes the stress questions land as care rather than assessment.
   * Stripping it and keeping only the questions would lose the part that took
   * the most thought to write.
   */
  intros?: Record<string, string>;
};

/**
 * Health Coach questions that other questions hang off.
 *
 * Named rather than repeated, because a condition is matched on the parent's
 * exact text — a stray comma between the list and the rule would silently leave
 * the follow-up permanently hidden, with nothing to show that it had broken.
 */
export const COACH_Q = {
  feeling: "Welcome — how are you feeling today?",
  triedBefore: "Goals — have you tried anything before for this goal?",
  exerciseLimit: "Activity — do you have any pain, injury, breathing difficulty, dizziness or medical restriction during exercise?",
  foodTrouble: "Nutrition — do you have any food allergies, acidity, bloating, constipation or food intolerance?",
  tobacco: "Substance use — do you smoke or use tobacco in any form?",
  alcohol: "Substance use — do you consume alcohol?",
  worried: "Anxiety — do you often feel worried, restless or mentally overloaded?",
  panic: "Anxiety — do you ever experience fast heartbeat, chest tightness, sweating, fear or panic-like feelings?",
  avoidance: "Anxiety — are there situations you avoid because of fear or anxiety?",
  confidenceScore: "Confidence — on a scale of 1 to 10, how confident are you that you can start with one small change this week?",
  // Named because lib/coach-signals.ts reads them — an answer here decides
  // whether the coach is told to get medical clearance before prescribing
  // exercise, so matching on a regex over the text would be too loose.
  stressLevel: "Stress — how would you describe your current stress level: low, moderate or high?",
  emotionalLoad: "Stress — is there anything that has been emotionally heavy for you recently?",
  freshOnWaking: "Sleep — do you feel fresh when you wake up?",
  sleepTrouble: "Sleep — do you have difficulty falling asleep, staying asleep, or waking up too early?",
  snoring: "Sleep — do you snore, wake up choking, or feel very sleepy during the day?",
  cardiacRedFlag: "Activity — have you ever felt chest pain, unusual breathlessness, or fainting during activity?",
  readiness: "Goals — on a scale of 1 to 10, how ready do you feel to make lifestyle changes right now?",
  cutDownReadiness: "Substance use — on a scale of 1 to 10, how ready are you to cut down or stop?",
  openToPsych: "Anxiety — would you be open to speaking with a mental health professional if we feel extra support would help?",
} as const;

export const CONSULT_QUESTIONS: Record<string, ConsultQ> = {
  // Doctor's initial consultation — the clinic's functional-medicine life-history
  // intake (10 steps: prenatal → current lifestyle → family → environment →
  // investigations & vitals).
  Doctor: {
    label: "Medical Consultation Intake", icon: "🩺",
    questions: [
      "Primary goal / reason for visit",
      "Prenatal — maternal health during pregnancy (diet, stress, toxins/medications)",
      "Prenatal — mode of delivery (vaginal / C-section)",
      "Prenatal — birth weight & gestational age (term/preterm)",
      "Prenatal — birth complications (NICU, infections, jaundice)",
      "Early childhood (0–5) — feeding practices (breastfeeding / formula / weaning)",
      "Early childhood — growth milestones (physical, mental, emotional)",
      "Early childhood — early illnesses (recurrent infections, hospitalizations)",
      "Early childhood — environmental exposures (smoke, mold, pollution)",
      "Early childhood — family stressors / instability",
      "School age (6–12) — dietary habits (lunchbox, snacking, junk food)",
      "School age — physical activity & sports",
      "School age — academic stress or bullying",
      "School age — sleep pattern & quality",
      "School age — childhood diseases (asthma, allergies, infections)",
      "Adolescence (13–18) — growth & puberty milestones (menarche, height spurts)",
      "Adolescence — eating habits (junk food, dieting)",
      "Adolescence — sleep duration & disturbances",
      "Adolescence — physical activity (sports, gym, sedentary)",
      "Adolescence — stress levels (academic, peer)",
      "Adolescence — smoking / alcohol / recreational-drug exposure",
      "Early adulthood (19–30) — dietary patterns (balanced vs processed)",
      "Early adulthood — physical activity routine",
      "Early adulthood — sleep quality & recovery",
      "Early adulthood — stressors (work, relationships, financial)",
      "Early adulthood — environmental toxins (workplace chemicals, pollution)",
      "Early adulthood — specify toxin & duration of exposure",
      "Early adulthood — medical conditions diagnosed",
      "Current — medical conditions (name, since when, treatment type & duration)",
      "Current — impaired fasting glucose / pre-diabetes?",
      "Current — diabetes mellitus status",
      "Current — treatment for hypertension? (antihypertensive prescribed?)",
      "Current — prescribed steroids?",
      "Current — ongoing medications & supplements (names, dosages, frequency, since when)",
      "Current — allergies (food, drug, environmental)",
      "Current — specify allergy & allergen",
      "Current — recent illness / checkups / investigations",
      "Current — smoking history (cigarettes per day/week, since how long)",
      "Current — passive smoking",
      "Current — alcohol (quantity, frequency, since how long)",
      "Current — bowel movements (frequency & since when)",
      "Gut — water intake per day (litres)",
      "Gut — abdominal pain at least 1 day/week in the last 3 months?",
      "Gut — is pain related to defecation (better/worse with toileting)?",
      "Gut — change in stool frequency?",
      "Gut — change in stool form (harder/softer)?",
      "Gut — symptom onset at least 6 months ago?",
      "Gut — IBS subtype classification",
      "Nutrition — current diet (meals, snacks, water intake)",
      "Nutrition — special diets (keto, intermittent fasting)",
      "Nutrition — food preferences / intolerances",
      "Activity — current workout routine (type, frequency, intensity)",
      "Activity — limitations to locomotion",
      "Activity — sedentary behaviour / screen time",
      "Sleep & recovery — sleep time, wake time, duration, quality, recovery",
      "Energy levels & recovery after activity",
      "Mental health — current stressors & coping mechanisms",
      "Mental health — history of anxiety, depression or treatment",
      "Female — menstrual cycle (LMP, regularity, pain, PMS)",
      "Female — pregnancy history (P/L/A, complications, gestational diabetes)",
      "Female — menopause status & symptoms",
      "Family history — chronic diseases by relative (father, mother, siblings, grandparents)",
      "Family history — diabetes",
      "Family history — parent with heart attack (MI) before age 60",
      "Family history — mental health conditions",
      "Family history — longevity & cause of death of close relatives",
      "Environment — home (air quality, ventilation, mold)",
      "Environment — work (stress, toxins, chemicals)",
      "Psychosocial — social support system",
      "Psychosocial — history of trauma or abuse",
      "Hobbies, leisure & personal interests",
      "Investigations — previous lab / genetic / epigenetic tests",
      "Investigations — body composition (BMI, fat %)",
      "Investigations — biomarkers & fitness assessment",
      "Investigations — routine tests to prescribe",
      "Vitals — HR (bpm), SpO2 (%), BP (mmHg), chest auscultation",
      "Labs — SBP (mm Hg)",
      "Labs — fasting glucose (mg/dL)",
      "Labs — HbA1c (% gly Hgb)",
      "Labs — total cholesterol (mg/dL)",
      "Labs — HDL-c (mg/dL)",
      "Labs — triglycerides (mg/dL)",
      "Labs — hsCRP (mg/L)",
      "Labs — AST (U/L)",
      "Labs — ALT (U/L)",
      "Labs — platelet count (×10³/µL)",
      "Labs — albumin (g/dL)",
      "Labs — cardiovascular risk region (country category)",
    ],
  },
  // Initial diet consultation — also used for the Day-21 review. Mirrors the
  // clinic's "Revised dietitian questionnaire" (Section 2 + Section 3).
  Diet: {
    label: "Diet & Lifestyle Intake", icon: "",
    questions: [
      "Daily dietary habits (meals, snacks, portion sizes, timings)",
      "Diet quality check — how often: staple grains, whole grains, roots/tubers, legumes, vitamin-A orange veg, dark leafy greens, other veg, vitamin-A fruits, citrus, other fruits, grain sweets, other sweets, eggs, cheese, yogurt, processed meat, unprocessed red meat (ruminant & non-ruminant), poultry, fish/seafood, nuts & seeds, packaged salty snacks, instant noodles, deep-fried foods, fluid milk, sweetened tea/coffee/milk drinks, fruit juice, SSBs, fast food",
      "Special diets followed (low-carb/keto/Atkins · plant-based veg/vegan/pescatarian · fasting IF/OMAD/religious · high-protein/paleo/zone) — or Nil",
      "Water intake",
      "Food preferences / intolerances / allergies",
      "Cravings and comfort foods",
      "Eating-out frequency",
      "Cultural or religious dietary restrictions",
      "Food aversions or dislikes",
      "Stress — stressful situations",
      "Stress — coping mechanisms",
      "Gut health — bowel habits (frequency, consistency)",
      "Gut/digestive concerns (bloating, IBS, acid reflux, irregular bowel)",
      "Fiber intake",
      "History of antibiotics / probiotics use",
      "Family history of metabolic diseases (diabetes, hypertension, obesity)",
      "Weight patterns over life (fluctuating / steady)",
      "History of weight-loss attempts (successful or not)",
      "Lifestyle changes impacting health (shift work, pregnancy, major life events)",
      "Health goals (weight loss/gain, fitness, manage conditions, energy, muscle mass, gut/digestive goals)",
      "24-hour recall — Breakfast",
      "24-hour recall — Mid-morning snack",
      "24-hour recall — Lunch",
      "24-hour recall — Evening snack",
      "24-hour recall — Dinner",
      "24-hour recall — Late-night snack",
      "24-hour recall — Beverages",
      "Evaluation — macronutrient distribution (carbs, protein, fat)",
      "Evaluation — micronutrient deficiencies (iron, calcium, etc.)",
      "Evaluation — caloric intake vs requirement",
    ],
  },
  // The clinic's "Initial Health Coach Consultation Question Flow" — a scripted
  // conversation, not a form. It covers the same ground as the scored
  // instruments in lib/coach-instruments.ts (PSS-10, PSQI, PAR-Q, AUDIT-C,
  // HAM-A) but in the client's own words; the instruments produce the six
  // marker scores, this produces the understanding behind them.
  Coach: {
    label: "Health Coaching Intake", icon: "🌿",
    questions: [
      COACH_Q.feeling,
      "Welcome — what made you decide to start this health journey now?",
      "Welcome — before we talk about food, exercise or goals, is there anything you feel I should understand about you?",
      "Welcome — what does a normal day in your life look like?",
      "Welcome — what do you feel is your biggest challenge with health right now?",
      "Welcome — if this programme works well for you, what would you like to feel or see differently after 3 months?",

      "Goals — what is your main goal right now?",
      "Goals — why is this goal important to you personally?",
      COACH_Q.triedBefore,
      "Goals — what worked, and what did not?",
      "Goals — what kind of support do you expect from us?",
      COACH_Q.readiness,
      "Goals — what do you think may make it difficult for you to stay consistent?",

      COACH_Q.stressLevel,
      "Stress — what are the main sources of stress in your life right now?",
      "Stress — when you are stressed, how does it usually show up in your body or behaviour?",
      "Stress — do you notice stress affecting your food choices, sleep, digestion or energy?",
      "Stress — what do you currently do to relax or calm yourself?",
      COACH_Q.emotionalLoad,
      "Stress — when life gets stressful, what kind of support helps you most?",

      "Sleep — what time do you usually sleep and wake up?",
      "Sleep — how many hours of sleep do you get on most days?",
      COACH_Q.freshOnWaking,
      COACH_Q.sleepTrouble,
      "Sleep — do you use your phone or a screen close to bedtime?",
      "Sleep — do you take caffeine, tea or coffee in the evening?",
      COACH_Q.snoring,
      "Sleep — what affects your sleep the most: stress, work, phone, late food, children, pain, or something else?",

      // Sex-specific. The cycle drives energy, cravings and sleep — the three
      // things a coach plans around — so leaving it out meant coaching half the
      // clients against a moving baseline nobody had asked about.
      "Female health — are your periods regular?",
      "Female health — do you notice your cycle affecting your energy, cravings or sleep?",
      "Female health — are you pregnant, recently postpartum, or breastfeeding?",
      "Female health — any menopause or perimenopause symptoms: hot flushes, night sweats, disturbed sleep?",

      "Activity — what does movement look like in your current week?",
      "Activity — do you do any walking, workout, yoga, sports or gym currently?",
      "Activity — how many days in a week are you active?",
      "Activity — approximately how many steps do you get daily, if you track it?",
      COACH_Q.exerciseLimit,
      "Activity — what movement does that restrict, and what has a doctor advised?",
      COACH_Q.cardiacRedFlag,
      "Activity — what kind of movement do you enjoy or feel comfortable doing?",
      "Activity — what usually stops you from being active?",
      "Activity — if we start with a very small movement goal, what feels realistic for you?",

      "Nutrition — can you walk me through what you ate yesterday, from morning to night?",
      "Nutrition — how many meals do you usually have in a day?",
      "Nutrition — do you skip meals often?",
      "Nutrition — what time is your first meal and last meal usually?",
      "Nutrition — how often do you eat from outside in a week?",
      "Nutrition — what are your usual cravings: sweet, fried, bakery, tea snacks, rice-heavy meals, or late-night food?",
      "Nutrition — do you feel you eat more when stressed, bored, tired or emotional?",
      "Nutrition — how is your water intake?",
      "Nutrition — how often do you include fruits and vegetables?",
      "Nutrition — how often do you include protein foods like egg, fish, chicken, pulses, paneer, curd or sprouts?",
      COACH_Q.foodTrouble,
      "Nutrition — which ones, and how often does it happen?",
      "Nutrition — who prepares food at home?",
      "Nutrition — what are the foods you cannot avoid, or do not want to remove completely?",

      COACH_Q.tobacco,
      "Substance use — how often do you use it?",
      COACH_Q.alcohol,
      "Substance use — how many times in a week or month?",
      "Substance use — do you feel it affects your sleep, food choices or energy?",
      "Substance use — have you ever felt you wanted to reduce it?",
      COACH_Q.cutDownReadiness,
      "Substance use — what situations usually trigger it: stress, friends, work pressure, boredom, or social events?",

      COACH_Q.worried,
      "Anxiety — do you overthink a lot, especially at night?",
      COACH_Q.panic,
      "Anxiety — does worry affect your sleep, food, work or relationships?",
      COACH_Q.avoidance,
      "Anxiety — how do you usually calm yourself when you feel anxious?",
      "Anxiety — do you feel you have enough emotional support from family or friends?",
      COACH_Q.openToPsych,

      "Confidence — what is one habit you feel confident you can start with?",
      "Confidence — what change feels difficult or overwhelming right now?",
      "Confidence — what has stopped you from staying consistent in the past?",
      "Confidence — do you prefer a strict plan or a flexible plan?",
      "Confidence — do you like tracking daily, or do you prefer weekly check-ins?",
      "Confidence — what kind of reminders or support help you stay consistent?",
      COACH_Q.confidenceScore,
      "Confidence — why did you choose that number, and not a lower one?",
      "Confidence — what would help increase your confidence by one point?",

      "Closing — from everything we discussed, what do you feel is the first area we should focus on?",
      "Closing — what is one small change you are willing to start this week?",
      "Closing — would you prefer to work first on food, sleep, stress, movement or routine consistency?",
      "Closing — is there anything you want me to keep in mind while planning your routine?",
      "Closing — how would you like us to support you between sessions?",
    ],
    conditions: {
      "Goals — what worked, and what did not?": { parent: COACH_Q.triedBefore },
      "Activity — what movement does that restrict, and what has a doctor advised?": { parent: COACH_Q.exerciseLimit },
      "Nutrition — which ones, and how often does it happen?": { parent: COACH_Q.foodTrouble },
      // The whole back half of the substance section is meaningless to someone
      // who does neither — and being asked how ready you are to cut down when
      // you have never smoked reads as an accusation.
      "Substance use — how often do you use it?": { parent: COACH_Q.tobacco },
      "Substance use — how many times in a week or month?": { parent: COACH_Q.alcohol },
      "Substance use — do you feel it affects your sleep, food choices or energy?": { parent: [COACH_Q.tobacco, COACH_Q.alcohol] },
      "Substance use — have you ever felt you wanted to reduce it?": { parent: [COACH_Q.tobacco, COACH_Q.alcohol] },
      "Substance use — on a scale of 1 to 10, how ready are you to cut down or stop?": { parent: [COACH_Q.tobacco, COACH_Q.alcohol] },
      "Substance use — what situations usually trigger it: stress, friends, work pressure, boredom, or social events?": { parent: [COACH_Q.tobacco, COACH_Q.alcohol] },
      "Anxiety — how do you usually calm yourself when you feel anxious?": { parent: [COACH_Q.worried, COACH_Q.panic] },
      [COACH_Q.openToPsych]: { parent: [COACH_Q.worried, COACH_Q.panic, COACH_Q.avoidance] },
      // Motivational interviewing: the question is about the number, so it needs
      // the number — but any number, including a 2, is worth exploring.
      "Confidence — why did you choose that number, and not a lower one?": { parent: COACH_Q.confidenceScore, when: "answered" },
      "Confidence — what would help increase your confidence by one point?": { parent: COACH_Q.confidenceScore, when: "answered" },
    },
    types: {
      // Scales. Written as numbers so the signal rules can read them: a
      // readiness of 2 is a different conversation from a readiness of 9, and
      // "quite low really" is not something any rule can act on.
      [COACH_Q.readiness]: SCALE_10,
      [COACH_Q.cutDownReadiness]: SCALE_10,
      [COACH_Q.confidenceScore]: SCALE_10,

      [COACH_Q.stressLevel]: { kind: "choice", options: ["Low", "Moderate", "High"] },
      "Confidence — do you prefer a strict plan or a flexible plan?": { kind: "choice", options: ["Strict", "Flexible", "A mix"] },
      "Confidence — do you like tracking daily, or do you prefer weekly check-ins?": { kind: "choice", options: ["Daily", "Weekly", "Neither"] },
      "Closing — would you prefer to work first on food, sleep, stress, movement or routine consistency?": { kind: "choice", options: ["Food", "Sleep", "Stress", "Movement", "Routine"] },

      // Yes / no. Every one of these is a question the client answers in a
      // word, and several of them decide whether a follow-up opens at all.
      [COACH_Q.triedBefore]: YES_NO,
      "Stress — do you notice stress affecting your food choices, sleep, digestion or energy?": YES_NO,
      [COACH_Q.emotionalLoad]: YES_NO,
      [COACH_Q.freshOnWaking]: YES_NO,
      [COACH_Q.sleepTrouble]: YES_NO,
      "Sleep — do you use your phone or a screen close to bedtime?": YES_NO,
      "Sleep — do you take caffeine, tea or coffee in the evening?": YES_NO,
      [COACH_Q.snoring]: YES_NO,
      "Female health — are your periods regular?": YES_NO,
      "Female health — do you notice your cycle affecting your energy, cravings or sleep?": YES_NO,
      "Female health — are you pregnant, recently postpartum, or breastfeeding?": YES_NO,
      "Female health — any menopause or perimenopause symptoms: hot flushes, night sweats, disturbed sleep?": YES_NO,
      "Activity — do you do any walking, workout, yoga, sports or gym currently?": YES_NO,
      [COACH_Q.exerciseLimit]: YES_NO,
      [COACH_Q.cardiacRedFlag]: YES_NO,
      "Nutrition — do you skip meals often?": YES_NO,
      "Nutrition — do you feel you eat more when stressed, bored, tired or emotional?": YES_NO,
      [COACH_Q.foodTrouble]: YES_NO,
      [COACH_Q.tobacco]: YES_NO,
      [COACH_Q.alcohol]: YES_NO,
      "Substance use — do you feel it affects your sleep, food choices or energy?": YES_NO,
      "Substance use — have you ever felt you wanted to reduce it?": YES_NO,
      [COACH_Q.worried]: YES_NO,
      "Anxiety — do you overthink a lot, especially at night?": YES_NO,
      [COACH_Q.panic]: YES_NO,
      "Anxiety — does worry affect your sleep, food, work or relationships?": YES_NO,
      [COACH_Q.avoidance]: YES_NO,
      "Anxiety — do you feel you have enough emotional support from family or friends?": YES_NO,
      [COACH_Q.openToPsych]: YES_NO,
    },
    intros: {
      Welcome: "Hi, it's nice to meet you. Before we start, I want this conversation to feel comfortable and not like an interview. The goal is to understand your routine, challenges, and what kind of support will actually work for you.",
      Goals: "Everyone comes with a different reason. Some people want weight loss, some want better energy, better sleep, better confidence, or better health reports. I'd like to understand what matters most to you.",
      Stress: "Stress can affect sleep, eating patterns, energy, cravings and motivation. So I usually ask everyone about this, not because something is wrong, but because it helps us plan better.",
      Sleep: "Sleep is one of the biggest foundations for weight, recovery, mood, cravings and energy. So I'd like to understand your sleep pattern clearly.",
      Activity: "Now I'd like to understand your current activity level. This is not to judge fitness, but to know where we should start safely.",
      Nutrition: "I'm not here to judge your food choices. I just want to understand your normal pattern so we can build a plan that fits your lifestyle.",
      "Substance use": "I ask these questions to everyone because alcohol, smoking, tobacco and similar habits can affect sleep, appetite, recovery, liver health and overall progress. You can answer only what you are comfortable sharing.",
      Anxiety: "Many people experience worry, restlessness, overthinking, or body symptoms like tightness and fast heartbeat. I ask this gently because it helps us understand your overall wellbeing.",
      Confidence: "Before we plan anything, I want to understand what will make this doable for you.",
      Closing: "Thank you for sharing this openly. Based on what you told me, I don't want to overload you with too many changes at once. We will start with the most important and realistic steps first.",
    },
  },
  Psychologist: {
    label: "Psychology Screening Intake", icon: "💬",
    questions: [
      "Presenting concern",
      "Mood over the past 2 weeks",
      "Sleep pattern",
      "Appetite / eating-pattern changes",
      "Main stress triggers",
      "Anxiety level (1–10)",
      "Current coping strategies",
      "Support system",
    ],
  },
  Trainer: {
    label: "PAR-Q & Fitness Readiness", icon: "🏋",
    questions: [
      "Has a doctor ever said you have a heart condition?",
      "Do you feel chest pain during physical activity?",
      "Do you lose balance from dizziness or lose consciousness?",
      "Any bone or joint problem worsened by activity?",
      "Currently on blood-pressure or heart medication?",
      "Any other reason not to do physical activity?",
      "Current activity level",
      "Injuries / limitations to note",
      "Primary fitness goal",
    ],
  },
};

// Dietitian's 10th-day check-in (short, 5–7 min). Used only for the day-10 diet
// follow-up; the initial and day-21 consults use the full Diet intake above.
export const DIET_FOLLOWUP_10: ConsultQ = {
  label: "10-Day Diet Follow-Up", icon: "",
  questions: [
    "How are you feeling overall after starting the new diet plan? (positive changes or difficulties noticed)",
    "Main challenges in following the plan (timing, food prep, cravings, social situations, travel, etc.)",
    "Energy levels — on waking, during workouts, and through the rest of the day",
    "Any digestive issues? (bloating, constipation, acidity, irregular bowel habits)",
    "Cravings or hunger spikes/crashes — what foods, when (morning/evening/post-dinner), and can you control them?",
    "Able to maintain water intake? (if not, what gets in the way?)",
    "Sleep over the past few days (do you wake up feeling fresh?)",
    "Changes in mood, focus, or alertness? (lighter/calmer/more productive, or fatigue/irritability)",
    "Monitoring & updates — sending meal pictures regularly? any reason not to? change method/timing?",
    "Any suggestions or changes you'd like in your plan or our process?",
  ],
};

/**
 * The questionnaire for a consultation. `dietFollowup` swaps the Diet intake for
 * the short 10th-day check-in (initial and day-21 diet consults keep the full
 * intake).
 */
export function consultQ(kind: string, dietFollowup = false): ConsultQ {
  if (kind === "Diet" && dietFollowup) return DIET_FOLLOWUP_10;
  return CONSULT_QUESTIONS[kind] ?? CONSULT_QUESTIONS.Doctor;
}

/**
 * Drop the sex-specific questions that don't apply to this client, so a male
 * client isn't asked about menstrual cycles (and vice versa). Questions opt in
 * by prefixing their label "Female — " / "Male — ".
 *
 * IMPORTANT: answers are posted as `a_<index>` against this exact array, so the
 * SAME filter must run when rendering the form and when saving it — otherwise
 * the indices shift and answers land against the wrong questions. Both callers
 * go through `consultQFor`.
 *
 * When gender is unknown or anything other than a clear male/female value,
 * nothing is hidden — better to ask a redundant question than to silently skip
 * a clinically relevant one.
 */
export function applicableQuestions(questions: string[], gender?: string | null): string[] {
  const g = (gender ?? "").trim().toLowerCase();
  const isMale = g === "male" || g === "m";
  const isFemale = g === "female" || g === "f";
  if (!isMale && !isFemale) return questions;
  return questions.filter((q) => (isMale ? !isFor(q, "female") : !isFor(q, "male")));
}

/**
 * Is this question marked for one sex?
 *
 * The marker is the question's own heading: the Doctor bank writes "Female —
 * menstrual cycle", the Coach bank groups its four under a "Female health"
 * section. Matching the leading word rather than the exact heading lets a bank
 * name its section however reads best without also having to restate the sex
 * somewhere the filter can see it.
 */
function isFor(question: string, sex: "male" | "female"): boolean {
  const head = question.split(/\s+—\s+/)[0]?.trim().toLowerCase() ?? "";
  return new RegExp(`^${sex}\\b`).test(head);
}

/** consultQ + sex filtering — use this everywhere the questionnaire is rendered or saved. */
export function consultQFor(kind: string, gender?: string | null, dietFollowup = false): ConsultQ {
  const base = consultQ(kind, dietFollowup);
  return { ...base, questions: applicableQuestions(base.questions, gender) };
}
