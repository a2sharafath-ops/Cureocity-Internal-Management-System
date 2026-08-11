import { MICRONUTRIENTS, type MicroKey, type MicroTotals } from "@/lib/nutrition";

/**
 * Food–drug interactions, from section 5 of the clinic's dietitian brief:
 *
 *   "Adjust foods for known drug interactions: e.g., avoid calcium or iron
 *    with thyroxine; monitor sodium/potassium if on diuretics; avoid grapefruit
 *    with statins."
 *
 * WHAT THIS IS, AND FIRMLY WHAT IT IS NOT
 *
 * It is a reminder that a chart and a prescription have been read together. It
 * looks at the medicines recorded against the client, finds the ones this list
 * knows about, and points at the meal options that carry the mineral in
 * question. That is the whole of it.
 *
 * It is NOT a drug interaction database and must never be mistaken for one. It
 * holds the three the brief names and nothing else, so silence from it means
 * "none of these three", not "no interaction". A dietitian who starts reading
 * an empty result as a clean bill of health is worse off than before this
 * existed, which is why every message says which rule fired and none of them
 * says a chart is safe.
 *
 * NOTHING HERE BLOCKS A CHART. Most of these are solved by timing rather than
 * by removing food — thyroxine is taken an hour before breakfast precisely so
 * that the calcium at breakfast does not matter. A rule that refused to publish
 * would be wrong on the majority of the charts it stopped, and the ones it was
 * right about would be lost in the noise of overriding it.
 */

/**
 * A drug we know something about.
 *
 * `names` are matched against whatever somebody typed in the medications list,
 * which is free text: "Thyronorm 50mcg", "T. Eltroxin", "tab levothyroxine".
 * So the match is on a lowercase substring, and the list holds brand names as
 * well as generic ones — an Indian clinic sees Thyronorm far more often than
 * it sees the word levothyroxine.
 */
export type DrugRule = {
  id: string;
  /** How the rule reads when it fires, in the dietitian's own vocabulary. */
  label: string;
  names: string[];
  /** The micronutrients worth pointing at, and above what amount in one option. */
  watch: { key: MicroKey; overMg: number }[];
  /** Foods named rather than measured — nothing in the food table counts them. */
  avoidFoods?: string[];
  advice: string;
};

export const DRUG_RULES: DrugRule[] = [
  {
    id: "thyroxine",
    label: "thyroid replacement",
    // Thyronorm and Eltroxin are what a Kerala clinic actually sees written.
    names: ["thyroxine", "levothyroxine", "thyronorm", "eltroxin", "euthyrox",
            "thyrox", "lethyrox", "liothyronine", "thyrup"],
    watch: [
      { key: "calcium_mg", overMg: 200 },
      { key: "iron_mg", overMg: 5 },
    ],
    advice:
      "Calcium and iron bind thyroxine and stop it being absorbed. The usual fix is "
      + "timing, not food: the tablet on an empty stomach, and at least four hours "
      + "between it and these meals.",
  },
  {
    id: "diuretic",
    label: "a diuretic",
    names: ["furosemide", "lasix", "frusemide", "torsemide", "dytor",
            "hydrochlorothiazide", "hctz", "chlorthalidone", "indapamide",
            "spironolactone", "aldactone", "eplerenone", "amiloride"],
    watch: [
      { key: "potassium_mg", overMg: 800 },
      { key: "sodium_mg", overMg: 800 },
    ],
    advice:
      "Diuretics move potassium and sodium, and which way depends on the drug — a "
      + "thiazide or a loop diuretic sheds potassium, spironolactone and amiloride "
      + "hold on to it. Worth reading these totals against the client's last "
      + "electrolytes rather than adjusting on the drug name alone.",
  },
  {
    id: "statin",
    label: "a statin",
    names: ["statin", "atorvastatin", "rosuvastatin", "simvastatin",
            "pravastatin", "lovastatin", "pitavastatin", "fluvastatin",
            "atorva", "rosuvas", "lipitor", "crestor"],
    watch: [],
    // Grapefruit is not in the food table and has no micronutrient signature —
    // it is caught by reading what the option says, which is the only way a
    // named food can be caught at all.
    avoidFoods: ["grapefruit", "pomelo", "seville orange", "chakotra"],
    advice:
      "Grapefruit blocks the enzyme that clears most statins, so the dose builds up. "
      + "Simvastatin and atorvastatin are the ones that matter most; pravastatin and "
      + "rosuvastatin are largely unaffected.",
  },
];

/** Does a free-text medication line name a drug this list knows? */
export function rulesFor(medications: string[]): DrugRule[] {
  const said = medications.map((m) => m.toLowerCase());
  return DRUG_RULES.filter((r) => r.names.some((n) => said.some((m) => m.includes(n))));
}

export type Interaction = {
  ruleId: string;
  /** Where it was found — a meal and option, or "the plan" for a whole-chart one. */
  where: string;
  text: string;
};

/**
 * One option, checked against the drugs the client is on.
 *
 * `micro` may be null: an option typed by hand has no computed minerals, and no
 * silent pass is implied by that — `unchecked` says so, so the caller can tell
 * "we looked and it is fine" from "we could not look".
 */
export function optionInteractions(
  where: string,
  foodItems: string,
  micro: MicroTotals | null,
  rules: DrugRule[],
): { found: Interaction[]; unchecked: boolean } {
  const found: Interaction[] = [];
  let unchecked = false;

  for (const rule of rules) {
    // Named foods first — these work on any option, typed or built, because
    // they read the words rather than the arithmetic.
    for (const food of rule.avoidFoods ?? []) {
      if (foodItems.toLowerCase().includes(food)) {
        found.push({
          ruleId: rule.id, where,
          text: `${where} contains ${food}, and this client takes ${rule.label}. ${rule.advice}`,
        });
      }
    }

    for (const w of rule.watch) {
      const v = micro?.[w.key];
      if (v == null) { if (rule.watch.length) unchecked = true; continue; }
      if (v < w.overMg) continue;
      const m = MICRONUTRIENTS.find((x) => x.key === w.key)!;
      found.push({
        ruleId: rule.id, where,
        text: `${where} carries ${Math.round(v)} ${m.unit} of ${m.label.toLowerCase()}, `
          + `and this client takes ${rule.label}. ${rule.advice}`,
      });
    }
  }
  return { found, unchecked };
}
