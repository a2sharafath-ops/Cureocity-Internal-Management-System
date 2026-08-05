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
};

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
export function planProblems(meals: PlanMeal[], targets: PlanTargets): string[] {
  const out: string[] = [];
  const { slotsWithoutOptions } = planTotals(meals);
  for (const s of slotsWithoutOptions) out.push(`${s} has no options — the client would have nothing to eat at that meal.`);
  if (!targets.kcal) out.push("No daily calorie target set.");
  for (const m of meals) {
    m.options.forEach((o, i) => {
      const named = o.food_items.trim();
      if (named && !o.qty?.trim()) {
        out.push(`${m.name} · option ${i + 1} has no quantity — "eat rice" is not a portion.`);
      }
      // Saving drops any option without a name, so a row where someone filled
      // the numbers and tabbed past the first column would vanish silently.
      // Better to refuse than to lose it.
      if (!named && (o.qty?.trim() || o.kcal != null || o.protein_g != null || o.micronutrients?.trim())) {
        out.push(`${m.name} · option ${i + 1} has details but no food items — it would be dropped when saved.`);
      }
    });
  }
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
