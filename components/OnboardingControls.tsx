"use client";

import { useState } from "react";
import { addOnboarding, toggleOnboardingStep, removeOnboarding } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };

export function OnboardingForm() {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ New hire</button>;
  return (
    <form action={addOnboarding} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1fr auto", gap: 10, alignItems: "end" }}>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Name</label><input style={input} name="name" required /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Role</label><input style={input} name="role" placeholder="e.g. Fitness Trainer" /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Joining</label><input style={input} name="joining_date" type="date" /></div>
      <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Start</button>
    </form>
  );
}

export function OnboardingCard({ id, name, role, joining, steps, status }: { id: string; name: string; role: string | null; joining: string | null; steps: { label: string; done: boolean }[]; status: string }) {
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <b style={{ fontSize: 15 }}>{name}</b>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>{role ?? ""}{joining ? ` · joins ${joining}` : ""}</span>
        <span style={{ flex: 1 }} />
        <span style={{ background: status === "complete" ? "var(--green-bg)" : "var(--amber-bg)", color: status === "complete" ? "#166534" : "#b45309", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{doneCount}/{steps.length}</span>
        <form action={removeOnboarding}><input type="hidden" name="id" value={id} /><button type="submit" title="Remove" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: 12, cursor: "pointer", color: "var(--muted)" }}>✕</button></form>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {steps.map((s, i) => (
          <form key={i} action={toggleOnboardingStep} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="hidden" name="id" value={id} /><input type="hidden" name="idx" value={i} />
            <button type="submit" style={{ width: 22, height: 22, borderRadius: 6, cursor: "pointer", border: s.done ? "none" : "1px solid var(--border)", background: s.done ? "var(--brand-fill)" : "#fff", color: "#fff", fontSize: 13, lineHeight: 1 }}>{s.done ? "✓" : ""}</button>
            <span style={{ fontSize: 13, textDecoration: s.done ? "line-through" : "none", color: s.done ? "var(--muted)" : "inherit" }}>{s.label}</span>
          </form>
        ))}
      </div>
    </div>
  );
}
