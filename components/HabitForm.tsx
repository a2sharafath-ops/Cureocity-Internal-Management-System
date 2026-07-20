"use client";

import { useState } from "react";
import { createHabit } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };

export default function HabitForm({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ background: "#fff", color: "var(--brand-text)", border: "1px solid var(--brand-fill)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Assign habit</button>;
  }
  return (
    <form action={createHabit} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ display: "grid", gridTemplateColumns: "0.5fr 2fr 1fr 1fr auto", gap: 8, alignItems: "end", marginTop: 10 }}>
      <input type="hidden" name="client_id" value={clientId} />
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Icon</label><input style={input} name="icon" defaultValue="✅" maxLength={2} /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Habit</label><input style={input} name="name" required placeholder="e.g. 10k steps" /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Cadence</label><select style={input} name="cadence" defaultValue="daily"><option value="daily">Daily</option><option value="weekly">Weekly</option></select></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Target/wk</label><input style={input} name="target_per_week" type="number" min={1} max={7} defaultValue={7} /></div>
      <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
    </form>
  );
}
