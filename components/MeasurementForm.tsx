"use client";

import { useState } from "react";
import { addMeasurement } from "@/lib/actions";

const FIELDS: { name: string; label: string; step?: string }[] = [
  { name: "weight", label: "Weight (kg)", step: "0.1" },
  { name: "bmi", label: "BMI", step: "0.1" },
  { name: "body_fat", label: "Body fat (%)", step: "0.1" },
  { name: "muscle_mass", label: "Muscle mass (kg)", step: "0.1" },
  { name: "visceral_fat", label: "Visceral fat", step: "0.1" },
  { name: "waist", label: "Waist (cm)", step: "0.1" },
  { name: "hip", label: "Hip (cm)", step: "0.1" },
  { name: "resting_hr", label: "Resting HR (bpm)" },
];

const input: React.CSSProperties = { width: "100%", padding: "7px 9px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff" };

export default function MeasurementForm({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 13, cursor: "pointer" }}>
        + Add measurement
      </button>
    );
  }
  return (
    <form action={addMeasurement} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "#f8fbfa", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
      <input type="hidden" name="client_id" value={clientId} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>Date</label>
          <input style={input} type="date" name="date" defaultValue={new Date().toISOString().slice(0,10)} />
        </div>
        {FIELDS.map((f) => (
          <div key={f.name}>
            <label style={{ fontSize: 11, color: "var(--muted)" }}>{f.label}</label>
            <input style={input} type="number" step={f.step} name={f.name} />
          </div>
        ))}
      </div>
      <input style={{ ...input, marginTop: 10 }} name="notes" placeholder="Notes (optional)" />
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button type="submit" style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save measurement</button>
        <button type="button" onClick={() => setOpen(false)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
      </div>
    </form>
  );
}
