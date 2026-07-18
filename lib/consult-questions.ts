// In-session intake questionnaires per consultation kind (mirrors the prototype).
// Keyed by consultation `kind` (Doctor | Diet | Trainer | Coach | Psychologist).

export type ConsultQ = { label: string; icon: string; questions: string[] };

export const CONSULT_QUESTIONS: Record<string, ConsultQ> = {
  Doctor: {
    label: "Medical Consultation Intake", icon: "🩺",
    questions: [
      "Presenting complaint / reason for visit",
      "Current medications & supplements",
      "Known allergies",
      "Family history (diabetes / hypertension / cardiac)",
      "Past injuries or surgeries",
      "New or ongoing symptoms",
      "Sleep quality",
      "Pain or discomfort during exercise",
      "Overall wellbeing (1–10)",
    ],
  },
  Diet: {
    label: "Diet & Lifestyle Intake", icon: "🥗",
    questions: [
      "Diet preference (Veg / Non-veg / Vegan / Eggetarian)",
      "Typical breakfast",
      "Typical lunch",
      "Typical dinner",
      "Meal pattern (meals + snacks per day)",
      "Cravings",
      "Food dislikes / intolerances",
      "Water intake per day",
      "Digestive issues (bloating / acidity / irregular bowel)",
      "Energy levels through the day",
      "Adherence to current plan (if any)",
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

export function consultQ(kind: string): ConsultQ {
  return CONSULT_QUESTIONS[kind] ?? CONSULT_QUESTIONS.Doctor;
}
