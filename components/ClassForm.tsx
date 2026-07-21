"use client";

import { useState } from "react";
import { createClass } from "@/lib/actions";

const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const input: React.CSSProperties = { width: "100%", padding: "0 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "#fff" , height: 36, boxSizing: "border-box" };

export default function ClassForm({
  rooms, trainers,
}: { rooms: { id: string; name: string; capacity: number }[]; trainers: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        + New class
      </button>
    );
  }
  return (
    <form action={createClass} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr", gap: 10, alignItems: "end" }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>Class title</label>
          <input style={input} name="title" placeholder="e.g. Morning HIIT" required />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>Room</label>
          <select style={input} name="room_id" required defaultValue="">
            <option value="" disabled>Room…</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} (cap {r.capacity})</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>Trainer</label>
          <select style={input} name="trainer_id" defaultValue={trainers[0]?.id ?? ""}>
            {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>Date</label>
          <input style={input} type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>Time</label>
          <select style={input} name="hour" defaultValue="9">
            {HOURS.map((h) => { const am = h < 12; const hr = h % 12 === 0 ? 12 : h % 12; return <option key={h} value={h}>{`${hr}:00 ${am ? "AM" : "PM"}`}</option>; })}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "end", marginTop: 10 }}>
        <div style={{ width: 120 }}>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>Capacity</label>
          <input style={input} type="number" name="capacity" defaultValue={12} min={1} />
        </div>
        <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Create class</button>
        <button type="button" onClick={() => setOpen(false)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
      </div>
    </form>
  );
}
