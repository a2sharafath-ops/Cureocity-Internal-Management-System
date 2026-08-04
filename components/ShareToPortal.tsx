"use client";

import { useState, useTransition } from "react";
import { shareRxToPortal, shareLabToPortal } from "@/lib/actions";

/**
 * Deliver a prescription or lab requisition to the client's portal.
 *
 * Shows state rather than just an action: once shared, the button becomes a
 * plain statement of fact with a quiet way to withdraw. A clinician needs to
 * know at a glance whether the patient can already see this — that question
 * used to have no answer anywhere in the UI.
 */
export default function ShareToPortal({
  kind, id, sharedAt, label,
}: {
  kind: "rx" | "lab";
  /** prescription id, or the consultation id for a lab requisition */
  id: string;
  sharedAt: string | null;
  label: string;
}) {
  const [shared, setShared] = useState<string | null>(sharedAt);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const go = (undo: boolean) => {
    setErr(null);
    start(async () => {
      const fd = new FormData();
      if (kind === "rx") fd.set("id", id); else fd.set("consultation_id", id);
      if (undo) fd.set("undo", "true");
      const r = await (kind === "rx" ? shareRxToPortal(fd) : shareLabToPortal(fd));
      if (r.error) { setErr(r.error); return; }
      setShared(undo ? null : new Date().toISOString());
    });
  };

  const when = shared
    ? new Date(shared).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })
    : null;

  return (
    <div style={{ marginTop: 8 }}>
      {shared ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: "var(--green-text)", fontWeight: 600 }}>
            In client portal · shared {when}
          </span>
          <button type="button" onClick={() => go(true)} disabled={busy}
            style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 11, cursor: busy ? "default" : "pointer", textDecoration: "underline" }}>
            {busy ? "…" : "Withdraw"}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => go(false)} disabled={busy}
          style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>
          {busy ? "Sharing…" : label}
        </button>
      )}
      {err && <div style={{ fontSize: 11.5, color: "var(--red-text)", marginTop: 4 }}>{err}</div>}
    </div>
  );
}
