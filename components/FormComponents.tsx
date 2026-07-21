"use client";

import { useState } from "react";
import { createForm, assignForm, submitFormResponse } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" };
// Same look, but a fixed height — an <input> and a <select> do not share
// an intrinsic height, so identical padding leaves them visibly staggered.
// Not applied to <textarea>, which must stay free to grow.
const inputControl: React.CSSProperties = { ...input, padding: "0 10px", height: 36, boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };
const primary: React.CSSProperties = { background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" };

type Field = { label: string; kind: string };
const KINDS = ["text", "textarea", "yesno", "checkbox", "select"];

export function FormBuilder() {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<Field[]>([{ label: "", kind: "text" }]);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ ...primary, borderRadius: 10, padding: "9px 15px" }}>+ New form</button>;
  const set = (i: number, patch: Partial<Field>) => setFields((fs) => fs.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  const clean = fields.filter((f) => f.label.trim());
  return (
    <form action={createForm} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
      <input type="hidden" name="fields" value={JSON.stringify(clean)} />
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Form name</label><input style={inputControl} name="name" required /></div>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Type</label><select style={inputControl} name="type" defaultValue="intake"><option value="intake">Intake</option><option value="consent">Consent</option></select></div>
      </div>
      {fields.map((f, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8, alignItems: "end" }}>
          <div><label style={lbl}>Question / statement</label><input style={inputControl} value={f.label} onChange={(e) => set(i, { label: e.target.value })} /></div>
          <div><label style={lbl}>Answer type</label><select style={inputControl} value={f.kind} onChange={(e) => set(i, { kind: e.target.value })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
          <button type="button" onClick={() => setFields((fs) => fs.filter((_, idx) => idx !== i))} disabled={fields.length === 1} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "7px 10px", fontSize: 13, cursor: fields.length === 1 ? "not-allowed" : "pointer", color: "var(--muted)" }}>✕</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => setFields((fs) => [...fs, { label: "", kind: "text" }])} style={{ background: "#fff", color: "var(--brand-text)", border: "1px solid var(--brand-fill)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Add field</button>
        <span style={{ flex: 1 }} />
        <button type="submit" style={primary}>Save form</button>
      </div>
    </form>
  );
}

export function AssignForm({ formId, clients }: { formId: string; clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ border: "1px solid var(--brand-fill)", background: "#fff", color: "var(--brand-text)", borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Assign →</button>;
  return (
    <form action={assignForm} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input type="hidden" name="form_id" value={formId} />
      <select name="client_id" required defaultValue="" style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "4px 8px", fontSize: 12, background: "#fff" }}><option value="" disabled>Client…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <button type="submit" style={{ border: "1px solid var(--ink)", background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Assign</button>
      <button type="button" onClick={() => setOpen(false)} style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>✕</button>
    </form>
  );
}

export function FormFill({ responseId, name, type, fields }: { responseId: string; name: string; type: string; fields: Field[] }) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ border: "1px solid var(--brand-fill)", background: "#fff", color: "var(--brand-text)", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Fill</button>;
  const set = (label: string, v: string) => setAnswers((a) => ({ ...a, [label]: v }));
  return (
    <form action={submitFormResponse} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginTop: 8, display: "grid", gap: 10, textAlign: "left" }}>
      <input type="hidden" name="id" value={responseId} />
      <input type="hidden" name="answers" value={JSON.stringify(answers)} />
      <b style={{ fontSize: 14 }}>{name}</b>
      {fields.map((f, i) => (
        <div key={i} style={{ display: "grid", gap: 4 }}>
          <label style={{ fontSize: 13 }}>{f.label}</label>
          {f.kind === "textarea" ? <textarea style={{ ...input, minHeight: 60, resize: "vertical", fontFamily: "inherit" }} onChange={(e) => set(f.label, e.target.value)} />
            : f.kind === "yesno" ? <select style={inputControl} onChange={(e) => set(f.label, e.target.value)} defaultValue=""><option value="" disabled>Select…</option><option>Yes</option><option>No</option></select>
            : f.kind === "checkbox" ? <label style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" onChange={(e) => set(f.label, e.target.checked ? "Agreed" : "")} /> I agree</label>
            : <input style={inputControl} onChange={(e) => set(f.label, e.target.value)} />}
        </div>
      ))}
      {type === "consent" && (
        <div style={{ display: "grid", gap: 4 }}><label style={{ fontSize: 13 }}>Signature (type your full name)</label><input style={inputControl} name="signed_by" required placeholder="Full name" /></div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" style={primary}>Submit</button>
        <button type="button" onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
      </div>
    </form>
  );
}
