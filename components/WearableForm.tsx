"use client";

import { useState } from "react";
import { addWearableReading, setWearableConnection } from "@/lib/actions";

const input: React.CSSProperties = { padding: "7px 9px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };

const PROVIDERS: { key: string; label: string }[] = [
  { key: "apple", label: "Apple Health" },
  { key: "google", label: "Google Fit" },
  { key: "fitbit", label: "Fitbit" },
  { key: "garmin", label: "Garmin" },
];

export function WearableForm({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ background: "#fff", color: "var(--brand-text)", border: "1px solid var(--brand-fill)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Add reading</button>;
  }
  return (
    <form action={addWearableReading} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr) auto", gap: 8, alignItems: "end", marginTop: 10 }}>
      <input type="hidden" name="client_id" value={clientId} />
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Date</label><input style={input} name="date" type="date" /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Steps</label><input style={input} name="steps" type="number" min={0} /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Sleep (min)</label><input style={input} name="sleep_min" type="number" min={0} /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Rest HR</label><input style={input} name="resting_hr" type="number" min={0} /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Active (min)</label><input style={input} name="active_min" type="number" min={0} /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Calories</label><input style={input} name="calories" type="number" min={0} /></div>
      <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
    </form>
  );
}

export function WearableConnect({ clientId, connected }: { clientId: string; connected: Record<string, string> }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
      {PROVIDERS.map((p) => {
        const isOn = connected[p.key] === "connected";
        return (
          <form key={p.key} action={setWearableConnection}>
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="provider" value={p.key} />
            <input type="hidden" name="status" value={isOn ? "disconnected" : "connected"} />
            <button type="submit" style={{
              border: `1px solid ${isOn ? "var(--brand-fill)" : "var(--border)"}`,
              background: isOn ? "#e0f2f1" : "#fff",
              color: isOn ? "var(--brand-text)" : "var(--muted)",
              borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
              {isOn ? "● " : "○ "}{p.label}
            </button>
          </form>
        );
      })}
    </div>
  );
}
