"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { addDietChart, publishDietChart, deleteDietChart, submitDietChartForReview, reviewDietChart } from "@/lib/actions";

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
  review_note: string | null;
  reviewed_by: string | null;
};

const DEFAULT_ROWS: [string, string][] = [["Early Morning", ""], ["Breakfast", ""], ["Mid-Morning", ""], ["Lunch", ""], ["Evening", ""], ["Dinner", ""]];

export default function DietCharts({ charts, clients, canReview = false, canCompose = true }: { charts: DietChartRow[]; clients: { id: string; name: string }[]; canReview?: boolean; canCompose?: boolean }) {
  // Deep-linked from a "diet chart pending" reminder: ?client=<id> opens the
  // builder straight away with that client pre-selected.
  const focusClient = useSearchParams().get("client") ?? "";
  const [open, setOpen] = useState(Boolean(focusClient));
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
        <div style={{ fontSize: 13, color: "var(--muted)" }}>{canCompose ? "Compose a plan → submit for Medical-Director review → publish once approved." : "Review submitted diet charts: approve or send back with a note."}</div>
        <span style={{ flex: 1 }} />
        {canCompose && <button type="button" onClick={() => setOpen((v) => !v)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{open ? "Cancel" : "+ New diet chart"}</button>}
      </div>

      {open && canCompose && (
        <form action={addDietChart} onSubmit={() => setTimeout(() => { setOpen(false); setRows(DEFAULT_ROWS); }, 50)} style={{ ...box, padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 700 }}>Diet chart builder</div>
          <select name="client_id" required defaultValue={focusClient} style={inpControl}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <b style={{ fontSize: 13 }}>{dc.client_name ?? "—"} <span style={{ color: "var(--muted)", fontWeight: 500 }}>· v{dc.version}</span></b>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>{dc.calories ? `${dc.calories} kcal` : "—"}{dc.protein ? ` · ${dc.protein} protein` : ""} · {new Date(dc.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</div>
              </div>
              {(() => {
                const st = dc.status;
                const green = st === "Published" || st === "Approved";
                const bg = green ? "var(--green-bg)" : st === "In review" ? "var(--blue-bg)" : "var(--neutral-bg)";
                const col = green ? "var(--green-text)" : st === "In review" ? "var(--blue-text)" : "var(--muted)";
                return <span style={{ background: bg, color: col, borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600 }}>{st}</span>;
              })()}
              <button type="button" onClick={() => setExpanded((e) => (e === dc.id ? null : dc.id))} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{expanded === dc.id ? "Hide" : "View"}</button>

              {dc.status === "Draft" && (
                <form action={submitDietChartForReview}><input type="hidden" name="id" value={dc.id} /><button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Submit for review</button></form>
              )}
              {dc.status === "In review" && (canReview ? (
                <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <form action={reviewDietChart} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <input type="hidden" name="id" value={dc.id} />
                    <input type="hidden" name="decision" value="changes" />
                    <input name="note" placeholder="Change note…" style={{ ...inp, height: 32, width: 150 }} />
                    <button style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--amber-text)", whiteSpace: "nowrap" }}>Request changes</button>
                  </form>
                  <form action={reviewDietChart}><input type="hidden" name="id" value={dc.id} /><input type="hidden" name="decision" value="approve" /><button style={{ background: "var(--green)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Approve</button></form>
                </span>
              ) : <span style={{ fontSize: 12, color: "var(--muted)" }}>Awaiting MD review</span>)}
              {dc.status === "Approved" && (
                <form action={publishDietChart}><input type="hidden" name="id" value={dc.id} /><button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Publish</button></form>
              )}
              <form action={deleteDietChart}><input type="hidden" name="id" value={dc.id} /><button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 9px", fontSize: 12, cursor: "pointer", color: "var(--red-text)" }} title="Delete">✕</button></form>
            </div>
            {dc.status === "Draft" && dc.review_note && (
              <div style={{ margin: "0 16px 12px", background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 8, padding: "7px 10px", fontSize: 12 }}>✏️ Changes requested{dc.reviewed_by ? ` by ${dc.reviewed_by}` : ""}: {dc.review_note}</div>
            )}
            {dc.status === "Approved" && dc.reviewed_by && (
              <div style={{ margin: "0 16px 12px", background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 8, padding: "7px 10px", fontSize: 12 }}>✅ Approved by {dc.reviewed_by} · ready to publish</div>
            )}
            {expanded === dc.id && (
              <div style={{ padding: "0 16px 14px 16px" }}>
                <div style={{ background: "var(--bg)", borderRadius: 10, padding: "8px 12px" }}>
                  {dc.meals.map(([label, detail], i) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "5px 0", fontSize: 13, borderTop: i ? "1px solid var(--border)" : "none" }}>
                      <div style={{ width: 130, fontWeight: 600 }}>{label}</div>
                      <div style={{ flex: 1, color: "var(--ink)" }}>{detail}</div>
                    </div>
                  ))}
                  {dc.notes && <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--muted)" }}>{dc.notes}</div>}
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
