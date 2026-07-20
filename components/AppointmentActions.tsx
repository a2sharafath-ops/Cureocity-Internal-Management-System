"use client";

import { useState } from "react";
import { setAppointmentStatus } from "@/lib/actions";

const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer" };

export default function AppointmentActions({ id, status }: { id: string; status: string }) {
  const [open, setOpen] = useState(false);
  if (status !== "scheduled") return null;
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
    <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
      {act("completed", "✓", "var(--brand-text)")}
      {act("no_show", "No-show", "#92400e")}
      {act("cancelled", "Cancel", "var(--red)")}
    </div>
  );
}
