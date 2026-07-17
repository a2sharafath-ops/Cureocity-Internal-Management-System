"use client";

import { useState } from "react";

// Shows a masked PHI value; an authorized viewer can reveal the raw value.
// The reveal is logged-worthy in a real system — here it's a UI affordance to
// demonstrate field-level masking.
export default function PhiReveal({ raw, masked }: { raw: string; masked: string }) {
  const [shown, setShown] = useState(false);
  if (!raw || raw === "—") return <span style={{ color: "var(--muted)" }}>—</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontFamily: shown ? "inherit" : "monospace" }}>{shown ? raw : masked}</span>
      <button type="button" onClick={() => setShown((s) => !s)} title={shown ? "Hide" : "Reveal"}
        style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--muted)", padding: 0 }}>
        {shown ? "🙈" : "👁"}
      </button>
    </span>
  );
}
