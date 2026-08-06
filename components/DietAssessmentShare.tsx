"use client";

import { useState, useTransition } from "react";
import { shareDietAssessment } from "@/lib/actions";

/**
 * Deliver a published dietary assessment summary to the client's portal, or
 * take it back out. Mirrors DietPlanShare.tsx — sharing is a document-scoped
 * action (only one field, `id`), kept separate from publishing for the same
 * reason: publishing is the clinical decision, sharing is the delivery one.
 */
export default function DietAssessmentShare({ assessmentId, sharedAt }: { assessmentId: string; sharedAt: string | null }) {
  const [shared, setShared] = useState<string | null>(sharedAt);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const go = (undo: boolean) => {
    setErr(null);
    start(async () => {
      const fd = new FormData();
      fd.set("id", assessmentId);
      if (undo) fd.set("undo", "true");
      const r = await shareDietAssessment(fd);
      if (r.error) { setErr(r.error); return; }
      setShared(undo ? null : new Date().toISOString());
    });
  };

  const when = shared
    ? new Date(shared).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })
    : null;

  return (
    <div>
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
          {busy ? "Sharing…" : "Share to portal"}
        </button>
      )}
      {err && <div style={{ fontSize: 11.5, color: "var(--red-text)", marginTop: 4 }}>{err}</div>}
    </div>
  );
}
