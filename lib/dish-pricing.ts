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
      .select("id, name, serving_label, cooked_g, servings, dish_items(food_code, name, raw_g, seq)")
      .order("name"),
    supabase.from("foods").select("food_code, name, protein_g, fat_g, carb_g, fibre_g, kcal"),
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
    return {
      id: d.id,
      name: d.name,
      serving_label: d.serving_label,
      // Refuses rather than estimates — the reason travels with the dish so the
      // builder can say what is missing instead of just greying the row out.
      perServing: verdict.priced
        ? { kcal: verdict.perServing.kcal, protein_g: verdict.perServing.protein_g }
        : null,
      reason: verdict.priced ? null : verdict.reason,
    };
  });
}
