"use client";

import { useMemo, useState, useTransition } from "react";
import { saveDish, deleteDish, setDishApproved, approveDishes, setDishServings, setDishPortion, saveDishPortions, setFoodMeasure } from "@/lib/actions";
import DishDetail from "./DishDetail";
import { dishNutrients, energyLooksWrong, contradictsSource, servingProblem, suggestServings,
  portionMedians, portionLooksOdd, servingUnit, type Food, type Dish, type Measure, type MicroFood } from "@/lib/nutrition";

export type DishRow = {
  id: string;
  name: string;
  cuisine: string | null;
  cooked_g: number | null;
  servings: number | null;
  serving_label: string | null;
  notes: string | null;
  /** Where the recipe came from — a citation for anything imported. */
  source: string | null;
  /** What the source says one serving contains, where we cannot compute it. */
  source_kcal: number | null;
  source_carb_g: number | null;
  source_protein_g: number | null;
  source_fat_g: number | null;
  source_fibre_g: number | null;
  /** Why the source's figures are no longer a second opinion. See 0154. */
  source_superseded: string | null;
  /** Raw ingredient weight of one serving, and whether a person set it. */
  portion_g: number | null;
  portion_g_source: string | null;
  /** Cleared for use on a client's chart. */
  approved: boolean;
  approved_by: string | null;
  items: {
    food_code: string | null; name: string; raw_g: number; seq: number;
    /**
     * Where the weight came from. Empty means a published table. "estimated"
     * means it was inferred — currently only a ground spice at 2.5 g per
     * teaspoon, the middle of USDA's own range for the ones it does publish.
     */
    raw_g_source: string | null;
    /**
     * Why this ingredient's composition is not simply itself — mutton priced
     * as goat, a colouring counted as nothing. A substitution must never be
     * able to pass for a measurement.
     */
    note: string | null;
  }[];
};

const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "0 10px", height: 34, fontSize: 13, background: "#fff", boxSizing: "border-box" };
const darkBtn: React.CSSProperties = { background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const ghost: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };

type Draft = {
  id: string | null;
  name: string; cuisine: string; servings: string; cooked_g: string; serving_label: string; notes: string;
  items: { food_code: string | null; name: string; raw_g: string }[];
};

const blank = (): Draft => ({
  id: null, name: "", cuisine: "Kerala", servings: "1", cooked_g: "", serving_label: "", notes: "",
  items: [{ food_code: null, name: "", raw_g: "" }],
});

/**
 * The costed recipe library.
 *
 * A diet chart says "1 medium piece puttu"; the food table knows rice and
 * coconut. This is where the two meet — a dish is its ingredients in grams, and
 * everything else is arithmetic.
 *
 * Where an ingredient hasn't been matched to the food table, or a weight or
 * serving count is missing, it says which — because a plausible number with
 * nothing behind it is precisely what this replaces.
 *
 * One exception, and it is labelled wherever it appears: a ground spice USDA
 * publishes no teaspoon weight for is taken at 2.5 g, the middle of its range
 * for the spices it does publish. Those rows read "Estimated weight for
 * asafoetida" and name the culprit, so the reader can judge whether a quarter
 * teaspoon of it is worth caring about. Usually it is worth about 2 kcal.
 */
export default function DishLibrary({ dishes, foods, measures, micros, canEdit }: {
  dishes: DishRow[];
  /** The ICMR food table, for matching ingredients. */
  foods: Food[];
  /** What a cup, spoon or piece of each food weighs, keyed by food code. */
  measures: Map<string, Measure[]>;
  /** Each food's vitamins and minerals per 100 g, keyed by food code. */
  micros: Map<string, MicroFood>;
  canEdit: boolean;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [q, setQ] = useState("");
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const foodMap = useMemo(() => new Map(foods.map((f) => [f.food_code, f])), [foods]);

  /**
   * Servings being edited on the list, before they are saved.
   *
   * Held here so the figures move as she types. Correcting a servings count is
   * guesswork without seeing what it does to a portion — "feeds six" is a
   * different claim once you can see it makes each portion 780 kcal.
   */
  const [srvEdit, setSrvEdit] = useState<Record<string, string>>({});
  const [srvSaving, setSrvSaving] = useState<string | null>(null);

  /** What the row is currently claiming, edited or saved. */
  const servingsOf = (d: DishRow): number | null => {
    const typed = srvEdit[d.id];
    if (typed === undefined) return d.servings;
    const n = Number(typed.trim());
    return typed.trim() === "" || !Number.isFinite(n) || n <= 0 ? null : n;
  };

  const priced = (d: DishRow) => dishNutrients(
    { name: d.name, cooked_g: d.cooked_g, servings: servingsOf(d), items: d.items }, foodMap);

  /**
   * What the whole recipe comes to, whatever servings count is on it.
   *
   * Priced against one serving on purpose: `dishNutrients` divides by the
   * count, so asking it for one gives the undivided total — which is the
   * number a servings suggestion has to be derived from.
   */
  const wholeRecipe = (d: DishRow) => {
    const v = dishNutrients({ name: d.name, cooked_g: d.cooked_g, servings: 1, items: d.items }, foodMap);
    return v.priced ? v.perServing.kcal : null;
  };

  /**
   * The middle portion weight for each unit, across the whole library.
   *
   * The only reference available: no one publishes what a bowl weighs, but
   * 269 bowls in this library have an opinion between them.
   */
  const medians = useMemo(() => portionMedians(dishes), [dishes]);

  const saveServings = (d: DishRow) => {
    const typed = srvEdit[d.id];
    if (typed === undefined) return;
    if (String(d.servings ?? "") === typed.trim()) return;   // nothing changed
    setErr(null);
    setSrvSaving(d.id);
    start(async () => {
      const fd = new FormData();
      fd.set("id", d.id);
      fd.set("servings", typed.trim());
      const r = await setDishServings(fd);
      setSrvSaving(null);
      if (r?.error) setErr(r.error);
    });
  };

  // Reviewing an imported library is the job this screen now has to support,
  // so the two questions worth asking of a thousand rows — what have I not
  // cleared, and what looks wrong — are filters rather than something to find
  // by scrolling.
  const [filter, setFilter] = useState<"all" | "pending" | "held" | "suspect">("all");

  /** Which of the two tables this screen is showing. */
  const [view, setView] = useState<"dishes" | "foods">("dishes");

  /**
   * The ingredients on this dish whose weight was inferred rather than looked
   * up. Declared above `figures` because these are `const` arrow functions and
   * one used before its definition throws at run time, which no type-check
   * catches.
   */
  const estimated = (d: DishRow) =>
    d.items.filter((i) => i.raw_g_source === "estimated").map((i) => i.name);

  /**
   * Ingredients whose composition is a stand-in, grouped by the reason. One
   * line per reason rather than per ingredient, because a sweet with four
   * colourings in it should not push its own figures off the screen.
   */
  const standIns = (d: DishRow) => {
    const g = new Map<string, string[]>();
    for (const i of d.items) if (i.note) g.set(i.note, [...(g.get(i.note) ?? []), i.name]);
    return [...g];
  };

  /**
   * What one serving comes to, and whether we worked it out or quoted it.
   *
   * Mirrors the server's rule exactly (lib/dish-pricing.ts): our own
   * arithmetic wins, unless a published figure for the same recipe flatly
   * contradicts it — which nearly always means the ingredient list is not what
   * a serving contains, most often a pan of frying oil the food only absorbs a
   * little of. The published figure is used and the disagreement is shown,
   * because that recipe is the one worth a second look.
   */
  const figures = (d: DishRow) => {
    const v = priced(d);
    // Retired sources take no part in either job — see lib/dish-pricing.ts.
    const retired = d.source_superseded != null;
    const pub = !retired && d.source_kcal != null && d.source_protein_g != null
      ? { kcal: Math.round(Number(d.source_kcal)), protein: Math.round(Number(d.source_protein_g) * 10) / 10 }
      : null;
    // A published CALORIE figure alone is enough to contradict our sums —
    // whether the source also recorded protein has nothing to do with it.
    // Tying the two together let a cabbage kofta curry through at 4,212 kcal.
    const clash = v.priced && !retired && d.source_kcal != null
      && contradictsSource(v.perServing.kcal, Math.round(Number(d.source_kcal)));
    const disagreement = clash && v.priced
      ? `ingredients as listed come to ${v.perServing.kcal} kcal — check for frying oil that isn't eaten`
      : null;

    // The other way a figure goes wrong: not a disagreement but an agreement on
    // something nobody eats. A whole pot recorded as one serving comes out at
    // four thousand calories from both sources at once, so only reading the
    // figures on their own terms catches it. Same test the server runs.
    const implausible = (n: Parameters<typeof servingProblem>[0] | null) =>
      n ? servingProblem(n) : null;

    const published = !retired && d.source_kcal != null && d.source_carb_g != null
      && d.source_protein_g != null && d.source_fat_g != null && d.source_fibre_g != null
      ? { kcal: Math.round(Number(d.source_kcal)), carb_g: Number(d.source_carb_g),
        protein_g: Number(d.source_protein_g), fat_g: Number(d.source_fat_g), fibre_g: Number(d.source_fibre_g) }
      : null;

    if (v.priced && !clash) {
      const k = v.perServing.kcal;
      return { kcal: k, protein: v.perServing.protein_g, quoted: false, clash: implausible(v.perServing), reason: null };
    }
    if (pub) return { ...pub, quoted: true, reason: null, clash: disagreement ?? implausible(published) };
    // Contradicted with nothing complete to fall back on: no figures at all
    // rather than ours kept by default.
    return { kcal: null, protein: null, quoted: false, clash: disagreement, reason: v.priced ? null : v.reason };
  };

  /**
   * A recipe worth reading before anyone puts it on a chart.
   *
   * Two ways in. Its ingredients contradict the figure its source publishes —
   * usually a pan of frying oil the food absorbs a little of, or a marinade
   * poured away. Or the figure is simply too large to be one serving, which is
   * what a whole pot recorded with a servings count of one looks like. The
   * second kind agrees with its source perfectly and is still wrong.
   */
  const suspect = (d: DishRow) => figures(d).clash !== null;

  /** Cleared by the same two gates used when a chart reads the library. */
  const approvalReady = (d: DishRow) => {
    const f = figures(d);
    return f.kcal !== null && f.clash === null;
  };

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = needle ? dishes.filter((d) => d.name.toLowerCase().includes(needle)) : dishes;
    if (filter === "pending") list = list.filter((d) => !d.approved && approvalReady(d));
    if (filter === "held") list = list.filter((d) => !d.approved && !approvalReady(d));
    if (filter === "suspect") list = list.filter(suspect);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dishes, q, filter]);

  const shownFoods = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return foods;
    return foods.filter((f) => f.name.toLowerCase().includes(needle) || f.food_code.toLowerCase().includes(needle));
  }, [foods, q]);

  const pending = useMemo(() => dishes.filter((d) => !d.approved).length, [dishes]);
  const ready = useMemo(() => dishes.filter((d) => !d.approved && approvalReady(d)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dishes, foodMap]);
  const held = pending - ready;
  const suspects = useMemo(() => dishes.filter(suspect).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dishes, foodMap]);

  /**
   * The dish currently opened up, if any.
   *
   * Held as an id rather than the row, so that after a save the panel shows the
   * refreshed record the server sent back instead of the copy taken when it
   * opened. Editing a weight and seeing the old figure survive the save is how
   * somebody concludes the save did not work and does it again.
   */
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const opened = useMemo(() => dishes.find((d) => d.id === openId) ?? null, [dishes, openId]);

  const edit = (d: DishRow) => setDraft({
    id: d.id, name: d.name, cuisine: d.cuisine ?? "", servings: String(d.servings ?? ""),
    cooked_g: String(d.cooked_g ?? ""), serving_label: d.serving_label ?? "", notes: d.notes ?? "",
    items: d.items.length
      ? d.items.map((i) => ({ food_code: i.food_code, name: i.name, raw_g: String(i.raw_g) }))
      : [{ food_code: null, name: "", raw_g: "" }],
  });

  const save = () => {
    if (!draft) return;
    setErr(null);
    start(async () => {
      const fd = new FormData();
      if (draft.id) fd.set("id", draft.id);
      fd.set("name", draft.name);
      fd.set("cuisine", draft.cuisine);
      fd.set("servings", draft.servings);
      fd.set("cooked_g", draft.cooked_g);
      fd.set("serving_label", draft.serving_label);
      fd.set("notes", draft.notes);
      fd.set("items", JSON.stringify(draft.items.filter((i) => i.name.trim())));
      const r = await saveDish(fd);
      if (r?.error) { setErr(r.error); return; }
      setDraft(null);
    });
  };

  const approveShown = (formData: FormData) => {
    setErr(null);
    start(async () => {
      const result = await approveDishes(formData);
      if (result?.error) setErr(result.error);
    });
  };

  const toggleApproval = (formData: FormData) => {
    setErr(null);
    start(async () => {
      const result = await setDishApproved(formData);
      if (result?.error) setErr(result.error);
    });
  };

  // What the dish being edited would come to, recomputed as the grams change.
  const draftVerdict = draft
    ? dishNutrients({
      name: draft.name, cooked_g: Number(draft.cooked_g) || null, servings: Number(draft.servings) || null,
      items: draft.items.filter((i) => i.name.trim()).map((i) => ({ food_code: i.food_code, name: i.name, raw_g: Number(i.raw_g) || 0 })),
    }, foodMap)
    : null;

  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
        {view === "dishes"
          ? "Recipes costed against the food table. Once a dish is here, a chart option built from it carries calculated numbers instead of remembered ones."
          : "The food table itself — single ingredients, per 100 g, as published. Recipes are built from these; nothing here is edited by hand."}
      </div>

      {/* ---- DISHES OR INGREDIENTS ----
          Two different things that were both being counted in one line, with
          only one of them ever shown. A recipe is a list of ingredients in
          grams; an ingredient is a row of published composition. Being able to
          look up "what does the table actually say about coconut" is the
          question that comes up when a dish's figures look wrong. */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {([["dishes", `Dishes (${dishes.length})`], ["foods", `Ingredients (${foods.length})`]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => { setView(k); setQ(""); }}
            style={view === k ? darkBtn : { ...ghost, background: "#fff" }}>{label}</button>
        ))}
      </div>

      <div style={{ ...box, padding: 14, marginBottom: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={view === "dishes" ? "Search dishes…" : "Search ingredients…"} style={{ ...inp, minWidth: 220 }} />
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {view === "dishes"
            ? `${shown.length} of ${dishes.length} shown`
            : `${shownFoods.length} of ${foods.length} shown`}
        </span>
        {canEdit && view === "dishes" && <button type="button" onClick={() => setDraft(blank())} style={darkBtn}>+ New dish</button>}
      </div>

      {view === "foods" && (
        <div style={{ ...box, overflow: "hidden" }}>
          {shownFoods.length === 0 ? (
            <div style={{ padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No ingredient matches that search.</div>
          ) : shownFoods.slice(0, 300).map((f) => (
            <div key={f.food_code} style={{ borderTop: "1px solid var(--border)", padding: "10px 14px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ minWidth: 220, flex: 1 }}>
                <b style={{ fontSize: 13 }}>{f.name}</b>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{f.food_code}</div>
              </div>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>per 100 g</span>
              <span style={{ fontSize: 12, fontWeight: 600, minWidth: 260, textAlign: "right" }}>
                {f.kcal ?? "—"} kcal · {f.protein_g ?? "—"}g protein · {f.carb_g ?? "—"}g carbs · {f.fat_g ?? "—"}g fat · {f.fibre_g ?? "—"}g fibre
              </span>
            </div>
          ))}
          {/* The list is reference data, not a worklist. Showing all 719 is a
              long scroll to no purpose when searching is how anyone finds a
              row; the cap keeps the page quick and says so plainly. */}
          {shownFoods.length > 300 && (
            <div style={{ borderTop: "1px solid var(--border)", padding: "10px 14px", fontSize: 12, color: "var(--muted)" }}>
              Showing the first 300 of {shownFoods.length}. Search to narrow it down.
            </div>
          )}
        </div>
      )}


      {/* ---- ONE DISH, OPENED UP ----
          Takes over the screen while it is open. A detail panel above a list of
          a thousand rows is a panel nobody can read without losing their place,
          and the list is still one Back away. */}
      {view === "dishes" && opened && (
        <DishDetail
          dish={opened}
          foods={foods}
          measures={measures}
          micros={micros}
          canEdit={canEdit}
          busy={saving}
          error={detailErr}
          onClose={() => { setOpenId(null); setDetailErr(null); }}
          onRewrite={() => { edit(opened); setOpenId(null); }}
          portionMedian={medians.get(servingUnit(opened.serving_label) ?? "") ?? null}
          onSavePortion={(label, grams) => startSaving(async () => {
            const fd = new FormData();
            fd.set("id", opened.id);
            fd.set("portion_g", grams);
            fd.set("serving_label", label);
            const r = await setDishPortion(fd);
            setDetailErr(r?.error ?? null);
          })}
          onTeachMeasure={(food, unit, grams) => startSaving(async () => {
            const fd = new FormData();
            fd.set("food_code", food); fd.set("unit", unit); fd.set("grams", String(grams));
            const r = await setFoodMeasure(fd);
            setDetailErr(r.error ?? null);
          })}
          onSave={({ servings, items }) => startSaving(async () => {
            const fd = new FormData();
            fd.set("id", opened.id);
            fd.set("servings", String(servings));
            // Only the rows she edited, each named by its position in the
            // recipe. The untouched ones are not sent, so they cannot drift.
            fd.set("items", JSON.stringify(items.map((i) => ({ seq: i.seq, raw_g: i.raw_g }))));
            const r = await saveDishPortions(fd);
            setDetailErr(r.error ?? null);
            if (!r.error) setOpenId(null);
          })}
        />
      )}

      {/* ---- REVIEW BAR ----
          Only drawn while something is waiting. An imported library lands here
          unapproved and stays out of every chart until it is read; once she has
          worked through it this row disappears and the screen is what it was. */}
      {view === "dishes" && !opened && canEdit && (pending > 0 || suspects > 0) && (
        <div style={{ ...box, padding: 14, marginBottom: 14, background: "var(--amber-bg)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 13 }}>
            {pending > 0 && (
              <>
                <b>{ready} recipe{ready === 1 ? "" : "s"} ready for approval.</b>
                {held > 0 && <span style={{ color: "var(--amber-text)" }}> {held} held because a serving or trustworthy nutrition figure is still missing.</span>}
              </>
            )}
            {pending === 0 && <b>All recipes approved.</b>}
          </div>
          <span style={{ flex: 1 }} />

          {/* Three views of the same list. "Needs a look" is the one to clear
              first: those recipes are priced, so they will pass every check —
              the only thing wrong with them is that their own ingredients say
              something different, and nobody would notice by scrolling. */}
          {([
            ["all", `All ${dishes.length}`, dishes.length],
            ["pending", `Ready (${ready})`, ready],
            ["held", `Source data needed (${held})`, held],
            ["suspect", `Needs a look (${suspects})`, suspects],
          ] as const).filter(([, , n]) => n > 0).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setFilter(key)}
              style={filter === key
                ? { ...darkBtn, padding: "6px 12px", fontSize: 12.5 }
                : { ...ghost, background: "#fff" }}>
              {label}
            </button>
          ))}
          {/* Approves what is ON SCREEN, not everything outstanding. Search for
              "dosa", read the eleven results, approve those eleven — which is
              how a thousand recipes actually get worked through. A button that
              silently cleared all 1,014 would make the gate pointless. */}
          {shown.some((d) => !d.approved && approvalReady(d)) && (
            <form action={approveShown}>
              <input type="hidden" name="ids" value={shown.filter((d) => !d.approved && approvalReady(d)).map((d) => d.id).join(",")} />
              <button style={darkBtn}>
                Approve the {shown.filter((d) => !d.approved && approvalReady(d)).length} ready
              </button>
            </form>
          )}
        </div>
      )}

      {view === "dishes" && !opened && draft && (
        <div style={{ ...box, padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>{draft.id ? "Edit dish" : "New dish"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 12 }}>
            <label style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>Name
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Puttu" style={{ ...inp, width: "100%", marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>Servings the recipe makes
              <input value={draft.servings} onChange={(e) => setDraft({ ...draft, servings: e.target.value })} placeholder="2" style={{ ...inp, width: "100%", marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>How a portion is written
              <input value={draft.serving_label} onChange={(e) => setDraft({ ...draft, serving_label: e.target.value })} placeholder="1 medium piece" style={{ ...inp, width: "100%", marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>Cooked weight (g, optional)
              <input value={draft.cooked_g} onChange={(e) => setDraft({ ...draft, cooked_g: e.target.value })} placeholder="300" style={{ ...inp, width: "100%", marginTop: 4 }} />
            </label>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Ingredients — raw weight, as the food table measures them</div>
          {draft.items.map((it, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <input list="ifct-foods" value={it.name}
                onChange={(e) => {
                  const name = e.target.value;
                  // Typing the exact table name links the row; anything else
                  // leaves it unmatched, which the panel then reports.
                  const hit = foods.find((f) => f.name === name);
                  setDraft({ ...draft, items: draft.items.map((x, j) => j === i ? { ...x, name, food_code: hit?.food_code ?? null } : x) });
                }}
                placeholder="Start typing a food…" style={{ ...inp, flex: 1, minWidth: 240 }} />
              <input value={it.raw_g} onChange={(e) => setDraft({ ...draft, items: draft.items.map((x, j) => j === i ? { ...x, raw_g: e.target.value } : x) })}
                placeholder="grams" style={{ ...inp, width: 90 }} />
              <span style={{ fontSize: 11.5, color: it.food_code ? "var(--green-text)" : "var(--amber-text)", alignSelf: "center", minWidth: 90 }}>
                {it.food_code ? "matched" : it.name.trim() ? "not matched" : ""}
              </span>
              <button type="button" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, j) => j !== i) })} style={ghost}>Remove</button>
            </div>
          ))}
          <datalist id="ifct-foods">
            {foods.map((f) => <option key={f.food_code} value={f.name} />)}
          </datalist>
          <button type="button" onClick={() => setDraft({ ...draft, items: [...draft.items, { food_code: null, name: "", raw_g: "" }] })} style={{ ...ghost, marginBottom: 12 }}>+ Add ingredient</button>

          <div style={{ ...box, padding: 12, marginBottom: 12, background: draftVerdict?.priced ? "var(--green-bg)" : "var(--amber-bg)" }}>
            {draftVerdict?.priced ? (
              <div style={{ fontSize: 12.5, color: "var(--green-text)", fontWeight: 600 }}>
                One serving: {draftVerdict.perServing.kcal} kcal · {draftVerdict.perServing.protein_g}g protein · {draftVerdict.perServing.carb_g}g carbs · {draftVerdict.perServing.fat_g}g fat · {draftVerdict.perServing.fibre_g}g fibre
                {energyLooksWrong(draftVerdict.perServing) && <div style={{ color: "var(--red-text)", marginTop: 4 }}>The calories don&apos;t match the macros — check a weight.</div>}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--amber-text)", fontWeight: 600 }}>
                Not priced yet — {draftVerdict?.reason ?? "add some ingredients"}.
              </div>
            )}
          </div>

          {err && <div style={{ fontSize: 12, color: "var(--red-text)", marginBottom: 8 }}>{err}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={save} disabled={busy || !draft.name.trim()} style={{ ...darkBtn, opacity: busy || !draft.name.trim() ? 0.6 : 1 }}>{busy ? "Saving…" : "Save dish"}</button>
            <button type="button" onClick={() => { setDraft(null); setErr(null); }} style={ghost}>Cancel</button>
          </div>
        </div>
      )}

      {view === "dishes" && !opened && (shown.length === 0 ? (
        <div style={{ ...box, padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          {dishes.length ? "No dish matches that search." : "No dishes yet. Add the ones you write most often — puttu, kadala curry, idiyappam — and every chart built from them prices itself."}
        </div>
      ) : (
        <div style={{ ...box, overflow: "hidden" }}>
          {shown.map((d) => {
            const f = figures(d);
            return (
              <div key={d.id} style={{ borderTop: "1px solid var(--border)", padding: "11px 14px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: d.approved ? undefined : "var(--amber-bg)" }}>
                <div style={{ minWidth: 200, flex: 1 }}>
                  <b style={{ fontSize: 13 }}>{d.name}</b>
                  {d.serving_label && <span style={{ color: "var(--muted)", fontSize: 12 }}> · {d.serving_label}</span>}
                  {d.portion_g != null && (
                    // "of ingredients", always. Rice triples when boiled, so
                    // calling this the weight of the served food would mislead.
                    <span style={{ color: "var(--muted)", fontSize: 12 }} title={
                      d.portion_g_source === "dietitian"
                        ? "Set by the dietitian"
                        : "Worked out from the recipe: ingredients ÷ servings"}>
                      {" "}· ≈{Math.round(Number(d.portion_g))} g of ingredients
                      {d.portion_g_source === "dietitian" ? " (set here)" : ""}
                    </span>
                  )}
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    {d.items.length} ingredient{d.items.length === 1 ? "" : "s"}
                    {d.source && <> · {d.source}</>}
                    {d.approved && d.approved_by && <> · approved by {d.approved_by}</>}
                  </div>
                  {/* A weight nobody can trace must never look like one anybody
                      can. Named, not just counted, because "asafoetida" tells
                      her at a glance that it does not matter and "custard
                      powder" tells her it might. */}
                  {estimated(d).length > 0 && (
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}
                         title="A ground spice USDA publishes no weight for. Taken as 2.5 g per teaspoon — the middle of its range for the spices it does publish.">
                      Estimated weight for {estimated(d).join(", ")}
                    </div>
                  )}
                  {standIns(d).map(([note, names]) => (
                    <div key={note} style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                      {names.join(", ")} — {note}
                    </div>
                  ))}
                  {f.clash && (
                    <div style={{ fontSize: 11.5, color: "var(--amber-text)", marginTop: 2 }}>{f.clash}</div>
                  )}

                  {/* ---- SERVINGS, EDITABLE IN PLACE ----
                      Drawn only where it is the likely fix: a row that is
                      flagged, or one with no figures at all. Everywhere else it
                      would be clutter on a list of a thousand.

                      The figures above update as she types, before anything is
                      saved, because "feeds six" is a different claim once you
                      can see it makes each portion 780 kcal. */}
                  {canEdit && (f.clash || f.kcal == null) && (
                    <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                      <span style={{ color: "var(--muted)" }}>Makes</span>
                      <input type="number" min="0.25" step="0.25"
                        value={srvEdit[d.id] ?? (d.servings ?? "")}
                        onChange={(e) => setSrvEdit((m) => ({ ...m, [d.id]: e.target.value }))}
                        onBlur={() => saveServings(d)}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        style={{ ...inp, width: 62, height: 26, fontSize: 12 }}
                        title="How many servings the whole recipe makes" />
                      <span style={{ color: "var(--muted)" }}>servings</span>
                      {(() => {
                        // Offered only into an untouched box, and only where the
                        // recipe is plainly bigger than a portion. Once she has
                        // typed anything, hers is the number that counts.
                        const total = wholeRecipe(d);
                        const hint = srvEdit[d.id] === undefined && total !== null ? suggestServings(total) : null;
                        return hint && hint !== d.servings ? (
                          <button type="button"
                            onClick={() => setSrvEdit((m) => ({ ...m, [d.id]: String(hint) }))}
                            style={{ ...ghost, padding: "2px 8px", fontSize: 11.5, fontWeight: 500 }}
                            title={`The whole recipe comes to ${Math.round(total!)} kcal — about ${hint} portions. A suggestion, not a measurement.`}>
                            looks like {hint} — use this?
                          </button>
                        ) : null;
                      })()}
                      {srvSaving === d.id
                        ? <span style={{ color: "var(--muted)" }}>saving…</span>
                        : srvEdit[d.id] !== undefined && String(d.servings ?? "") !== srvEdit[d.id].trim()
                          ? <span style={{ color: "var(--amber-text)" }}>press Enter or click away to save</span>
                          : null}
                    </div>
                  )}

                  {/* The portion used to be editable here too, which meant the
                      same figure appeared twice on one row — once as text and
                      once in a box. Editing it now lives on the dish itself,
                      behind Edit, where the ingredients it is derived from are
                      also on screen. A list of a thousand rows is for reading. */}
                </div>

                {f.kcal != null ? (
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {f.kcal} kcal · {f.protein}g protein
                    {/* Said every time, not just once at the top. She is
                        deciding dish by dish whether to trust the number, and
                        which kind of number it is belongs next to it. */}
                    {f.quoted && <span style={{ color: "var(--muted)", fontWeight: 500 }}> · quoted, not calculated</span>}
                  </span>
                ) : (
                  <span style={{ fontSize: 11.5, color: "var(--amber-text)", fontWeight: 600 }}>{f.reason}</span>
                )}

                {canEdit && (
                  <>
                    {/* Approving is what puts a recipe in front of a client, so
                        it sits with the other things that change the dish. */}
                    <form action={toggleApproval}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="approve" value={d.approved ? "false" : "true"} />
                      <button disabled={!d.approved && !approvalReady(d)} title={!d.approved && !approvalReady(d) ? "Add a reliable serving and nutrition figure before approval" : undefined}
                        style={d.approved ? ghost : approvalReady(d)
                          ? { ...darkBtn, padding: "6px 12px", fontSize: 12.5 }
                          : { ...ghost, color: "var(--muted)", cursor: "not-allowed" }}>
                        {d.approved ? "Withdraw" : approvalReady(d) ? "Approve" : "Held"}
                      </button>
                    </form>
                    <button type="button" onClick={() => { setOpenId(d.id); setDetailErr(null); }} style={ghost}>Edit</button>
                    <form action={deleteDish}>
                      <input type="hidden" name="id" value={d.id} />
                      <button style={ghost}>Delete</button>
                    </form>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
