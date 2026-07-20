"use client";

import { useState, useTransition } from "react";
import { purchasePackage } from "@/lib/actions";

type Pkg = { id: string; name: string; price: number; is_facility: boolean };

// Purchase an additional package for an existing client. PT / Comprehensive are
// blocked client-side unless a membership is active, and re-checked server-side.
export default function AddPackage({ clientId, packages, hasMembership }: { clientId: string; packages: Pkg[]; hasMembership: boolean }) {
  const [open, setOpen] = useState(false);
  const [pkgId, setPkgId] = useState("");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [discount, setDiscount] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start2] = useTransition();

  const selected = packages.find((p) => p.id === pkgId);
  const needsMembership = selected ? (!selected.is_facility && (selected.id.startsWith("pt") || selected.id.startsWith("comp"))) : false;
  const blocked = needsMembership && !hasMembership;

  const submit = () => {
    setErr(null);
    if (!pkgId) { setErr("Pick a package"); return; }
    if (blocked) { setErr("This client needs an active membership first."); return; }
    const fd = new FormData();
    fd.set("client_id", clientId); fd.set("package_id", pkgId);
    fd.set("start_date", start); fd.set("discount", discount || "0");
    start2(async () => {
      const r = await purchasePackage(fd);
      if (r.ok) { setOpen(false); setPkgId(""); setDiscount(""); }
      else setErr(r.error ?? "Could not add package");
    });
  };

  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "7px 9px", fontSize: 13, background: "#fff" };

  if (!open) {
    return <button onClick={() => setOpen(true)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Add package</button>;
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginTop: 10, background: "#fafafa", width: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <select value={pkgId} onChange={(e) => setPkgId(e.target.value)} style={{ ...inp, minWidth: 200 }}>
          <option value="">Select package…</option>
          <optgroup label="Membership">
            {packages.filter((p) => p.is_facility).map((p) => <option key={p.id} value={p.id}>{p.name} — ₹{p.price.toLocaleString("en-IN")}</option>)}
          </optgroup>
          <optgroup label="Training / Comprehensive / Other">
            {packages.filter((p) => !p.is_facility).map((p) => <option key={p.id} value={p.id}>{p.name} — ₹{p.price.toLocaleString("en-IN")}</option>)}
          </optgroup>
        </select>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>Start <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={inp} /></label>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>Offer ₹ <input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" style={{ ...inp, width: 90 }} /></label>
        <button onClick={submit} disabled={pending || blocked} style={{ background: blocked ? "#cbd5e1" : "var(--brand-fill)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: blocked ? "not-allowed" : "pointer" }}>{pending ? "Adding…" : "Add"}</button>
        <button onClick={() => { setOpen(false); setErr(null); }} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
      </div>
      {blocked && <div style={{ marginTop: 8, fontSize: 12, color: "#92400e", background: "var(--amber-bg)", borderRadius: 8, padding: "7px 10px" }}>⚠ PT & Comprehensive packages require an active membership. Sell a facility membership first.</div>}
      {err && !blocked && <div style={{ marginTop: 8, fontSize: 12, color: "#991b1b" }}>{err}</div>}
    </div>
  );
}
