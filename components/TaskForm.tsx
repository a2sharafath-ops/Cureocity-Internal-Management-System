"use client";

import { useState } from "react";
import { addTask } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };

export default function TaskForm({ staff, clients }: { staff: { id: string; name: string }[]; clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ New task</button>;
  return (
    <form action={addTask} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Title</label><input style={input} name="title" required placeholder="e.g. Prepare Initial Diet Chart" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.3fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Assignee</label><select style={input} name="assignee_id" defaultValue=""><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Client (optional)</label><select style={input} name="client_id" defaultValue=""><option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Type</label><select style={input} name="type" defaultValue="Ops"><option>Ops</option><option>Diet Chart</option><option>PHB Review</option><option>Training Plan</option><option>Follow-up</option></select></div>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Priority</label><select style={input} name="priority" defaultValue="Medium"><option>High</option><option>Medium</option><option>Low</option></select></div>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Due</label><input style={input} name="due_date" type="date" /></div>
        <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
      </div>
    </form>
  );
}
