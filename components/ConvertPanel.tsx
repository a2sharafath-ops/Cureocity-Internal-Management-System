"use client";

import { useRef, useState, useTransition } from "react";
import { sendLeadOtp, convertLeadVerified } from "@/lib/actions";

const money = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");
const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff" };
const lbl: React.CSSProperties = { fontSize: 11, color: "var(--muted)" };

export default function ConvertPanel({
  leadId, phone, packages, clients,
}: {
  leadId: string; phone: string | null;
  packages: { id: string; name: string; price: number }[];
  clients: { id: string; name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const masked = phone ? phone.replace(/\d(?=\d{4})/g, "•") : "";

  const send = () => {
    setMsg(null);
    const fd = new FormData();
    fd.set("phone", phone ?? "");
    start(async () => {
      const r = await sendLeadOtp(fd);
      if (r.ok) { setOtpSent(true); setDevCode(r.devCode ?? null); setMsg({ ok: true, text: `OTP sent to ${masked}` }); }
      else setMsg({ ok: false, text: r.error ?? "Could not send OTP" });
    });
  };

  const convert = () => {
    if (!formRef.current) return;
    setMsg(null);
    const fd = new FormData(formRef.current);
    start(async () => {
      const r = await convertLeadVerified(fd);
      if (r && !r.ok) setMsg({ ok: false, text: r.error ?? "Conversion failed" });
    });
  };

  return (
    <form ref={formRef} onSubmit={(e) => { e.preventDefault(); convert(); }} style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="id" value={leadId} />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <div style={{ display: "grid", gap: 3 }}>
          <label style={lbl}>Package</label>
          <select name="package_id" required defaultValue="" style={{ ...input, minWidth: 260 }}>
            <option value="" disabled>Select a package…</option>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.price)}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Offer / discount (₹)</label><input name="discount" type="number" min={0} defaultValue={0} style={{ ...input, width: 130 }} /></div>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Start date</label><input name="joined" type="date" defaultValue={new Date().toISOString().slice(0, 10)} style={input} /></div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <div style={{ display: "grid", gap: 3 }}>
          <label style={lbl}>Referred by (client)</label>
          <select name="referrer_id" defaultValue="" style={{ ...input, minWidth: 220 }}><option value="">— none —</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Referral code</label><input name="referral_code" style={{ ...input, width: 160 }} placeholder="optional" /></div>
      </div>

      <label style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start" }}><input type="checkbox" name="tnc" style={{ marginTop: 3 }} /> Client agrees to the membership <b>Terms &amp; Conditions</b>.</label>
      <label style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start" }}><input type="checkbox" name="consent" style={{ marginTop: 3 }} /> Client provides <b>informed consent</b> for assessment &amp; treatment.</label>

      {/* OTP */}
      <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        {!otpSent ? (
          <button type="button" onClick={send} disabled={pending || !phone} style={{ border: "1px solid var(--teal)", background: "#fff", color: "var(--teal-dark)", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: pending || !phone ? "not-allowed" : "pointer" }}>{pending ? "Sending…" : `Send OTP to ${masked || "phone"}`}</button>
        ) : (
          <>
            <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Enter OTP</label><input name="otp" inputMode="numeric" required style={{ ...input, width: 120, letterSpacing: 3 }} placeholder="6-digit" /></div>
            <button type="button" onClick={send} disabled={pending} style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer", paddingBottom: 10 }}>Resend</button>
          </>
        )}
        <span style={{ flex: 1 }} />
        <button type="submit" disabled={pending || !otpSent} style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: pending || !otpSent ? "not-allowed" : "pointer", opacity: pending || !otpSent ? 0.6 : 1 }}>Verify &amp; convert →</button>
      </div>

      {devCode && <div style={{ background: "var(--amber-bg)", color: "#92400e", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>SMS provider not configured — read this code to the client: <b style={{ letterSpacing: 2 }}>{devCode}</b></div>}
      {msg && <div style={{ fontSize: 13, color: msg.ok ? "var(--teal-dark)" : "var(--red)" }}>{msg.text}</div>}
    </form>
  );
}
