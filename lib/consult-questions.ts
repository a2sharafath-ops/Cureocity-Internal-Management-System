// In-session intake questionnaires per consultation kind (mirrors the prototype).
// Keyed by consultation `kind` (Doctor | Diet | Trainer | Coach | Psychologist).

export type ConsultQ = { label: string; icon: string; questions: string[] };

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
      "Early adulthood — medical conditions diagnosed",
      "Current — medical conditions (diabetes, hypertension, thyroid, etc.)",
      "Current — ongoing medications & supplements (names, dosages)",
      "Current — allergies (food, drug, environmental)",
      "Current — recent illness / checkups / investigations",
      "Current — alcohol & smoking",
      "Current — bowel movements",
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
      "Family history — chronic diseases (parents, siblings, grandparents)",
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
      "Vitals — HR (bpm), SpO2 (%), BP (mmHg), chest exam",
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
  Coach: {
    label: "Health Coaching Intake", icon: "🌿",
    questions: [
      "Primary health goal",
      "Readiness / motivation to change (1–10)",
      "Sleep duration & quality",
      "Stress level (Low / Moderate / High)",
      "Current exercise frequency",
      "Biggest lifestyle barrier",
      "Support system at home",
      "Habits to build",
      "Habits to break",
    ],
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
