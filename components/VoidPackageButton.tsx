"use client";

import { useState, useTransition } from "react";
import { voidClientPackage } from "@/lib/actions";

// Admin / Manager control to void a package added to a client by mistake.
// Two-step (click → Confirm) so it can't be triggered by a stray click; the
// package isn't deleted, just marked void (kept for the audit trail).
export default function VoidPackageButton({ clientId, packageRowId, packageName }: { clientId: string; packageRowId: string; packageName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [mutationKey] = useState(() => crypto.randomUUID());
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const doVoid = () => {
    setErr(null);
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("package_row_id", packageRowId);
    fd.set("mutation_key", mutationKey);
    start(async () => {
      const r = await voidClientPackage(fd);
      if (!r.ok) { setErr(r.error ?? "Could not void"); setConfirming(false); }
    });
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        title={`Remove ${packageName}`}
        style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "var(--red-text)", cursor: "pointer" }}
      >
        Remove
      </button>
    );
  }

  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      {err && <span style={{ fontSize: 11, color: "var(--red-text)" }}>{err}</span>}
      <button
        onClick={doVoid}
        disabled={pending}
        style={{ background: "var(--red-fill, #dc2626)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: pending ? "default" : "pointer" }}
      >
        {pending ? "Removing…" : "Confirm remove"}
      </button>
      <button
        onClick={() => { setConfirming(false); setErr(null); }}
        style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}
      >
        Cancel
      </button>
    </span>
  );
}
