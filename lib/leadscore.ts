// Lead scoring rubric — exact weights from the prototype ("Lead Scoring - Main.xlsx").
// Seven signals sum to a 0–100 score, bucketed into HOT / WARM / COOL / COLD.

export const LS: Record<string, Record<string, number>> = {
  interest: { "Personal Training": 25, "Diet/Nutrition": 25, "Full Package (Medical+Diet+PT)": 25, "Gym/Fitness": 20, "Assessment/Testing": 20, "Just Exploring": 10, "Not Sure": 5 },
  urgency: { "Medical advice to exercise": 20, "Strong - wants to start now": 20, "Event/deadline (wedding etc.)": 18, "Just moved/relocated": 12, "New Year resolution": 12, "Just exploring options": 6, "No clear urgency": 3 },
  history: { "Had PT before": 15, "Regular gym-goer (1+ year)": 13, "Used to go but stopped": 10, "Online/home workouts only": 8, "Tried a few times": 6, "Complete beginner": 3 },
  goals: { "Specific weight loss target": 15, "Manage health condition (diabetes/BP etc)": 15, "Build muscle/body composition": 13, "Rehab/pain management": 13, "General fitness/energy": 8, "Look better": 8, "No specific goal": 3 },
  location: { "Within 3 km (Panampally/Kadavanthra)": 10, "3-5 km (Vytilla/Elamkulam/Palarivattom)": 8, "5-10 km (Kakkanad/Edappally/Kaloor)": 5, "10+ km (Aluva/Tripunithura etc)": 3, "Outside Kochi": 1 },
  budget: { "Doesnt ask price first - quality focused": 10, "Mentions premium gyms": 8, "Asks price immediately": 4, "Compares to budget gyms": 2, "Says too expensive": 1 },
  profession: { "Doctor/Medical": 5, "Business Owner/Entrepreneur": 5, "Lawyer/CA": 5, "Actor/Media": 5, "IT Professional": 4, "Senior Executive": 4, "Mid-level Professional": 3, "Entry-level/Junior": 2, "Student": 1, "Unknown": 0 },
};

const SIGNALS = ["interest", "urgency", "history", "goals", "location", "budget", "profession"] as const;

export type LeadSignals = {
  interest?: string | null; urgency?: string | null; history?: string | null;
  goals?: string | null; location?: string | null; budget?: string | null; profession?: string | null;
};

export type Tier = "HOT" | "WARM" | "COOL" | "COLD";

export function leadScore(l: LeadSignals): { total: number | null; tier: Tier | null } {
  if (!l.interest && !l.urgency && !l.history && !l.goals) return { total: null, tier: null };
  const v = (k: (typeof SIGNALS)[number]) => {
    const val = l[k];
    return val && LS[k][val] !== undefined ? LS[k][val] : 0;
  };
  const total = SIGNALS.reduce((sum, k) => sum + v(k), 0);
  const tier: Tier = total >= 75 ? "HOT" : total >= 50 ? "WARM" : total >= 25 ? "COOL" : "COLD";
  return { total, tier };
}

/** Best-fit product recommendation from the lead's interest & goals. */
export function leadProduct(l: LeadSignals): string {
  if (!l.interest) return "—";
  if (l.interest === "Full Package (Medical+Diet+PT)" || l.goals === "Manage health condition (diabetes/BP etc)") return "Complete Fitness Plan";
  if (l.interest === "Personal Training") return "Personal Training";
  if (l.interest === "Diet/Nutrition") return "Diet Plan + App";
  if (l.interest === "Assessment/Testing" || l.interest === "Just Exploring") return "Core Assessment";
  return "Gym Membership";
}

export const TIER_STYLE: Record<Tier, { bg: string; color: string }> = {
  HOT: { bg: "#fee2e2", color: "var(--red)" },
  WARM: { bg: "var(--amber-bg)", color: "#b45309" },
  COOL: { bg: "#dbeafe", color: "#2563eb" },
  COLD: { bg: "#eef2f1", color: "var(--muted)" },
};
