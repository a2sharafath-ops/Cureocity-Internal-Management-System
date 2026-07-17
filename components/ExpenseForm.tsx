"use client";

import { useState } from "react";
import { addExpense } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };

export default function ExpenseForm() {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add expense</button>;
  return (
    <form action={addExpense} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Description</label><input style={input} name="description" required /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Category</label>
        <select style={input} name="category" defaultValue="Other"><option>Rent</option><option>Equipment</option><option>Software</option><option>Marketing</option><option>Utilities</option><option>Salaries</option><option>Other</option></select>
      </div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Amount (₹)</label><input style={input} name="amount" type="number" min={0} required /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Date</label><input style={input} name="date" type="date" /></div>
      <button type="submit" style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
    </form>
  );
}
