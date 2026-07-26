"use client";

import { useState, useTransition } from "react";
import { scheduleStrengthSessions } from "@/lib/actions";

type Trainer = { id: string; name: string };

// Book the strength-session block for a PT / Comprehensive client: pick a
// trainer, start date and time, and it creates the 12 sessions (every 2 days).
export default function ScheduleSessionsForm({ clientId, trainers, defaultTrainerId, count = 12 }: { clientId: string; trainers: Trainer[]; defaultTrainerId?: string | null; count?: number }) {
  const [open, setOpen] = useState(false);
  const [trainer, setTrainer] = useState(defaultTrainerId && trainers.some((t) => t.id === defaultTrainerId) ? defaultTrainerId : "");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [hour, setHour] = useState("9");
  const [err, setErr] = useState<string | null>(null);
  const [pending, go] = useTransition();

  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "0 9px", fontSize: 13, background: "#fff", height: 34, boxSizing: "border-box" };
  const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);
  const hourLabel = (h: number) => { const am = h < 12; const x = h % 12 === 0 ? 12 : h % 12; return `${x}:00 ${am ? "AM" : "PM"}`; };

  const submit = () => {
    setErr(null);
    if (!trainer) { setErr("Pick a trainer"); return; }
    const fd = new FormData();
    fd.set("client_id", clientId); fd.set("trainer_id", trainer); fd.set("start_date", start); fd.set("hour", hour); fd.set("count", String(count));
    go(async () => {
      const r = await scheduleStrengthSessions(fd);
      if (r.ok) setOpen(false);
      else setErr(r.error ?? "Could not schedule");
    });
  };

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--ink)" }}>Schedule {count} sessions</button>;
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginTop: 10, background: "#fafafa", width: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <select value={trainer} onChange={(e) => setTrainer(e.target.value)} style={{ ...inp, minWidth: 170 }}>
          <option value="">Select trainer…</option>
          {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>From <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={inp} /></label>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>at <select value={hour} onChange={(e) => setHour(e.target.value)} style={inp}>{HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></label>
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{count} sessions, every 2 days</span>
        <button type="button" onClick={submit} disabled={pending} style={{ background: "var(--brand-fill)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: pending ? "default" : "pointer" }}>{pending ? "Scheduling…" : "Schedule"}</button>
        <button type="button" onClick={() => { setOpen(false); setErr(null); }} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
      </div>
      {err && <div style={{ marginTop: 8, fontSize: 12, color: "var(--red-text)" }}>{err}</div>}
    </div>
  );
}
