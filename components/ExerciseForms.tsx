"use client";

import { useState } from "react";
import { addExercise, addTemplate } from "@/lib/actions";

const input: React.CSSProperties = { padding: "7px 9px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };
const primary: React.CSSProperties = { background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" };

export function ExerciseForm() {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ ...primary, borderRadius: 10, padding: "9px 15px" }}>+ Add exercise</button>;
  return (
    <form action={addExercise} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Exercise name</label><input style={input} name="name" required /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Mode</label><select style={input} name="mode" defaultValue="Offline"><option>Offline</option><option>Online</option></select></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Type</label><select style={input} name="type" defaultValue="Strength"><option>Strength</option><option>Cardio</option><option>Mobility</option></select></div>
      <button type="submit" style={primary}>Add</button>
    </form>
  );
}

type Line = { exercise: string; sets: string; reps: string; rest: string };
const blank = (): Line => ({ exercise: "", sets: "3", reps: "12", rest: "60s" });

export function TemplateForm({ exercises }: { exercises: string[] }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([blank()]);

  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ background: "#fff", color: "var(--teal-dark)", border: "1px solid var(--teal)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Create template</button>;

  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const items = lines.filter((l) => l.exercise.trim());

  return (
    <form action={addTemplate} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Template name</label><input style={input} name="name" required /></div>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Mode</label><select style={input} name="mode" defaultValue="Offline"><option>Offline</option><option>Online</option></select></div>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Type</label><select style={input} name="type" defaultValue="Strength"><option>Strength</option><option>Cardio</option><option>Mobility</option></select></div>
      </div>
      {lines.map((l, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 0.7fr 0.9fr 0.9fr auto", gap: 8, alignItems: "end" }}>
          <div><label style={lbl}>Exercise</label><input style={input} list="ex-list" value={l.exercise} onChange={(e) => set(i, { exercise: e.target.value })} /></div>
          <div><label style={lbl}>Sets</label><input style={input} value={l.sets} onChange={(e) => set(i, { sets: e.target.value })} /></div>
          <div><label style={lbl}>Reps</label><input style={input} value={l.reps} onChange={(e) => set(i, { reps: e.target.value })} /></div>
          <div><label style={lbl}>Rest</label><input style={input} value={l.rest} onChange={(e) => set(i, { rest: e.target.value })} /></div>
          <button type="button" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} disabled={lines.length === 1} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "7px 10px", fontSize: 13, cursor: lines.length === 1 ? "not-allowed" : "pointer", color: "var(--muted)" }}>✕</button>
        </div>
      ))}
      <datalist id="ex-list">{exercises.map((e) => <option key={e} value={e} />)}</datalist>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => setLines((ls) => [...ls, blank()])} style={{ background: "#fff", color: "var(--teal-dark)", border: "1px solid var(--teal)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Add exercise</button>
        <span style={{ flex: 1 }} />
        <button type="submit" style={primary}>Save template</button>
      </div>
    </form>
  );
}
