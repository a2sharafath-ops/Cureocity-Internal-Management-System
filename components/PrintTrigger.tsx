"use client";

import { useEffect } from "react";

// Opens the browser print dialog once, on load, when the page is reached with
// ?auto=1 (from the "Download PDF" button). "Save as PDF" is the destination.
export default function PrintTrigger({ auto }: { auto?: boolean }) {
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 350);
      return () => clearTimeout(t);
    }
  }, [auto]);

  return (
    <button
      onClick={() => window.print()}
      className="no-print"
      style={{ background: "var(--ink, #111)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
    >
      Download / Print PDF
    </button>
  );
}
