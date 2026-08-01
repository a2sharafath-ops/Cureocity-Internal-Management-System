"use client";

import { useState } from "react";
import { setAppointmentStatus, rescheduleAppointment } from "@/lib/actions";

const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer" };
const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 6, padding: "2px 6px", fontSize: 11, background: "#fff" };
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am..9pm
const hourLabel = (h: number) => { const am = h < 12; const hr = h % 12 === 0 ? 12 : h % 12; return `${hr}${am ? "am" : "pm"}`; };

// Update or reschedule a booked appointment. Reschedule reveals a date/time
// picker and calls rescheduleAppointment (no cancel-and-rebook needed).
export default function AppointmentActions({ id, status, date, hour, canEdit = true }: { id: string; status: string; date?: string; hour?: number; canEdit?: boolean }) {
  const [open, setOpen] = useState(false);
  const [resch, setResch] = useState(false);
  // Read-only roles (non-editing clinicians) see the calendar but get no
  // status / reschedule / cancel controls.
  if (!canEdit || status !== "scheduled") return null;
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ ...btn, borderColor: "transparent", color: "var(--muted)", padding: "0 4px" }} title="Update">⋯</button>;
  }
  const act = (to: string, label: string, color?: string) => (
    <form action={setAppointmentStatus} onSubmit={() => setOpen(false)}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={to} />
      <button type="submit" style={color ? { ...btn, color } : btn}>{label}</button>
    </form>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {act("completed", "✓ Done", "var(--brand-text)")}
        {act("no_show", "No-show", "var(--amber-text)")}
        {act("cancelled", "Cancel", "var(--red)")}
        <button type="button" onClick={() => setResch((v) => !v)} style={btn}>Reschedule</button>
      </div>
      {resch && (
        <form action={rescheduleAppointment} onSubmit={() => { setResch(false); setOpen(false); }} style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          <input type="hidden" name="id" value={id} />
          <input type="date" name="date" defaultValue={date ?? ""} required style={inp} />
          <select name="hour" defaultValue={String(hour ?? 9)} style={inp}>{HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>
          <button type="submit" style={{ ...btn, background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" }}>Save</button>
        </form>
      )}
    </div>
  );
}
