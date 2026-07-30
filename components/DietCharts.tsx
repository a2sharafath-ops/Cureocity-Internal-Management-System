"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { addDietChart, updateDietChart, publishDietChart, deleteDietChart, submitDietChartForReview, reviewDietChart, aiDietDraftStructured } from "@/lib/actions";

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
  // Builder fields are controlled so the "Draft with AI" button can fill them.
  const [bClient, setBClient] = useState(focusClient);
  const [bCal, setBCal] = useState("");
  const [bProtein, setBProtein] = useState("");
  const [bNotes, setBNotes] = useState("");
  const [draftErr, setDraftErr] = useState<string | null>(null);
  const [drafting, startDraft] = useTransition();
  const resetBuilder = () => { setRows(DEFAULT_ROWS); setBCal(""); setBProtein(""); setBNotes(""); setDraftErr(null); };
  const runAiDraft = () => {
    setDraftErr(null);
    if (!bClient) { setDraftErr("Select a client first."); return; }
    startDraft(async () => {
      const r = await aiDietDraftStructured(bClient);
      if (r.error) { setDraftErr(r.error); return; }
      setRows(r.meals && r.meals.length ? r.meals : DEFAULT_ROWS);
      setBCal(r.calories != null ? String(r.calories) : "");
      setBProtein(r.protein ?? "");
      setBNotes(r.notes ?? "");
    });
  };
  // In-place edit of a Draft chart (its own row + meal-row state).
  const [editing, setEditing] = useState<string | null>(null);
  const [editRows, setEditRows] = useState<[string, string][]>([]);
  const startEdit = (dc: DietChartRow) => { setEditing(dc.id); setEditRows(dc.meals.length ? dc.meals : DEFAULT_ROWS); };
  const setEditRow = (i: number, j: 0 | 1, v: string) => setEditRows((r) => r.map((row, k) => (k === i ? (j === 0 ? [v, row[1]] : [row[0], v]) : row)));

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
        <form action={addDietChart} onSubmit={() => setTimeout(() => { setOpen(false); resetBuilder(); }, 50)} style={{ ...box, padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Diet chart builder</div>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={runAiDraft} disabled={drafting || !bClient} style={{ background: "var(--brand-tint)", color: "var(--brand-text)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: drafting || !bClient ? "default" : "pointer", opacity: drafting || !bClient ? 0.6 : 1 }}>{drafting ? "Drafting…" : "✨ Draft with AI"}</button>
          </div>
          <select name="client_id" required value={bClient} onChange={(e) => setBClient(e.target.value)} style={inpControl}>
            <option value="" disabled>Select client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {draftErr && <div style={{ color: "var(--red-text)", fontSize: 12 }}>{draftErr}</div>}
          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Meals {drafting && <span style={{ fontWeight: 400 }}>· generating…</span>}</div>
          {rows.map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "150px 1fr 30px", gap: 8 }}>
              <input name="meal_label" value={row[0]} onChange={(e) => setRow(i, 0, e.target.value)} placeholder="Meal" style={inpControl} />
              <input name="meal_detail" value={row[1]} onChange={(e) => setRow(i, 1, e.target.value)} placeholder="What to eat…" style={inpControl} />
              <button type="button" onClick={() => setRows((r) => r.filter((_, k) => k !== i))} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, cursor: "pointer", color: "var(--red-text)" }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setRows((r) => [...r, ["", ""]])} style={{ alignSelf: "start", border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>+ Add meal row</button>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input name="calories" type="number" value={bCal} onChange={(e) => setBCal(e.target.value)} placeholder="Calories (kcal/day)" style={inpControl} />
            <input name="protein" value={bProtein} onChange={(e) => setBProtein(e.target.value)} placeholder="Protein target (e.g. 72 g)" style={inpControl} />
          </div>
          <textarea name="notes" rows={2} value={bNotes} onChange={(e) => setBNotes(e.target.value)} placeholder="Notes for the client…" style={{ ...inp, resize: "vertical" }} />
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Tip: “Draft with AI” fills the fields from the client’s data — review &amp; edit, then Save as draft and submit for review.</div>
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

              {dc.status === "Draft" && canCompose && (
                <button type="button" onClick={() => (editing === dc.id ? setEditing(null) : startEdit(dc))} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{editing === dc.id ? "Close" : "Edit"}</button>
              )}
              {dc.status === "Draft" && canCompose && (
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
            {editing === dc.id && canCompose && (
              <form action={updateDietChart} onSubmit={() => setTimeout(() => setEditing(null), 50)} style={{ ...box, margin: "0 16px 14px", padding: 12, display: "grid", gap: 8 }}>
                <input type="hidden" name="id" value={dc.id} />
                <div style={{ fontWeight: 700, fontSize: 13 }}>Edit draft — v{dc.version}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Meals</div>
                {editRows.map((row, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "150px 1fr 30px", gap: 8 }}>
                    <input name="meal_label" value={row[0]} onChange={(e) => setEditRow(i, 0, e.target.value)} placeholder="Meal" style={inpControl} />
                    <input name="meal_detail" value={row[1]} onChange={(e) => setEditRow(i, 1, e.target.value)} placeholder="What to eat…" style={inpControl} />
                    <button type="button" onClick={() => setEditRows((r) => r.filter((_, k) => k !== i))} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, cursor: "pointer", color: "var(--red-text)" }}>✕</button>
                  </div>
                ))}
                <button type="button" onClick={() => setEditRows((r) => [...r, ["", ""]])} style={{ alignSelf: "start", border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>+ Add meal row</button>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input name="calories" type="number" defaultValue={dc.calories ?? ""} placeholder="Calories (kcal/day)" style={inpControl} />
                  <input name="protein" defaultValue={dc.protein ?? ""} placeholder="Protein target (e.g. 72 g)" style={inpControl} />
                </div>
                <textarea name="notes" rows={2} defaultValue={dc.notes ?? ""} placeholder="Notes for the client…" style={{ ...inp, resize: "vertical" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ background: "var(--brand-fill)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save changes</button>
                  <button type="button" onClick={() => setEditing(null)} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                </div>
              </form>
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
