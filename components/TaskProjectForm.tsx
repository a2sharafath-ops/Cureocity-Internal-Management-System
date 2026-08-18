"use client";

import { useState } from "react";
import { createTaskProject } from "@/lib/actions";

const input: React.CSSProperties = { padding: "0 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%", height: 36, boxSizing: "border-box" };
const label: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };

export default function TaskProjectForm({ staff }: { staff: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 10, padding: "9px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ New project</button>;
  return (
    <form action={createTaskProject} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
      <div><b>New project</b><div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>Group a campaign, launch, event, or operational initiative.</div></div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 3 }}><span style={label}>Project name</span><input name="name" required maxLength={120} placeholder="e.g. App Launch · 24 Aug" style={input} /></label>
        <label style={{ display: "grid", gap: 3 }}><span style={label}>Owner</span><select name="owner_id" defaultValue="" style={input}><option value="">—</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <label style={{ display: "grid", gap: 3 }}><span style={label}>Start</span><input name="start_date" type="date" style={input} /></label>
        <label style={{ display: "grid", gap: 3 }}><span style={label}>Target date</span><input name="due_date" type="date" style={input} /></label>
        <div style={{ display: "flex", gap: 8 }}><button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Create</button><button type="button" onClick={() => setOpen(false)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "9px 12px", fontSize: 13, cursor: "pointer" }}>Cancel</button></div>
      </div>
      <label style={{ display: "grid", gap: 3 }}><span style={label}>Purpose (optional)</span><input name="description" maxLength={500} placeholder="What this project is intended to deliver" style={input} /></label>
    </form>
  );
}
