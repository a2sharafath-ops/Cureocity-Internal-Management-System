"use client";

// Pause (freeze) or resume a client's packages. Whole-client freeze: banks the
// paused days so the paid term slides forward by exactly the time on hold.

import { togglePackageFreeze } from "@/lib/actions";

export default function FreezeToggle({ clientId, frozen }: { clientId: string; frozen: boolean }) {
  const msg = frozen
    ? "Resume this client's packages? The days on hold have been banked and will extend the term."
    : "Pause / freeze this client's packages? The paused days are banked and pushed onto the end date.";
  return (
    <form action={togglePackageFreeze} onSubmit={(e) => { if (!confirm(msg)) e.preventDefault(); }}>
      <input type="hidden" name="client_id" value={clientId} />
      <button type="submit" style={{
        border: "1px solid var(--border)", background: frozen ? "var(--amber-bg)" : "#fff",
        borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
        color: frozen ? "var(--amber-text)" : "var(--ink)",
      }}>
        {frozen ? "▶ Resume packages" : "⏸ Pause / freeze"}
      </button>
    </form>
  );
}
