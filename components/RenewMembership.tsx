"use client";

import { useState, useTransition } from "react";
import { renewPackage } from "@/lib/actions";

type Pkg = { id: string; name: string; price: number; is_facility: boolean };

// The single "Renew" control on a client's card. Renews whichever renewable
// package the client holds (membership / PT / Comprehensive) — the same one or a
// different duration. The new term continues from the current end date,
// server-side. `packages` is pre-filtered to renewable packages by the caller.
export default function RenewMembership({ clientId, packages, currentPackageId }: { clientId: string; packages: Pkg[]; currentPackageId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [pkgId, setPkgId] = useState(currentPackageId && packages.some((m) => m.id === currentPackageId) ? currentPackageId : "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setErr(null);
    if (!pkgId) { setErr("Pick a package"); return; }
    const fd = new FormData();
    fd.set("client_id", clientId); fd.set("package_id", pkgId);
    start(async () => {
      const r = await renewPackage(fd);
      if (r.ok) setOpen(false);
      else setErr(r.error ?? "Could not renew");
    });
  };

  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "0 9px", fontSize: 13, background: "#fff", height: 34, boxSizing: "border-box" };

  if (!open) {
    return <button onClick={() => setOpen(true)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--ink)" }}>↻ Renew</button>;
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginTop: 10, background: "#fafafa", width: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <select value={pkgId} onChange={(e) => setPkgId(e.target.value)} style={{ ...inp, minWidth: 220 }}>
          <option value="">Select package…</option>
          {packages.map((p) => <option key={p.id} value={p.id}>{p.name} — ₹{p.price.toLocaleString("en-IN")}</option>)}
        </select>
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Continues from the current end date.</span>
        <button onClick={submit} disabled={pending} style={{ background: "var(--brand-fill)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: pending ? "default" : "pointer" }}>{pending ? "Renewing…" : "Renew"}</button>
        <button onClick={() => { setOpen(false); setErr(null); }} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
      </div>
      {err && <div style={{ marginTop: 8, fontSize: 12, color: "var(--red-text)" }}>{err}</div>}
    </div>
  );
}
