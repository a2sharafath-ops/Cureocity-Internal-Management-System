"use client";

import { useState } from "react";
import { createTemplate, createCampaign, sendCampaignNow } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };
const primary: React.CSSProperties = { background: "var(--teal)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const ghost: React.CSSProperties = { background: "#fff", color: "var(--teal-dark)", border: "1px solid var(--teal)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const panel: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 14 };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "grid", gap: 3 }}><label style={lbl}>{label}</label>{children}</div>;
}

export function TemplateForm() {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={ghost}>+ New template</button>;
  return (
    <form action={createTemplate} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ ...panel, display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 2fr", gap: 10 }}>
        <Field label="Template name"><input style={input} name="name" required /></Field>
        <Field label="Category"><select style={input} name="category" defaultValue="General"><option>General</option><option>Onboarding</option><option>Retention</option><option>Billing</option><option>Promo</option></select></Field>
        <Field label="Subject"><input style={input} name="subject" required /></Field>
      </div>
      <Field label="Body — HTML allowed; use {{name}} for the recipient's name"><textarea style={{ ...input, minHeight: 90, resize: "vertical", fontFamily: "inherit" }} name="body" required defaultValue="<p>Hi {{name}},</p><p></p>" /></Field>
      <div><button type="submit" style={primary}>Save template</button></div>
    </form>
  );
}

export function CampaignForm({ templates }: { templates: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ ...primary, borderRadius: 10, padding: "9px 15px" }}>+ New campaign</button>;
  return (
    <form action={createCampaign} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ ...panel, display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1.2fr auto", gap: 10, alignItems: "end" }}>
      <Field label="Campaign name"><input style={input} name="name" required /></Field>
      <Field label="Template"><select style={input} name="template_id" required defaultValue=""><option value="" disabled>Template…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
      <Field label="Audience"><select style={input} name="audience" defaultValue="all"><option value="all">All clients</option><option value="members">Members (has package)</option><option value="subscribers">Active subscribers</option><option value="lapsed">Lapsed (no visit 30d)</option></select></Field>
      <button type="submit" style={primary}>Create</button>
    </form>
  );
}

export function SendCampaign({ id, configured }: { id: string; configured: boolean }) {
  return (
    <form action={sendCampaignNow}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" style={{ border: "1px solid var(--teal)", background: configured ? "var(--teal)" : "#fff", color: configured ? "#fff" : "var(--teal-dark)", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
        {configured ? "Send now" : "Send (dry-run)"}
      </button>
    </form>
  );
}
