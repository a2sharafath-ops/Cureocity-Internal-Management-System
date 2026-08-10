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

import { dishNutrients, type Food } from "@/lib/nutrition";
import { type DishOption } from "@/lib/diet-plan";
import { type createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

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
  const [{ data: dsh, error: dishErr }, { data: fds, error: foodErr }] = await Promise.all([
    supabase.from("dishes")
      .select("id, name, serving_label, cooked_g, servings, source, source_kcal, source_protein_g, approved, dish_items(food_code, name, raw_g, seq)")
      // Explicit limits: PostgREST caps a response at 1,000 rows by default,
      // and a silently truncated library would price every missing recipe as
      // "not matched to the food table" — blaming the recipes for a row that
      // was simply never sent.
      .order("name").limit(5000),
    supabase.from("foods").select("food_code, name, protein_g, fat_g, carb_g, fibre_g, kcal").limit(5000),
  ]);

  // A failed read must not come back as an empty library. It would price every
  // recipe as unpriceable and blame the recipes — "ingredients not matched to
  // the food table" — for what is actually a database that did not answer.
  // Callers stop instead, and say so.
  if (dishErr) throw new Error(`Could not read the recipe library: ${dishErr.message}`);
  if (foodErr) throw new Error(`Could not read the food table: ${foodErr.message}`);

  const foods = new Map<string, Food>(((fds ?? []) as Food[]).map((f) => [f.food_code, f] as const));

  return ((dsh ?? []) as unknown as RawDish[]).map((d): DishOption => {
    const verdict = dishNutrients(
      {
        name: d.name,
        cooked_g: d.cooked_g,
        servings: d.servings,
        items: [...(d.dish_items ?? [])].sort((a, b) => a.seq - b.seq),
      },
      foods,
    );
    // Our own arithmetic first. It is the only figure that re-prices itself
    // when an ingredient is corrected, so wherever the recipe supports it, it
    // wins — including over a published figure that disagrees.
    if (verdict.priced) {
      return {
        id: d.id, name: d.name, serving_label: d.serving_label, source: d.source,
        perServing: { kcal: verdict.perServing.kcal, protein_g: verdict.perServing.protein_g },
        basis: "computed", reason: null, approved: d.approved,
      };
    }

    // Failing that, what the databank the recipe came from states for one
    // serving. Used only when we cannot compute — usually because an imported
    // recipe records an amount in teaspoons and nobody has supplied the gram
    // weight yet. Still a published lookup, not an estimate, and the screen
    // says which of the two the dietitian is reading.
    const published = d.source_kcal != null && d.source_protein_g != null;
    if (published) {
      return {
        id: d.id, name: d.name, serving_label: d.serving_label, source: d.source,
        perServing: { kcal: Math.round(Number(d.source_kcal)), protein_g: Math.round(Number(d.source_protein_g) * 10) / 10 },
        basis: "published", reason: null, approved: d.approved,
      };
    }

    // Neither. Refuses rather than estimates — the reason travels with the dish
    // so the builder can say what is missing instead of just greying it out.
    return {
      id: d.id, name: d.name, serving_label: d.serving_label, source: d.source,
      perServing: null, basis: null, reason: verdict.reason, approved: d.approved,
    };
  });
}
