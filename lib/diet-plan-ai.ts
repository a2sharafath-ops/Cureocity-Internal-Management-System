// Drafting a chart from everything the clinic already knows about a client.
//
// THE ONE RULE THIS FILE EXISTS TO ENFORCE
//
// The model never produces a number. Not a calorie, not a gram. It chooses
// which recipes go in which slot and in what portion, and writes the words
// around them; every figure on the finished chart is then added up from those
// recipes by `optionNutrients`, exactly as it is when the dietitian picks them
// by hand.
//
// That is the whole design. A model writing "Puttu — 320 kcal, 12 g protein"
// is doing precisely what a dietitian recalling a figure does, and the entire
// dish library exists to make that impossible. So the schema it is asked for
// has nowhere to put a number, the parser ignores any it invents anyway, and
// what it returns is a draft the dietitian edits and approves like any other.
//
// Kept apart from `lib/actions.ts` so the prompt and the parsing can be tested
// without a database or an API key: everything here is pure.

import { type DishOption, type PlanComponent } from "@/lib/diet-plan";

/** What the model is told about the client. Assembled by the caller. */
export type PlanContext = {
  name: string;
  age: number | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  bmi: number | null;
  /** Measured by the InBody. The brief says to use this, not an estimate. */
  bmr: number | null;
  /** Worked out here from BMR and activity — never by the model. */
  tdee: number | null;
  activity: string | null;
  conditions: string | null;
  goals: string | null;
  allergies: string[];
  medications: string[];
  occupation?: string | null;
  sleep?: string | null;
  stress?: string | null;
  region?: string | null;
  shiftPattern?: string | null;
  outsideMeals?: string | null;
  dietPattern?: string | null;
  mealPattern?: string | null;
  hydration?: string | null;
  dislikes?: string | null;
  supplements?: string | null;
  exercise?: string[];
  recall?: { meal: string; food: string }[];
  physiological?: string[];
  labFindings?: string[];
  /** Consultation write-ups, most recent first, labelled by discipline. */
  consultations: { role: string; kind: string; on: string; text: string }[];
  /** Uploaded reports, as far as anyone has summarised them. */
  reports: { label: string; on: string | null; summary: string }[];
  vitals: string | null;
};

/**
 * How many recipes to put in front of the model.
 *
 * The whole approved library would be more faithful and, past a few hundred
 * dishes, mostly a bill. This is a cap on cost and latency rather than a
 * clinical judgement, and the ones dropped are dropped from the end of an
 * alphabetical list, so it is worth raising if the choices start looking
 * narrow.
 */
export const MAX_DISHES_OFFERED = 500;

/**
 * The clinic's brief, as instructions.
 *
 * Deliberately a copy rather than a read of `docs/dietitian-brief.md` — that
 * file is the clinic's document and should not change because a prompt needed
 * rewording. Where the two drift, the document is what the clinic asked for
 * and this is what the model was told; `docs/dietitian-brief-audit.md` tracks
 * the difference.
 */
export const SYSTEM_PROMPT = `You are a senior clinical dietitian at Cureocity, working in Kerala, India.
You are drafting a diet chart for one client. A human dietitian will review,
edit and approve everything you produce; nothing you write reaches the client
directly.

THE ABSOLUTE RULE: never state a calorie or a macronutrient figure. Not in any
field, not in any note. The application calculates every number from the
recipes you choose, against the ICMR food tables. A number from you would be a
remembered number, and the clinic does not permit those. You will be given each
recipe's per-serving figures so you can balance the day — use them to choose,
never to quote.

You choose:
  - which meal slots the day has, and their timings
  - which recipes fill each slot, and in what portion
  - the wording a client reads
You do not choose: any figure.

Follow the clinic's protocol:
1. Build around the client's age, sex, BMI, measured BMR, comorbidities,
   medications, goals, occupation, sleep and stress.
2. Default to Kerala cuisine and local dish names. Only depart from that if the
   client is stated to be from elsewhere.
3. Every meal slot must offer EXACTLY 4 options. They must be interchangeable:
   within 40 kcal of each other, and close in carbohydrate, protein, fat and
   fibre. The per-serving figures are given so you can hold this.
4. Adjust meals around workout timing. A morning session makes the early
   morning item pre-workout and breakfast post-workout; an evening session
   makes dinner or a dedicated snack post-workout.
5. The early morning item must be scientifically supportable — soaked almonds
   and dates, soaked chia in water, a small fruit. NEVER lemon water,
   ashwagandha, cinnamon water, apple cider vinegar or any detox preparation.
6. Respect allergies and intolerances absolutely. Never include a recipe
   containing something the client reacts to.
7. Watch food-drug interactions: calcium and iron away from thyroxine, sodium
   and potassium where diuretics are prescribed, no grapefruit with statins.
8. Write micronutrients for each option as the key ones it supplies, in words
   ("Iron, folate, calcium") — this is a description, not a measurement.
9. Give each option a quantity in household terms the client will understand
   ("1 medium piece + ½ cup"), matched to the portions you chose.

Return JSON only, in this exact shape:
{
  "meals": [
    {
      "name": "Breakfast",
      "time_from": "9:30 am",
      "time_to": "10:00 am",
      "note": null,
      "conditional": false,
      "options": [
        {
          "food_items": "Puttu with kadala curry and egg",
          "qty": "1 medium piece + ½ cup + 1 egg",
          "micronutrients": "Iron, folate, calcium",
          "components": [{ "dish_id": "...", "servings": 1 }]
        }
      ]
    }
  ],
  "notes": "Coaching notes for the client — the 3-part meal rule, hydration, tea.",
  "rationale": "Two or three sentences for the dietitian on why this day is shaped as it is."
}

Every component's dish_id MUST be one of the ids given to you. An option whose
recipes you cannot find in that list should be left out entirely rather than
guessed at — a slot with three good options is better than four with one
invented. Include the travel-delay backup slot with conditional set to true if
it suits the client.`;

/** The recipe list as the model sees it: enough to choose with, no more. */
export function dishMenu(dishes: DishOption[], limit = MAX_DISHES_OFFERED): string {
  return dishes
    .filter((d) => d.approved && d.perServing)
    .slice(0, limit)
    .map((d) => {
      const p = d.perServing!;
      return `${d.id} | ${d.name} | ${p.kcal} kcal, ${p.carb_g}c ${p.protein_g}p ${p.fat_g}f ${p.fibre_g}fib per serving`;
    })
    .join("\n");
}

/** Everything known about the client, as the model reads it. */
export function clientBrief(c: PlanContext): string {
  const lines: string[] = [
    `Client: ${c.name}`,
    `Age ${c.age ?? "unknown"}, ${c.sex ?? "sex not recorded"}`,
    `Height ${c.height_cm ?? "?"} cm, weight ${c.weight_kg ?? "?"} kg, BMI ${c.bmi ?? "?"}`,
    `Measured BMR ${c.bmr ?? "not recorded"} kcal; activity ${c.activity ?? "not recorded"}`,
    `Daily energy target ${c.tdee ?? "not calculable"} kcal — this figure is fixed and already calculated; build the day around it.`,
    `Conditions: ${c.conditions || "none recorded"}`,
    `Goals: ${c.goals || "none recorded"}`,
    `Allergies: ${c.allergies.length ? c.allergies.join(", ") : "none recorded"}`,
    `Medications: ${c.medications.length ? c.medications.join(", ") : "none recorded"}`,
    `Region: ${c.region?.trim() || "Kerala (clinic default)"}`,
    `Occupation: ${c.occupation?.trim() || "not recorded"}`,
    `Shift pattern: ${c.shiftPattern?.trim() || "ordinary daytime routine"}`,
    `Eating out / English-style meals: ${c.outsideMeals?.trim() || "not recorded"}`,
    `Diet pattern: ${c.dietPattern?.trim() || "not recorded"}`,
    `Meal pattern: ${c.mealPattern?.trim() || "not recorded"}`,
    `Hydration: ${c.hydration?.trim() || "not recorded"}`,
    `Food dislikes: ${c.dislikes?.trim() || "none recorded"}`,
    `Supplements: ${c.supplements?.trim() || "none recorded"}`,
    `Sleep: ${c.sleep?.trim() || "not recorded"}`,
    `Stress: ${c.stress?.trim() || "not recorded"}`,
  ];
  if (c.physiological?.length) lines.push(`Physiological context: ${c.physiological.join("; ")}`);
  if (c.exercise?.length) {
    lines.push("", "Exercise / workout context:");
    for (const item of c.exercise) lines.push(`- ${item}`);
  }
  if (c.recall?.length) {
    lines.push("", "Structured 24-hour dietary recall:");
    for (const item of c.recall) lines.push(`- ${item.meal}: ${item.food}`);
  }
  if (c.labFindings?.length) {
    lines.push("", "Latest out-of-range laboratory findings:");
    for (const item of c.labFindings) lines.push(`- ${item}`);
  }
  if (c.vitals) lines.push(`Vitals: ${c.vitals}`);
  if (c.consultations.length) {
    lines.push("", "Consultation write-ups:");
    for (const s of c.consultations) lines.push(`- ${s.role} (${s.kind}, ${s.on}): ${s.text}`);
  }
  if (c.reports.length) {
    lines.push("", "Reports on file:");
    for (const r of c.reports) lines.push(`- ${r.label}${r.on ? ` (${r.on})` : ""}: ${r.summary}`);
  }
  return lines.join("\n");
}

export type GeneratedMeal = {
  name: string;
  time_from: string | null;
  time_to: string | null;
  note: string | null;
  conditional: boolean;
  options: {
    food_items: string;
    qty: string | null;
    micronutrients: string | null;
    components: PlanComponent[];
  }[];
};

export type GeneratedPlan = {
  meals: GeneratedMeal[];
  notes: string | null;
  rationale: string | null;
  /** What was thrown away and why — shown to the dietitian, not hidden. */
  dropped: string[];
};

const str = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
};

/**
 * Turn what the model returned into something the chart can hold.
 *
 * Sceptical by construction. Anything naming a recipe that is not in the
 * approved library is dropped rather than repaired, any figure the model
 * volunteered is ignored, and every drop is reported so the dietitian sees a
 * shorter chart and knows why rather than wondering.
 */
export function parseGeneratedPlan(raw: string, dishes: DishOption[]): GeneratedPlan | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { error: "The model did not return readable JSON." };
  }
  const root = data as { meals?: unknown; notes?: unknown; rationale?: unknown };
  if (!Array.isArray(root.meals) || !root.meals.length) {
    return { error: "The model returned no meal slots." };
  }

  // Only approved, priceable recipes may be named. This is the same gate the
  // picker applies to the dietitian, applied to the model.
  const usable = new Map(dishes.filter((d) => d.approved && d.perServing).map((d) => [d.id, d] as const));
  const dropped: string[] = [];
  const meals: GeneratedMeal[] = [];

  for (const m of root.meals as Record<string, unknown>[]) {
    const name = str(m.name);
    if (!name) continue;
    const options: GeneratedMeal["options"] = [];

    for (const o of (Array.isArray(m.options) ? m.options : []) as Record<string, unknown>[]) {
      const food = str(o.food_items);
      if (!food) continue;

      const parts = (Array.isArray(o.components) ? o.components : []) as Record<string, unknown>[];
      const components: PlanComponent[] = [];
      let bad = false;
      for (const c of parts) {
        const id = str(c.dish_id);
        if (!id || !usable.has(id)) { bad = true; break; }
        const n = Number(c.servings);
        components.push({ seq: components.length, dish_id: id, servings: Number.isFinite(n) && n > 0 ? n : 1 });
      }
      if (bad || !components.length) {
        dropped.push(`${name}: "${food}" named a recipe that is not in the approved library`);
        continue;
      }
      options.push({
        food_items: food,
        qty: str(o.qty),
        micronutrients: str(o.micronutrients),
        components,
      });
    }

    // A slot with nothing to eat is worse than no slot: the chart refuses to
    // publish with one, and the dietitian would have to delete it by hand.
    if (!options.length) {
      dropped.push(`${name}: no usable options, so the slot was left out`);
      continue;
    }
    if (options.length < 4) {
      dropped.push(`${name}: only ${options.length} option${options.length === 1 ? "" : "s"} — the brief asks for 4`);
    }
    meals.push({
      name,
      time_from: str(m.time_from),
      time_to: str(m.time_to),
      note: str(m.note),
      conditional: m.conditional === true,
      options,
    });
  }

  if (!meals.length) return { error: "Nothing the model returned could be used — none of the recipes it named are in the approved library." };
  return { meals, notes: str(root.notes), rationale: str(root.rationale), dropped };
}
