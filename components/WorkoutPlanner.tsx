"use client";
import { IST } from "@/lib/datetime";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { addWorkoutPlan, publishWorkoutPlan, deleteWorkoutPlan } from "@/lib/actions";

export type WorkoutItem = { exercise: string; sets?: string; reps?: string; rest?: string };
export type WorkoutPlanRow = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  name: string;
  type: string | null;
  mode: string | null;
  version: number | null;
  status: string;
  notes: string | null;
  items: WorkoutItem[];
  by_name: string | null;
  created_at: string;
};

type Row = { exercise: string; sets: string; reps: string; rest: string };
const DEFAULT_ROWS: Row[] = [
  { exercise: "", sets: "3", reps: "12", rest: "60s" },
  { exercise: "", sets: "3", reps: "12", rest: "60s" },
  { exercise: "", sets: "3", reps: "12", rest: "60s" },
];

export default function WorkoutPlanner({ plans, clients }: { plans: WorkoutPlanRow[]; clients: { id: string; name: string }[] }) {
  // Deep-linked from a "workout plan not created" reminder: ?client=<id> opens
  // the builder straight away with that client pre-selected.
  const focusClient = useSearchParams().get("client") ?? "";
  const [open, setOpen] = useState(Boolean(focusClient));
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS);
  const [expanded, setExpanded] = useState<string | null>(null);

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff" };
  const inpControl: React.CSSProperties = { ...inp, padding: "0 10px", height: 36, boxSizing: "border-box" };
  const setRow = (i: number, key: keyof Row, v: string) => setRows((r) => r.map((row, k) => (k === i ? { ...row, [key]: v } : row)));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Compose a workout exercise-by-exercise, save as draft, then publish to the client&apos;s portal.</div>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{open ? "Cancel" : "+ New workout plan"}</button>
      </div>

      {open && (
        <form action={addWorkoutPlan} onSubmit={() => setTimeout(() => { setOpen(false); setRows(DEFAULT_ROWS); }, 50)} style={{ ...box, padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 700 }}>Workout plan builder</div>
          <select name="client_id" required defaultValue={focusClient} style={inpControl}>
            <option value="" disabled>Select client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 10 }}>
            <input name="name" placeholder="Plan name (e.g. Upper Body A)" style={inpControl} />
            <select name="type" defaultValue="Strength" style={inpControl}>
              <option>Strength</option><option>Cardio</option><option>Mobility</option>
            </select>
            <select name="mode" defaultValue="Offline" style={inpControl}>
              <option>Offline</option><option>Online</option>
            </select>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Exercises</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 62px 62px 72px 30px", gap: 8, fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
            <span>Exercise</span><span>Sets</span><span>Reps</span><span>Rest</span><span />
          </div>
          {rows.map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 62px 62px 72px 30px", gap: 8 }}>
              <input name="ex_name" value={row.exercise} onChange={(e) => setRow(i, "exercise", e.target.value)} placeholder="e.g. Back Squat" style={inpControl} />
              <input name="ex_sets" value={row.sets} onChange={(e) => setRow(i, "sets", e.target.value)} placeholder="3" style={inpControl} />
              <input name="ex_reps" value={row.reps} onChange={(e) => setRow(i, "reps", e.target.value)} placeholder="12" style={inpControl} />
              <input name="ex_rest" value={row.rest} onChange={(e) => setRow(i, "rest", e.target.value)} placeholder="60s" style={inpControl} />
              <button type="button" onClick={() => setRows((r) => r.filter((_, k) => k !== i))} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, cursor: "pointer", color: "var(--red-text)" }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setRows((r) => [...r, { exercise: "", sets: "3", reps: "12", rest: "60s" }])} style={{ alignSelf: "start", border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>+ Add exercise</button>
          <textarea name="notes" rows={2} placeholder="Notes for the client…" style={{ ...inp, resize: "vertical" }} />
          <div><button style={{ background: "var(--brand-fill)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save as draft</button></div>
        </form>
      )}

      <div style={{ ...box, overflow: "hidden" }}>
        {plans.length ? plans.map((w) => (
          <div key={w.id} style={{ borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 13 }}>{w.client_name ?? "—"} <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {w.name}{w.version ? ` · v${w.version}` : ""}</span></b>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>{w.type ?? "Strength"}{w.mode ? ` · ${w.mode}` : ""} · {w.items.length} exercise{w.items.length === 1 ? "" : "s"} · {new Date(w.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: IST })}</div>
              </div>
              <span style={{ background: w.status === "Published" ? "var(--green-bg)" : "var(--amber-bg)", color: w.status === "Published" ? "var(--green-text)" : "var(--amber-text)", borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600 }}>{w.status}</span>
              <button type="button" onClick={() => setExpanded((e) => (e === w.id ? null : w.id))} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{expanded === w.id ? "Hide" : "View"}</button>
              {w.status === "Draft" && (
                <form action={publishWorkoutPlan}><input type="hidden" name="id" value={w.id} /><button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Publish</button></form>
              )}
              <form action={deleteWorkoutPlan}><input type="hidden" name="id" value={w.id} /><button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 9px", fontSize: 12, cursor: "pointer", color: "var(--red-text)" }} title="Delete">✕</button></form>
            </div>
            {expanded === w.id && (
              <div style={{ padding: "0 16px 14px 16px" }}>
                <div style={{ background: "var(--bg)", borderRadius: 10, padding: "8px 12px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 70px", gap: 10, fontSize: 11, color: "var(--muted)", fontWeight: 600, paddingBottom: 4 }}>
                    <span>Exercise</span><span>Sets</span><span>Reps</span><span>Rest</span>
                  </div>
                  {w.items.map((it, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 70px", gap: 10, padding: "5px 0", fontSize: 13, borderTop: "1px solid var(--border)" }}>
                      <div style={{ fontWeight: 600 }}>{it.exercise}</div>
                      <div>{it.sets || "—"}</div>
                      <div>{it.reps || "—"}</div>
                      <div>{it.rest || "—"}</div>
                    </div>
                  ))}
                  {w.notes && <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--muted)" }}>{w.notes}</div>}
                  {w.client_id && <div style={{ marginTop: 8 }}><Link href={`/clients/${w.client_id}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontSize: 12.5, fontWeight: 600 }}>Open client card →</Link></div>}
                </div>
              </div>
            )}
          </div>
        )) : <div style={{ padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No workout plans yet.</div>}
      </div>
    </div>
  );
}
