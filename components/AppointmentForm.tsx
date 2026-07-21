"use client";

import { useState } from "react";
import { createAppointment } from "@/lib/actions";

const input: React.CSSProperties = { padding: "0 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" , height: 36, boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am..9pm
function hourLabel(h: number) { const am = h < 12; const hr = h % 12 === 0 ? 12 : h % 12; return `${hr}:00 ${am ? "AM" : "PM"}`; }

export default function AppointmentForm({ clients, staff, defaultDate }: { clients: { id: string; name: string }[]; staff: { id: string; name: string }[]; defaultDate: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Book appointment</button>;
  }
  return (
    <form action={createAppointment} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, alignItems: "end" }}>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Patient</label><select style={input} name="client_id" required defaultValue=""><option value="" disabled>Patient…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Provider</label><select style={input} name="provider_id" defaultValue=""><option value="">— any —</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Type</label><select style={input} name="type" defaultValue="Consultation"><option>Consultation</option><option>Assessment</option><option>Follow-up</option><option>Telehealth</option><option>Procedure</option></select></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Title (optional)</label><input style={input} name="title" placeholder="e.g. Diet review" /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Date</label><input style={input} name="date" type="date" required defaultValue={defaultDate} /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Time</label><select style={input} name="hour" defaultValue="10">{HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Duration</label><select style={input} name="duration_min" defaultValue="30"><option value="15">15 min</option><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option></select></div>
      <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Book</button>
    </form>
  );
}
