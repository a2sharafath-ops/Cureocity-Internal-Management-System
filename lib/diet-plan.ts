// The customised diet plan — shapes, defaults and the arithmetic.
//
// Modelled directly on the document the clinic issues today: meal slots with
// time windows, each holding numbered options, each option carrying quantity,
// calories, protein and micronutrients.

export type PlanOption = {
  id?: string;
  seq: number;
  food_items: string;
  qty: string | null;
  kcal: number | null;
  protein_g: number | null;
  micronutrients: string | null;
  /**
   * The costed recipes this option is built from.
   *
   * Empty is the normal case and always will be: a dietitian must be able to
   * write "two idlis and sambar" mid-consultation without stopping to define a
   * recipe first. Linking is an upgrade to an option, never a requirement.
   *
   * A list rather than one dish, because an option is rarely one dish. "Puttu
   * ¾ cup + kadala curry ½ cup + 2 eggs" is three recipes and three portions
   * on one line of the client's chart — and holding it as a single entry would
   * mean a second copy of the kadala curry recipe for every option that uses
   * it, each drifting away from the others as they are corrected.
   */
  components: PlanComponent[];
};

/** One recipe inside an option, and how much of it. */
export type PlanComponent = {
  id?: string;
  seq: number;
  dish_id: string;
  /** A multiple of one serving of that dish. 1 = a serving, 0.5 = half. */
  servings: number;
};

/**
 * A recipe as the chart builder sees it: a name to pick from a list, and what
 * one serving contains — or why it cannot be worked out.
 *
 * Deliberately not the whole recipe. The builder never needs the ingredients,
 * and shipping the entire food table to the browser for a screen that only
 * multiplies two numbers would be a lot of weight for nothing. The sums happen
 * on the server, in `lib/nutrition.ts`, and this is what comes back.
 */
export type DishOption = {
  id: string;
  name: string;
  /** "1 medium piece", "¾ cup crumbled" — how the portion reads on a chart. */
  serving_label: string | null;
  /** Null when the recipe is too incomplete to price. */
  perServing: { kcal: number; protein_g: number } | null;
  /** What is missing, when it cannot be priced. Shown to the dietitian. */
  reason: string | null;
};

/**
 * What one component contributes — a portion of a single recipe.
 *
 * Returns null when the dish is missing or unpriced, or the portion is not a
 * portion. Refusing is the point: a component that cannot be worked out makes
 * the whole option unpriceable, and the alternative is a plausible number
 * standing in for one nobody calculated.
 *
 * Rounding happens once, at the end of `optionNutrients`, not here — rounding
 * every component first and then adding them is how four items become 3 kcal
 * heavier than the sum of what they actually are.
 */
export function componentNutrients(
  dish: DishOption | undefined,
  servings: number | null,
): { kcal: number; protein_g: number } | null {
  if (!dish?.perServing) return null;
  // A blank portion means one serving — the ordinary reading of an empty box
  // beside a named dish. Zero or less is not a reading at all.
  if (servings != null && servings <= 0) return null;
  const s = servings ?? 1;
  return { kcal: dish.perServing.kcal * s, protein_g: dish.perServing.protein_g * s };
}

/**
 * What an option's calories and protein MUST be, added up from its recipes.
 *
 * The rule of the link: where an option names recipes, their arithmetic wins
 * and nobody types over it. Change one of those recipes and every chart still
 * open re-prices itself. That is the whole point — a chart that can be
 * recalculated stays true when a recipe is corrected, and a typed-over figure
 * is exactly the remembered number this layer replaces.
 *
 * All or nothing. If any one component cannot be priced the option has no
 * figures at all, because a total missing one of its four items is not a
 * smaller total, it is a wrong one.
 */
export function optionNutrients(
  components: PlanComponent[],
  dishes: Map<string, DishOption>,
): { kcal: number; protein_g: number } | null {
  if (!components.length) return null;
  let kcal = 0, protein = 0;
  for (const c of components) {
    const part = componentNutrients(dishes.get(c.dish_id), c.servings);
    if (!part) return null;
    kcal += part.kcal;
    protein += part.protein_g;
  }
  return { kcal: Math.round(kcal), protein_g: Math.round(protein * 10) / 10 };
}

export type PlanMeal = {
  id?: string;
  seq: number;
  name: string;
  time_from: string | null;
  time_to: string | null;
  note: string | null;
  /** Eaten INSTEAD of a meal, not as well as — excluded from the day's totals. */
  conditional: boolean;
  options: PlanOption[];
};

export type PlanTargets = {
  kcal: number | null;
  protein: string | null;
  carbohydrate: string | null;
  fats: string | null;
  fibre: string | null;
  water: string | null;
};

/** The nine points printed on every plan. Editable per plan; this is the seed. */
export const HOW_TO_USE: [string, string][] = [
  ["Hyper-Personalized", "This plan is tailored for you—do not share it with others."],
  ["Consistency is Key", "Follow the plan daily without skipping meals or making changes."],
  ["Portion Control", "Measure portions accurately using cups or scales."],
  ["Hydration", "Drink plenty of water throughout the day."],
  ["Meal Timings", "Eat at regular intervals to maintain energy and balance."],
  ["Read Labels", "Check packaged food labels for better choices."],
  ["Listen to Your Body", "Report any discomfort or issues to your dietitian."],
  ["Enjoy The Process", "See the plan as a journey to health, not a restriction."],
  ["Stay Active", "Pair your diet with regular physical activity for best results."],
];

/**
 * The clinic's standard day. A new plan starts here and the dietitian edits —
 * far less typing than an empty page, and it keeps the slot names and ordering
 * consistent between clients, which matters when a coach is reading someone
 * else's plan back to them over the phone.
 */
export const DEFAULT_MEALS: Omit<PlanMeal, "options">[] = [
  { seq: 0, name: "Upon waking", time_from: "8:00 am", time_to: "8:15 am", note: null, conditional: false },
  { seq: 1, name: "Morning milk tea", time_from: "8:30 am", time_to: "8:45 am", note: null, conditional: false },
  { seq: 2, name: "Breakfast", time_from: "9:30 am", time_to: "10:00 am", note: null, conditional: false },
  { seq: 3, name: "Lunch", time_from: "1:30 pm", time_to: "2:30 pm", note: null, conditional: false },
  { seq: 4, name: "Evening snack / Pre-workout meal", time_from: "4:45 pm", time_to: "5:00 pm", note: null, conditional: false },
  { seq: 5, name: "Dinner / Post-workout meal", time_from: "7:30 pm", time_to: "8:30 pm", note: null, conditional: false },
  {
    seq: 6, name: "Travel-delay backup", time_from: null, time_to: null,
    note: "Use only when lunch or dinner is expected to be delayed by more than 1½–2 hours",
    conditional: true,
  },
];

/** "Breakfast (9:30–10:00 am)" — the heading as it prints. */
export function mealHeading(m: Pick<PlanMeal, "name" | "time_from" | "time_to">): string {
  if (!m.time_from && !m.time_to) return m.name;
  const window = m.time_to ? `${stripMeridiem(m.time_from, m.time_to)}–${m.time_to}` : m.time_from;
  return `${m.name} (${window})`;
}

/** "8:00 am–8:15 am" reads badly; the sheet prints "8:00–8:15 am". Drop the
 *  first meridiem when both ends share it. */
function stripMeridiem(from: string | null, to: string | null): string {
  if (!from) return "";
  const mf = from.match(/\b(am|pm)\b/i)?.[1]?.toLowerCase();
  const mt = to?.match(/\b(am|pm)\b/i)?.[1]?.toLowerCase();
  return mf && mf === mt ? from.replace(/\s*\b(am|pm)\b/i, "").trim() : from;
}

/**
 * Calories and protein for one option chosen from every non-conditional slot.
 *
 * A plan offers alternatives, so there is no single total — there's a range
 * between the lightest and heaviest way to eat the day. Both matter: the low
 * end shows whether the client can under-eat while "following the plan", the
 * high end whether they can overshoot the target. A single averaged number
 * would hide both.
 */
export function planTotals(meals: PlanMeal[]): {
  minKcal: number; maxKcal: number; minProtein: number; maxProtein: number; slotsWithoutOptions: string[];
} {
  let minKcal = 0, maxKcal = 0, minProtein = 0, maxProtein = 0;
  const slotsWithoutOptions: string[] = [];

  for (const m of meals) {
    if (m.conditional) continue;
    const opts = m.options.filter((o) => o.food_items.trim());
    if (!opts.length) { slotsWithoutOptions.push(m.name); continue; }
    const kcals = opts.map((o) => o.kcal ?? 0);
    const prots = opts.map((o) => Number(o.protein_g ?? 0));
    minKcal += Math.min(...kcals);
    maxKcal += Math.max(...kcals);
    minProtein += Math.min(...prots);
    maxProtein += Math.max(...prots);
  }
  return {
    minKcal, maxKcal,
    minProtein: round1(minProtein), maxProtein: round1(maxProtein),
    slotsWithoutOptions,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * How the day's range sits against the target. Advisory only — a dietitian
 * overrides this all the time and should be able to; it exists so an obvious
 * arithmetic slip is visible before the plan reaches a client.
 */
export function targetCheck(totals: { minKcal: number; maxKcal: number }, target: number | null):
  { tone: "ok" | "warn" | "none"; text: string } {
  if (!target || (!totals.minKcal && !totals.maxKcal)) return { tone: "none", text: "" };
  const band = Math.max(50, Math.round(target * 0.1));      // ±10%, min ±50 kcal
  const lo = target - band, hi = target + band;
  if (totals.maxKcal < lo) return { tone: "warn", text: `Every combination lands under the ${target} kcal target.` };
  if (totals.minKcal > hi) return { tone: "warn", text: `Every combination lands over the ${target} kcal target.` };
  if (totals.minKcal < lo || totals.maxKcal > hi) {
    return { tone: "warn", text: `Combinations range ${totals.minKcal}–${totals.maxKcal} kcal against a ${target} kcal target.` };
  }
  return { tone: "ok", text: `Every combination lands within ±${band} kcal of the ${target} kcal target.` };
}

/** Blocking problems. A plan with an empty meal slot must not reach a client. */
/**
 * How far apart two options in the same meal slot may be, in calories.
 *
 * The clinic's own dietitian brief sets this: the options within a meal must be
 * "±40 kcal of each other" and interchangeable, so a client can pick whichever
 * suits the day without the day's total moving. It is a number the clinic can
 * change; it is not one this file invented.
 */
export const OPTION_KCAL_SPREAD = 40;

/**
 * What is wrong with an option's recipes, if anything.
 *
 * Says nothing when the caller passed no library — it cannot tell an unknown
 * dish from an unknown list, and inventing "that recipe no longer exists" for
 * a recipe that is merely off-screen would be worse than staying quiet.
 *
 * Reports the FIRST thing wrong rather than all of them. An option with four
 * components has four ways to be broken, and a list that says the same thing
 * four times about one unfinished recipe buries the other meals.
 */
function linkProblem(
  where: string,
  o: PlanOption,
  dishMap: Map<string, DishOption>,
): string | null {
  if (!dishMap.size) return null;

  for (const c of o.components) {
    const d = dishMap.get(c.dish_id);
    if (!d) return `${where} is built from a recipe that no longer exists — remove that item, or pick another dish.`;
    if (c.servings != null && c.servings <= 0) {
      return `${where} is ${c.servings} servings of ${d.name} — a portion has to be more than nothing.`;
    }
    if (!d.perServing) {
      return `${where} uses ${d.name}, which cannot be priced yet — ${d.reason ?? "the recipe is incomplete"}. Fix it in Dishes, or remove it from this option and type the numbers.`;
    }
  }

  // The row must agree with its recipes as they stand TODAY.
  //
  // Charts are priced when they are saved, and re-priced when a recipe
  // changes — but neither covers a new version copied from a published one,
  // which arrives carrying figures frozen at the moment the old version went
  // out. Nothing re-prices it until someone presses Save, and nothing was
  // stopping it being approved and sent in between. This is what stops it:
  // if the row and its recipes disagree, the chart does not move until the
  // arithmetic has been redone.
  //
  // On screen this never fires — the builder recomputes as she types. It is a
  // check on what was stored, for the paths that do not go through her hands.
  const priced = optionNutrients(o.components, dishMap);
  if (priced && (o.kcal !== priced.kcal || Number(o.protein_g) !== priced.protein_g)) {
    return `${where} shows ${o.kcal ?? "no"} kcal, but its recipes work out at ${priced.kcal} kcal today. Press Save to bring the chart up to date.`;
  }
  return null;
}

export function planProblems(
  meals: PlanMeal[],
  targets: PlanTargets,
  /**
   * The recipe library, when the caller has it. Without it a linked option is
   * simply checked like any other — its numbers are already on the row, put
   * there by the server, so the chart is still fully checked. What the list
   * adds is a better sentence: "uses Puttu, which cannot be priced yet"
   * instead of "has no calories", which sends the dietitian to the wrong
   * screen to fix it.
   */
  dishes: DishOption[] = [],
): string[] {
  const out: string[] = [];
  const dishMap = new Map<string, DishOption>(dishes.map((d) => [d.id, d] as const));
  const totals = planTotals(meals);
  for (const s of totals.slotsWithoutOptions) out.push(`${s} has no options — the client would have nothing to eat at that meal.`);
  if (!targets.kcal) out.push("No daily calorie target set.");

  // The rest of the header. A plan that states calories but not protein is half
  // a prescription, and these are printed on the document the client receives.
  const header: [keyof PlanTargets, string][] = [
    ["protein", "protein"], ["carbohydrate", "carbohydrate"], ["fats", "fats"],
    ["fibre", "fibre"], ["water", "water intake"],
  ];
  for (const [key, label] of header) {
    if (!String(targets[key] ?? "").trim()) out.push(`No daily ${label} target set.`);
  }

  for (const m of meals) {
    m.options.forEach((o, i) => {
      const named = o.food_items.trim();
      const where = `${m.name} · option ${i + 1}`;
      if (named && !o.qty?.trim()) {
        out.push(`${where} has no quantity — "eat rice" is not a portion.`);
      }
      // Saving drops any option without a name, so a row where someone filled
      // the numbers and tabbed past the first column would vanish silently.
      // Better to refuse than to lose it.
      if (!named && (o.qty?.trim() || o.kcal != null || o.protein_g != null || o.micronutrients?.trim())) {
        out.push(`${where} has details but no food items — it would be dropped when saved.`);
      }
      // Blanks in a named option. Every one of these is a column the issued
      // document prints, so a gap here is a gap on the client's chart — and
      // nothing downstream can check a total built from missing numbers.
      if (named) {
        // A broken link is reported instead of the missing numbers it causes,
        // not as well as. "Has no calories" on a linked option would send the
        // dietitian to a box she cannot type in; the recipe is where the fix
        // is, and saying so is the difference between a useful message and a
        // dead end.
        const link = o.components.length ? linkProblem(where, o, dishMap) : null;
        if (link) {
          out.push(link);
        } else {
          if (o.kcal == null) out.push(`${where} has no calories.`);
          if (o.protein_g == null) out.push(`${where} has no protein.`);
          if (o.kcal != null && o.kcal <= 0) out.push(`${where} is ${o.kcal} kcal — that cannot be right.`);
          if (o.protein_g != null && Number(o.protein_g) < 0) out.push(`${where} has negative protein.`);
        }
        // Micronutrients are the dietitian's own words either way — no recipe
        // supplies them — so this one is asked of linked and free-text alike.
        if (!o.micronutrients?.trim()) out.push(`${where} has no micronutrients listed.`);
      }
    });

    // Options are meant to be interchangeable. If one is 200 kcal heavier than
    // another, the client picking freely is not following the same plan — and
    // the day's total silently depends on which one they happen to fancy.
    const priced = m.options.filter((o) => o.food_items.trim() && o.kcal != null);
    if (priced.length > 1) {
      const kcals = priced.map((o) => o.kcal as number);
      const lo = Math.min(...kcals), hi = Math.max(...kcals);
      if (hi - lo > OPTION_KCAL_SPREAD) {
        out.push(`${m.name} · options range ${lo}–${hi} kcal, a spread of ${hi - lo} — they should be within ${OPTION_KCAL_SPREAD} kcal of each other to be interchangeable.`);
      }
    }
  }

  // The day itself. `targetCheck` is advisory on screen; here it is a refusal,
  // because a plan whose every combination misses the target is not a plan that
  // was checked before it went out.
  const day = targetCheck(totals, targets.kcal);
  if (day.tone === "warn") out.push(day.text);

  return out;
}

/**
 * The closing notes, split for printing.
 *
 * The issued document's notes are not a paragraph — they are headed sections
 * ("Use the 3-part meal rule", "Build your hydration gradually :"), numbered
 * steps and asterisk bullets. Rendered as flat pre-wrap text they lose all of
 * that, and the longest, most practical page of the plan becomes a wall.
 *
 * Deliberately not a markdown parser. It reads what the dietitian already
 * types — a line ending in a colon is a heading, "1." or "*" starts a list
 * item — so nobody has to learn a syntax to get the document they had before.
 */
export type NoteLine = { kind: "heading" | "item" | "text" | "blank"; text: string };

export function parseNotes(notes: string | null | undefined): NoteLine[] {
  if (!notes?.trim()) return [];
  return notes.replace(/\r\n/g, "\n").split("\n").map((raw): NoteLine => {
    const line = raw.trim();
    if (!line) return { kind: "blank", text: "" };
    const item = line.match(/^(?:[*•-]|\d+\.)\s+(.*)$/);
    if (item) return { kind: "item", text: item[1].trim() };
    // A short line ending in a colon is a heading. The length cap matters:
    // "Try to include:" is a heading, a full sentence that happens to end in a
    // colon is not.
    if (/:$/.test(line) && line.length <= 60) return { kind: "heading", text: line.replace(/\s*:$/, "") };
    return { kind: "text", text: line };
  });
}

/** Renumber after a drag, delete or insert so "Option 3" is always the third. */
export function resequence<T extends { seq: number }>(rows: T[]): T[] {
  return rows.map((r, i) => ({ ...r, seq: i }));
}
