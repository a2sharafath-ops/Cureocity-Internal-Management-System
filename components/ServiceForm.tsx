"use client";

import { useState } from "react";
import { addService } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };

export default function ServiceForm() {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ New service</button>;
  return (
    <form action={addService} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "1.8fr 1.4fr 1fr 0.9fr auto auto", gap: 10, alignItems: "end" }}>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Service name</label><input style={input} name="name" required /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Category</label>
        <input style={input} name="category" list="svc-cats" defaultValue="General" />
        <datalist id="svc-cats"><option value="Doctor Consultation" /><option value="Diet Consultation" /><option value="Fitness Services" /><option value="Assessment" /></datalist>
      </div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Mode</label><select style={input} name="mode" defaultValue="Offline"><option>Offline</option><option>Online</option></select></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Day offset</label><input style={input} name="day_offset" type="number" placeholder="—" /></div>
      <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" name="slot_based" /> Slot</label>
      <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
    </form>
  );
}
