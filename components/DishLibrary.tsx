"use client";

import { useMemo, useState, useTransition } from "react";
import { saveDish, deleteDish, setDishApproved, approveDishes } from "@/lib/actions";
import { dishNutrients, energyLooksWrong, contradictsSource, type Food, type Dish } from "@/lib/nutrition";

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
  source_protein_g: number | null;
  /** Cleared for use on a client's chart. */
  approved: boolean;
  approved_by: string | null;
  items: { food_code: string | null; name: string; raw_g: number; seq: number }[];
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
 * The panel never estimates. Where an ingredient hasn't been matched to the
 * food table, or a weight or serving count is missing, it says which — because
 * a plausible number with nothing behind it is precisely what this replaces.
 */
export default function DishLibrary({ dishes, foods, canEdit }: {
  dishes: DishRow[];
  /** The ICMR food table, for matching ingredients. */
  foods: Food[];
  canEdit: boolean;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [q, setQ] = useState("");
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const foodMap = useMemo(() => new Map(foods.map((f) => [f.food_code, f])), [foods]);

  const priced = (d: DishRow) => dishNutrients(
    { name: d.name, cooked_g: d.cooked_g, servings: d.servings, items: d.items }, foodMap);

  // Reviewing an imported library is the job this screen now has to support,
  // so the two questions worth asking of a thousand rows — what have I not
  // cleared, and what looks wrong — are filters rather than something to find
  // by scrolling.
  const [filter, setFilter] = useState<"all" | "pending" | "suspect">("all");

  /** Which of the two tables this screen is showing. */
  const [view, setView] = useState<"dishes" | "foods">("dishes");

  /**
   * A recipe whose own ingredients contradict the figure its source publishes.
   *
   * Nearly always a recipe that lists something it does not contain: a pan of
   * frying oil the food absorbs a little of, a marinade poured away. Worth
   * looking at before the recipe is used on anyone's chart, and impossible to
   * find among a thousand rows without asking for it.
   */
  const suspect = (d: DishRow) => figures(d).clash !== null;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = needle ? dishes.filter((d) => d.name.toLowerCase().includes(needle)) : dishes;
    if (filter === "pending") list = list.filter((d) => !d.approved);
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
  const suspects = useMemo(() => dishes.filter(suspect).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dishes, foodMap]);

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
    const pub = d.source_kcal != null && d.source_protein_g != null
      ? { kcal: Math.round(Number(d.source_kcal)), protein: Math.round(Number(d.source_protein_g) * 10) / 10 }
      : null;
    // A published CALORIE figure alone is enough to contradict our sums —
    // whether the source also recorded protein has nothing to do with it.
    // Tying the two together let a cabbage kofta curry through at 4,212 kcal.
    const clash = v.priced && d.source_kcal != null
      && contradictsSource(v.perServing.kcal, Math.round(Number(d.source_kcal)));
    const disagreement = clash && v.priced
      ? `ingredients as listed come to ${v.perServing.kcal} kcal — check for frying oil that isn't eaten`
      : null;

    if (v.priced && !clash) {
      return { kcal: v.perServing.kcal, protein: v.perServing.protein_g, quoted: false, clash: null, reason: null };
    }
    if (pub) return { ...pub, quoted: true, reason: null, clash: disagreement };
    // Contradicted with nothing complete to fall back on: no figures at all
    // rather than ours kept by default.
    return { kcal: null, protein: null, quoted: false, clash: disagreement, reason: v.priced ? null : v.reason };
  };

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


      {/* ---- REVIEW BAR ----
          Only drawn while something is waiting. An imported library lands here
          unapproved and stays out of every chart until it is read; once she has
          worked through it this row disappears and the screen is what it was. */}
      {view === "dishes" && canEdit && (pending > 0 || suspects > 0) && (
        <div style={{ ...box, padding: 14, marginBottom: 14, background: "var(--amber-bg)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 13 }}>
            {pending > 0 && (
              <>
                <b>{pending} recipe{pending === 1 ? "" : "s"} waiting to be approved.</b>
                <span style={{ color: "var(--amber-text)" }}> Nothing here can be used on a client&apos;s chart until you approve it.</span>
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
            ["pending", `Not approved (${pending})`, pending],
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
          {shown.some((d) => !d.approved) && (
            <form action={approveDishes}>
              <input type="hidden" name="ids" value={shown.filter((d) => !d.approved).map((d) => d.id).join(",")} />
              <button style={darkBtn}>
                Approve the {shown.filter((d) => !d.approved).length} shown
              </button>
            </form>
          )}
        </div>
      )}

      {view === "dishes" && draft && (
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

      {view === "dishes" && (shown.length === 0 ? (
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
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    {d.items.length} ingredient{d.items.length === 1 ? "" : "s"}
                    {d.source && <> · {d.source}</>}
                    {d.approved && d.approved_by && <> · approved by {d.approved_by}</>}
                  </div>
                  {f.clash && (
                    <div style={{ fontSize: 11.5, color: "var(--amber-text)", marginTop: 2 }}>{f.clash}</div>
                  )}
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
                    <form action={setDishApproved}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="approve" value={d.approved ? "false" : "true"} />
                      <button style={d.approved ? ghost : { ...darkBtn, padding: "6px 12px", fontSize: 12.5 }}>
                        {d.approved ? "Withdraw" : "Approve"}
                      </button>
                    </form>
                    <button type="button" onClick={() => edit(d)} style={ghost}>Edit</button>
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
