"use client";

import { useState } from "react";
import { setStaffBadge } from "@/lib/actions";

// Issue / show a staff member's attendance badge (QR) + PIN for the kiosk.
export default function BadgeIssuer({ staffId, badge, pin }: { staffId: string; badge: string | null; pin: string | null }) {
  const [b, setB] = useState(badge);
  const [p, setP] = useState(pin);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const issue = async () => {
    setBusy(true); setErr(null);
    const fd = new FormData(); fd.set("staff_id", staffId);
    const r = await setStaffBadge(fd);
    setBusy(false);
    if (r.error) setErr(r.error); else { setB(r.badge ?? null); setP(r.pin ?? null); }
  };

  const qr = b ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(b)}` : null;
  const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, cursor: busy ? "default" : "pointer" };

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}><b>Attendance badge &amp; PIN</b><span style={{ flex: 1 }} /><span style={{ fontSize: 11, color: "var(--muted)" }}>used at the kiosk</span></div>
      {b ? (
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          {qr && <img src={qr} alt="badge QR" width={120} height={120} style={{ border: "1px solid var(--border)", borderRadius: 8, background: "#fff" }} />}
          <div style={{ fontSize: 13 }}>
            <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".3px" }}>Badge code</div>
            <div style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", marginBottom: 8 }}>{b}</div>
            <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".3px" }}>PIN (manual identify)</div>
            <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: 3 }}>{p}</div>
          </div>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={issue} disabled={busy} style={btn}>{busy ? "…" : "Regenerate"}</button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>No badge yet — issue a QR badge + PIN so this staff can punch at the kiosk.</span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={issue} disabled={busy} style={{ ...btn, background: "var(--ink)", color: "#fff", border: "none" }}>{busy ? "…" : "Issue badge & PIN"}</button>
        </div>
      )}
      {err && <div style={{ color: "var(--red-text)", fontSize: 12, marginTop: 8 }}>{err}</div>}
    </div>
  );
}
