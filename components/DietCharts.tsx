"use client";

import { useState } from "react";
import Link from "next/link";
import { addDietChart, publishDietChart, deleteDietChart } from "@/lib/actions";

export type DietChartRow = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  version: number;
  status: string;
  calories: number | null;
  protein: string | null;
  notes: string | null;
  meals: [string, string][];
  by_name: string | null;
  created_at: string;
};

const DEFAULT_ROWS: [string, string][] = [["Early Morning", ""], ["Breakfast", ""], ["Mid-Morning", ""], ["Lunch", ""], ["Evening", ""], ["Dinner", ""]];

export default function DietCharts({ charts, clients }: { charts: DietChartRow[]; clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<[string, string][]>(DEFAULT_ROWS);
  const [expanded, setExpanded] = useState<string | null>(null);

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff" };
// Same look, but a fixed height — an <input> and a <select> do not share
// an intrinsic height, so identical padding leaves them visibly staggered.
// Not applied to <textarea>, which must stay free to grow.
const inpControl: React.CSSProperties = { ...inp, padding: "0 10px", height: 36, boxSizing: "border-box" };
  const setRow = (i: number, j: 0 | 1, v: string) => setRows((r) => r.map((row, k) => (k === i ? (j === 0 ? [v, row[1]] : [row[0], v]) : row)));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Compose meal-by-meal plans, save as draft, then publish to the client&apos;s portal.</div>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{open ? "Cancel" : "+ New diet chart"}</button>
      </div>

      {open && (
        <form action={addDietChart} onSubmit={() => setTimeout(() => { setOpen(false); setRows(DEFAULT_ROWS); }, 50)} style={{ ...box, padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 700 }}>Diet chart builder</div>
          <select name="client_id" required defaultValue="" style={inpControl}>
            <option value="" disabled>Select client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Meals</div>
          {rows.map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "150px 1fr 30px", gap: 8 }}>
              <input name="meal_label" value={row[0]} onChange={(e) => setRow(i, 0, e.target.value)} placeholder="Meal" style={inpControl} />
              <input name="meal_detail" value={row[1]} onChange={(e) => setRow(i, 1, e.target.value)} placeholder="What to eat…" style={inpControl} />
              <button type="button" onClick={() => setRows((r) => r.filter((_, k) => k !== i))} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, cursor: "pointer", color: "var(--red-text)" }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setRows((r) => [...r, ["", ""]])} style={{ alignSelf: "start", border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>+ Add meal row</button>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input name="calories" type="number" placeholder="Calories (kcal/day)" style={inpControl} />
            <input name="protein" placeholder="Protein target (e.g. 72 g)" style={inpControl} />
          </div>
          <textarea name="notes" rows={2} placeholder="Notes for the client…" style={{ ...inp, resize: "vertical" }} />
          <div><button style={{ background: "var(--brand-fill)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save as draft</button></div>
        </form>
      )}

      <div style={{ ...box, overflow: "hidden" }}>
        {charts.length ? charts.map((dc) => (
          <div key={dc.id} style={{ borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 13 }}>{dc.client_name ?? "—"} <span style={{ color: "var(--muted)", fontWeight: 500 }}>· v{dc.version}</span></b>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>{dc.calories ? `${dc.calories} kcal` : "—"}{dc.protein ? ` · ${dc.protein} protein` : ""} · {new Date(dc.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</div>
              </div>
              <span style={{ background: dc.status === "Published" ? "var(--green-bg)" : "var(--amber-bg)", color: dc.status === "Published" ? "var(--green-text)" : "var(--amber-text)", borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600 }}>{dc.status}</span>
              <button type="button" onClick={() => setExpanded((e) => (e === dc.id ? null : dc.id))} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{expanded === dc.id ? "Hide" : "View"}</button>
              {dc.status === "Draft" && (
                <form action={publishDietChart}><input type="hidden" name="id" value={dc.id} /><button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Publish</button></form>
              )}
              <form action={deleteDietChart}><input type="hidden" name="id" value={dc.id} /><button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 9px", fontSize: 12, cursor: "pointer", color: "var(--red-text)" }} title="Delete">✕</button></form>
            </div>
            {expanded === dc.id && (
              <div style={{ padding: "0 16px 14px 16px" }}>
                <div style={{ background: "var(--bg)", borderRadius: 10, padding: "8px 12px" }}>
                  {dc.meals.map(([label, detail], i) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "5px 0", fontSize: 13, borderTop: i ? "1px solid var(--border)" : "none" }}>
                      <div style={{ width: 130, fontWeight: 600 }}>{label}</div>
                      <div style={{ flex: 1, color: "var(--ink)" }}>{detail}</div>
                    </div>
                  ))}
                  {dc.notes && <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--muted)" }}>📝 {dc.notes}</div>}
                  {dc.client_id && <div style={{ marginTop: 8 }}><Link href={`/clients/${dc.client_id}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontSize: 12.5, fontWeight: 600 }}>Open client card →</Link></div>}
                </div>
              </div>
            )}
          </div>
        )) : <div style={{ padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No diet charts yet.</div>}
      </div>
    </div>
  );
}
