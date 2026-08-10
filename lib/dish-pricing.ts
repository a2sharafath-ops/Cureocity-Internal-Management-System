// Reading the recipe library back as prices.
//
// The chart builder and the save that follows it both need the same thing: for
// every dish, what one serving contains, or why that cannot be worked out. The
// sum itself lives in `lib/nutrition.ts` and is pure; this is the part that
// goes to the database for the ingredients and the food table.
//
// It is a plain module rather than a server action on purpose. `lib/actions.ts`
// is marked "use server", so anything exported from there becomes something a
// browser can call. This is read-only reference data used by code that already
// runs on the server, and there is no reason to open a door for it.

import { dishNutrients, contradictsSource, type Food } from "@/lib/nutrition";
import { type DishOption } from "@/lib/diet-plan";
import { type createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Read every row, a page at a time.
 *
 * Supabase caps a single response at its project-level "Max rows" setting —
 * 1,000 by default — and a `.limit()` above that is silently ignored rather
 * than refused. With 1,014 imported recipes that meant fourteen of them simply
 * did not exist as far as this app was concerned: missing from the chart's
 * picker, and reported as "a recipe that no longer exists" on any option built
 * from one. A truncation that looks exactly like data loss.
 *
 * Paging keeps that correct whatever the setting is and however the library
 * grows, which is worth more than a number typed into a dashboard once.
 */
const PAGE = 1000;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  what: string,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`Could not read ${what}: ${error.message}`);
    const rows = (data ?? []) as T[];
    all.push(...rows);
    // A short page is the last one. Anything else risks looping forever
    // against a table that keeps answering.
    if (rows.length < PAGE) return all;
  }
}


type RawDish = {
  id: string;
  name: string;
  serving_label: string | null;
  cooked_g: number | null;
  servings: number | null;
  source: string | null;
  source_kcal: number | null;
  source_protein_g: number | null;
  approved: boolean;
  dish_items: { food_code: string | null; name: string; raw_g: number; seq: number }[] | null;
};

/**
 * Every recipe in the library, priced per serving.
 *
 * The whole food table comes along — a few hundred rows of clinic reference
 * data, read once here rather than once per ingredient. Row-level security
 * already limits both tables to staff, so this is read through whichever
 * client the caller hands over rather than an admin one.
 */
export async function pricedDishes(supabase: Db): Promise<DishOption[]> {
  // Paged, not limited. Both reads throw on failure rather than coming back
  // empty: an empty library would price every recipe as unpriceable and blame
  // the recipes — "ingredients not matched to the food table" — for what is
  // actually a database that did not answer.
  const [dsh, fds] = await Promise.all([
    fetchAllRows<RawDish>((from, to) => supabase.from("dishes")
      .select("id, name, serving_label, cooked_g, servings, source, source_kcal, source_protein_g, approved, dish_items(food_code, name, raw_g, seq)")
      .order("name").range(from, to), "the recipe library"),
    fetchAllRows<Food>((from, to) => supabase.from("foods")
      .select("food_code, name, protein_g, fat_g, carb_g, fibre_g, kcal")
      .order("food_code").range(from, to), "the food table"),
  ]);

  const foods = new Map<string, Food>(fds.map((f) => [f.food_code, f] as const));

  return dsh.map((d): DishOption => {
    const verdict = dishNutrients(
      {
        name: d.name,
        cooked_g: d.cooked_g,
        servings: d.servings,
        items: [...(d.dish_items ?? [])].sort((a, b) => a.seq - b.seq),
      },
      foods,
    );
    const published = d.source_kcal != null && d.source_protein_g != null;

    // Our own arithmetic first. It is the only figure that re-prices itself
    // when an ingredient is corrected, so wherever the recipe supports it, it
    // wins.
    //
    // Except where the source flatly contradicts it. A published figure for
    // the same recipe is a free second opinion, and when the two are miles
    // apart the fault is almost always in the recipe rather than the sums: a
    // deep-fried dish lists the whole pan of oil, of which the food absorbs a
    // fraction; a marinade is weighed in and then poured away. Computing those
    // gives a poori at 4,264 kcal against a published 921 — arithmetic that is
    // perfectly correct about the wrong quantity, and the kind of confident
    // wrong number this whole layer exists to keep off a client's chart.
    //
    // So a disagreement past this point is treated as a reason not to trust
    // our own figure, not a reason to doubt theirs. The dish keeps the
    // published value and says why.
    const contradicted = verdict.priced && published
      && contradictsSource(verdict.perServing.kcal, Number(d.source_kcal));

    if (verdict.priced && !contradicted) {
      return {
        id: d.id, name: d.name, serving_label: d.serving_label, source: d.source,
        perServing: { kcal: verdict.perServing.kcal, protein_g: verdict.perServing.protein_g },
        basis: "computed", reason: null, approved: d.approved,
      };
    }

    // Failing that, what the databank the recipe came from states for one
    // serving. Used when we cannot compute — usually because an imported
    // recipe records an amount in teaspoons and nobody has supplied the gram
    // weight yet — and when our own figure disagrees with it too sharply to
    // trust. Still a published lookup, not an estimate, and the screen says
    // which of the two the dietitian is reading.
    if (published) {
      return {
        id: d.id, name: d.name, serving_label: d.serving_label, source: d.source,
        perServing: { kcal: Math.round(Number(d.source_kcal)), protein_g: Math.round(Number(d.source_protein_g) * 10) / 10 },
        basis: "published",
        // Carried even though the dish is priced, because it is the one thing
        // worth saying about it: the ingredients as recorded do not add up to
        // a serving, which is usually a pan of frying oil or a discarded
        // marinade, and someone should look at the recipe.
        reason: contradicted
          ? `the ingredients as listed come to ${verdict.priced ? verdict.perServing.kcal : 0} kcal a serving, well away from the published ${Math.round(Number(d.source_kcal))} — check for uneaten frying oil or a discarded marinade`
          : null,
        approved: d.approved,
      };
    }

    // Neither. Refuses rather than estimates — the reason travels with the dish
    // so the builder can say what is missing instead of just greying it out.
    return {
      id: d.id, name: d.name, serving_label: d.serving_label, source: d.source,
      // Only reachable when the sums could not be done at all — a contradicted
      // figure has a published one to fall back on and returned above.
      perServing: null, basis: null,
      reason: verdict.priced ? "no published figure to fall back on" : verdict.reason,
      approved: d.approved,
    };
  });
}
