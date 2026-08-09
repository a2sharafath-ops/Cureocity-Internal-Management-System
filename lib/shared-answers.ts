// Answers a colleague has already taken, offered under the matching question.
//
// Five professionals ask the same client about their sleep, their stress and
// what stops them exercising, on the same day, in the same building. The client
// answers five times and gets slightly bored each time; the fifth answer is the
// shortest and the least useful.
//
// So when another discipline has already asked something equivalent, their
// answer is shown under the question here, with the discipline and the date.
//
// SHOWN, NOT PRE-FILLED — deliberate, and the whole safety argument:
//
//   • A pre-filled box gets submitted. The record would then say this clinician
//     asked and heard something they never did, which is a false clinical note
//     however convenient it was to produce.
//   • Answers go stale in exactly the places that matter. "Quit smoking last
//     month" is true when the doctor writes it and wrong six weeks later, and a
//     silently carried answer never gets re-asked.
//   • The consultation is a conversation. Reading "the doctor was told you
//     sleep five hours — is that still right?" is a better opening than asking
//     from scratch, and it is the clinician who decides it still holds.
//
// One tap copies it in, which is where the time is actually saved.
//
// MATCHING IS A HAND-WRITTEN LIST, not similarity scoring. Two questions about
// "activity" can mean current routine or medical restriction, and guessing
// wrong here puts a wrong answer under a clinical question. Every pair below
// was read and matched by hand; anything not listed simply doesn't carry.

/** One thing a client can be asked about, and how each bank phrases it. */
export type SharedTopic = {
  key: string;
  /** How the carry-over reads: "already asked about their sleep". */
  label: string;
  /** Exact question texts, across every discipline, that mean this. */
  questions: string[];
};

export const SHARED_TOPICS: SharedTopic[] = [
  {
    key: "sleep",
    label: "sleep",
    questions: [
      "Sleep & recovery — sleep time, wake time, duration, quality, recovery",
      "Sleep — what time do you usually sleep and wake up?",
      "Sleep — how many hours of sleep do you get on most days?",
    ],
  },
  {
    key: "sleep_apnoea",
    label: "snoring and daytime sleepiness",
    questions: [
      "Sleep — do you snore, wake up choking, or feel very sleepy during the day?",
    ],
  },
  {
    key: "stress_sources",
    label: "what they're stressed about",
    questions: [
      "Mental health — current stressors & coping mechanisms",
      "Stress — stressful situations",
      "Stress — what are the main sources of stress in your life right now?",
    ],
  },
  {
    key: "stress_coping",
    label: "how they cope with stress",
    questions: [
      "Stress — coping mechanisms",
      "Stress — what do you currently do to relax or calm yourself?",
    ],
  },
  {
    key: "activity_current",
    label: "what exercise they currently do",
    questions: [
      "Activity — current workout routine (type, frequency, intensity)",
      "Activity — do you do any walking, workout, yoga, sports or gym currently?",
      "Activity — what does movement look like in your current week?",
      "Activity — how many days in a week are you active?",
      "Current activity level",
    ],
  },
  {
    key: "activity_limits",
    label: "what stops them moving",
    questions: [
      "Activity — limitations to locomotion",
      "Activity — do you have any pain, injury, breathing difficulty, dizziness or medical restriction during exercise?",
      "Injuries / limitations to note",
      "Any bone or joint problem worsened by activity?",
    ],
  },
  {
    key: "cardiac_on_exertion",
    label: "chest pain or breathlessness on exertion",
    questions: [
      "Do you feel chest pain during physical activity?",
      "Activity — have you ever felt chest pain, unusual breathlessness, or fainting during activity?",
    ],
  },
  {
    key: "cardiac_meds",
    label: "blood-pressure or heart medication",
    questions: [
      "Currently on blood-pressure or heart medication?",
      "Current — treatment for hypertension? (antihypertensive prescribed?)",
    ],
  },
  {
    key: "medications",
    label: "their medications",
    questions: [
      "Current — ongoing medications & supplements (names, dosages, frequency, since when)",
    ],
  },
  {
    key: "allergies",
    label: "their allergies",
    questions: [
      "Current — allergies (food, drug, environmental)",
      "Nutrition — food preferences / intolerances",
    ],
  },
  {
    key: "special_diet",
    label: "any special diet",
    questions: [
      "Nutrition — special diets (keto, intermittent fasting)",
      "Special diets followed (low-carb/keto/Atkins · plant-based veg/vegan/pescatarian · fasting IF/OMAD/religious · high-protein/paleo/zone) — or Nil",
    ],
  },
  {
    key: "what_they_eat",
    label: "what they eat",
    questions: [
      "Nutrition — current diet (meals, snacks, water intake)",
      "Nutrition — can you walk me through what you ate yesterday, from morning to night?",
    ],
  },
  {
    key: "bowels",
    label: "their bowel habits",
    questions: [
      "Current — bowel movements (frequency & since when)",
      "Gut health — bowel habits (frequency, consistency)",
    ],
  },
  {
    key: "goal",
    label: "their main goal",
    questions: [
      "Goals — what is your main goal right now?",
      "Primary fitness goal",
    ],
  },
  {
    key: "tried_before",
    label: "what they've tried before",
    questions: [
      "Goals — have you tried anything before for this goal?",
    ],
  },
  {
    key: "periods",
    label: "their menstrual cycle",
    questions: [
      "Female — menstrual cycle (LMP, regularity, pain, PMS)",
      "Female health — are your periods regular?",
    ],
  },
  {
    key: "pregnancy",
    label: "pregnancy or breastfeeding",
    questions: [
      "Female — pregnancy history (P/L/A, complications, gestational diabetes)",
      "Female health — are you pregnant, recently postpartum, or breastfeeding?",
    ],
  },
  {
    key: "menopause",
    label: "menopause",
    questions: [
      "Female — menopause status & symptoms",
      "Female health — any menopause or perimenopause symptoms: hot flushes, night sweats, disturbed sleep?",
    ],
  },
];

/** Question text → topic key. Built once; texts are unique across the banks. */
const TOPIC_OF = new Map<string, SharedTopic>();
for (const t of SHARED_TOPICS) for (const q of t.questions) TOPIC_OF.set(q, t);

/** An answer another discipline already has for the question in hand. */
export type CarriedAnswer = {
  /** "Medical consultation", "Coach session" — who asked it. */
  from: string;
  /** The question as THAT discipline phrased it, so the wording is honest. */
  asked: string;
  answer: string;
  at: string | null;
};

export type OtherConsultAnswers = {
  label: string;
  completedAt: string | null;
  answers: [string, string][];
};

/**
 * For each question in the current bank, what the rest of the team already has.
 *
 * Keyed by question INDEX because that is what the form renders against — and
 * indexes shift when sex-specific filtering drops a question, so this must be
 * computed from the same filtered list the clinician is looking at.
 *
 * A question the current clinician has already answered still gets its
 * carry-over: they may want to compare, and hiding it would quietly decide that
 * for them. The UI, not this function, decides what to do with that.
 */
export function carriedAnswers(
  questions: string[],
  others: OtherConsultAnswers[],
): Map<number, CarriedAnswer[]> {
  const out = new Map<number, CarriedAnswer[]>();
  if (!others.length) return out;

  questions.forEach((q, i) => {
    const topic = TOPIC_OF.get(q);
    if (!topic) return;

    const found: CarriedAnswer[] = [];
    for (const o of others) {
      for (const [asked, answer] of o.answers) {
        // Same topic, but never the identical wording echoed back at itself.
        if (asked === q) continue;
        if (TOPIC_OF.get(asked) !== topic) continue;
        if (!answer || !answer.trim()) continue;
        found.push({ from: o.label, asked, answer: answer.trim(), at: o.completedAt });
      }
    }
    if (found.length) out.set(i, found);
  });

  return out;
}
