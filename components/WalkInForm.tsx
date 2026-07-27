"use client";

import { useState } from "react";
import { createLead } from "@/lib/actions";

// Fast front-desk walk-in capture: name, phone, location only. Writes straight
// to leads (source "Walk-in") via the shared createLead action, so it gets an
// owner, a first-response task, a score and the new-lead notification like any
// other lead.
export default function WalkInForm() {
  const [open, setOpen] = useState(false);
  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff", height: 36, boxSizing: "border-box" };

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--ink)" }}>Walk-in</button>;
  }

  return (
    <form action={createLead} onSubmit={() => setTimeout(() => setOpen(false), 50)}
      style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow)", padding: 10 }}>
      <input type="hidden" name="source" value="Walk-in" />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", paddingLeft: 4 }}>Walk-in</span>
      <input name="name" placeholder="Name" required style={{ ...inp, width: 170 }} />
      <input name="phone" placeholder="Phone" inputMode="tel" style={{ ...inp, width: 150 }} />
      <input name="location" placeholder="Location" style={{ ...inp, width: 170 }} />
      <button type="submit" style={{ background: "var(--brand-fill)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
      <button type="button" onClick={() => setOpen(false)} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
    </form>
  );
}
