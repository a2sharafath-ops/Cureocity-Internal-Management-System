"use client";

import { useMemo, useState, useTransition } from "react";
import { saveDish, deleteDish } from "@/lib/actions";
import { dishNutrients, energyLooksWrong, type Food, type Dish } from "@/lib/nutrition";

export type DishRow = {
  id: string;
  name: string;
  cuisine: string | null;
  cooked_g: number | null;
  servings: number | null;
  serving_label: string | null;
  notes: string | null;
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

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? dishes.filter((d) => d.name.toLowerCase().includes(needle)) : dishes;
  }, [dishes, q]);

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
        Recipes costed against the ICMR food table. Once a dish is here, a chart option built from it carries calculated numbers instead of remembered ones.
      </div>

      <div style={{ ...box, padding: 14, marginBottom: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dishes…" style={{ ...inp, minWidth: 220 }} />
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{dishes.length} dish{dishes.length === 1 ? "" : "es"} · {foods.length} foods</span>
        {canEdit && <button type="button" onClick={() => setDraft(blank())} style={darkBtn}>+ New dish</button>}
      </div>

      {draft && (
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

      {shown.length === 0 ? (
        <div style={{ ...box, padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          {dishes.length ? "No dish matches that search." : "No dishes yet. Add the ones you write most often — puttu, kadala curry, idiyappam — and every chart built from them prices itself."}
        </div>
      ) : (
        <div style={{ ...box, overflow: "hidden" }}>
          {shown.map((d) => {
            const v = priced(d);
            return (
              <div key={d.id} style={{ borderTop: "1px solid var(--border)", padding: "11px 14px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ minWidth: 200, flex: 1 }}>
                  <b style={{ fontSize: 13 }}>{d.name}</b>
                  {d.serving_label && <span style={{ color: "var(--muted)", fontSize: 12 }}> · {d.serving_label}</span>}
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{d.items.length} ingredient{d.items.length === 1 ? "" : "s"}</div>
                </div>
                {v.priced ? (
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{v.perServing.kcal} kcal · {v.perServing.protein_g}g protein</span>
                ) : (
                  <span style={{ fontSize: 11.5, color: "var(--amber-text)", fontWeight: 600 }}>{v.reason}</span>
                )}
                {canEdit && (
                  <>
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
      )}
    </div>
  );
}
