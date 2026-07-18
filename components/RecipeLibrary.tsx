"use client";

import { useState } from "react";
import { addRecipe, toggleRecipe, deleteRecipe } from "@/lib/actions";

export type RecipeRow = {
  id: string;
  week: string | null;
  name: string;
  tags: string | null;
  kcal: number | null;
  published: boolean;
  created_at: string;
};

export default function RecipeLibrary({ recipes }: { recipes: RecipeRow[] }) {
  const [open, setOpen] = useState(false);

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff" };

  const weeks = new Map<string, RecipeRow[]>();
  for (const r of recipes) { const w = r.week || "Unscheduled"; (weeks.get(w) ?? weeks.set(w, []).get(w)!).push(r); }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Weekly recipe library — publish to share with clients.</div>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{open ? "Cancel" : "+ New recipe"}</button>
      </div>

      {open && (
        <form action={addRecipe} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ ...box, padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
            <input name="name" required placeholder="Recipe name" style={inp} />
            <input name="week" placeholder="Week (e.g. Week of Jul 6)" style={inp} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
            <input name="tags" placeholder="Tags (e.g. High protein · PCOS friendly)" style={inp} />
            <input name="kcal" type="number" placeholder="kcal" style={inp} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" name="published" /> Publish immediately (visible to clients)
          </label>
          <div><button style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add recipe</button></div>
        </form>
      )}

      {recipes.length === 0 ? (
        <div style={{ ...box, padding: "24px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No recipes yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[...weeks.entries()].map(([week, list]) => (
            <div key={week} style={{ ...box, overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", fontWeight: 700, fontSize: 13.5 }}>🗓 {week}</div>
              {list.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderTop: "1px solid var(--border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 13 }}>{r.name}</b>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{[r.tags, r.kcal ? `${r.kcal} kcal` : null].filter(Boolean).join(" · ") || "—"}</div>
                  </div>
                  <span style={{ background: r.published ? "var(--green-bg)" : "#eef2f1", color: r.published ? "#166534" : "var(--muted)", borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600 }}>{r.published ? "Published" : "Draft"}</span>
                  <form action={toggleRecipe}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="published" value={String(r.published)} />
                    <button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--teal-dark)", whiteSpace: "nowrap" }}>{r.published ? "Unpublish" : "Publish"}</button>
                  </form>
                  <form action={deleteRecipe}><input type="hidden" name="id" value={r.id} /><button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 9px", fontSize: 12, cursor: "pointer", color: "#991b1b" }} title="Delete">✕</button></form>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
