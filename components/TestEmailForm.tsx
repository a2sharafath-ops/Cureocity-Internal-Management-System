"use client";

import { sendTestEmail } from "@/lib/actions";
import { TEMPLATE_CHOICES } from "@/lib/email/templates";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };

export default function TestEmailForm({ configured }: { configured: boolean }) {
  return (
    <form action={sendTestEmail} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 22, display: "grid", gridTemplateColumns: "1.6fr 1fr 1.4fr auto", gap: 10, alignItems: "end" }}>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Send to</label><input style={input} name="to" type="email" required placeholder="you@example.com" /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Recipient name</label><input style={input} name="name" placeholder="Name" /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Template</label>
        <select style={input} name="template" defaultValue="welcome">{TEMPLATE_CHOICES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
      </div>
      <button type="submit" style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        {configured ? "Send test" : "Log (dry-run)"}
      </button>
    </form>
  );
}
