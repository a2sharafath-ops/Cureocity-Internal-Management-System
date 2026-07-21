"use client";

import { useState } from "react";
import { addConsent, addBreach, addRetentionPolicy, revokeConsent, setBreachStatus } from "@/lib/actions";

const input: React.CSSProperties = { padding: "0 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" , height: 36, boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };
const primary: React.CSSProperties = { background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const ghost: React.CSSProperties = { background: "#fff", color: "var(--brand-text)", border: "1px solid var(--brand-fill)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const panel: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 14 };
const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 12, cursor: "pointer" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "grid", gap: 3 }}><label style={lbl}>{label}</label>{children}</div>;
}

export function ConsentForm({ clients }: { clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={ghost}>+ Record consent</button>;
  return (
    <form action={addConsent} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ ...panel, display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
      <Field label="Patient"><select style={input} name="client_id" required defaultValue=""><option value="" disabled>Patient…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Consent type"><select style={input} name="type" defaultValue="treatment"><option value="treatment">Treatment</option><option value="data-sharing">Data sharing</option><option value="telehealth">Telehealth</option><option value="marketing">Marketing</option><option value="research">Research</option></select></Field>
      <Field label="Method"><select style={input} name="method" defaultValue="signed"><option value="signed">Signed</option><option value="digital">Digital</option><option value="verbal">Verbal</option></select></Field>
      <Field label="Expires"><input style={input} name="expires_date" type="date" /></Field>
      <button type="submit" style={primary}>Save</button>
    </form>
  );
}

export function BreachForm() {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ ...ghost, borderColor: "#fca5a5", color: "var(--red)" }}>+ Log incident</button>;
  return (
    <form action={addBreach} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ ...panel, display: "grid", gridTemplateColumns: "1.6fr 1fr 0.8fr 1fr auto", gap: 10, alignItems: "end" }}>
      <Field label="Title"><input style={input} name="title" required placeholder="e.g. Misdirected report email" /></Field>
      <Field label="Severity"><select style={input} name="severity" defaultValue="medium"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></Field>
      <Field label="Affected"><input style={input} name="affected_count" type="number" min={0} defaultValue={0} /></Field>
      <Field label="Discovered"><input style={input} name="discovered_date" type="date" /></Field>
      <button type="submit" style={primary}>Log</button>
    </form>
  );
}

export function RetentionForm() {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={ghost}>+ Add policy</button>;
  return (
    <form action={addRetentionPolicy} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ ...panel, display: "grid", gridTemplateColumns: "1.6fr 0.8fr 1.6fr 1fr auto", gap: 10, alignItems: "end" }}>
      <Field label="Data type"><input style={input} name="data_type" required /></Field>
      <Field label="Retain (yrs)"><input style={input} name="retain_years" type="number" min={0} defaultValue={7} /></Field>
      <Field label="Legal basis"><input style={input} name="legal_basis" /></Field>
      <Field label="Then"><select style={input} name="action_after" defaultValue="archive"><option value="archive">Archive</option><option value="anonymize">Anonymize</option><option value="delete">Delete</option></select></Field>
      <button type="submit" style={primary}>Add</button>
    </form>
  );
}

export function ConsentRevoke({ id }: { id: string }) {
  return (
    <form action={revokeConsent}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" style={{ ...btn, color: "var(--red)" }}>Revoke</button>
    </form>
  );
}

export function BreachActions({ id, status, reported }: { id: string; status: string; reported: boolean }) {
  const next: Record<string, string> = { open: "investigating", investigating: "contained", contained: "closed" };
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
      {next[status] && (
        <form action={setBreachStatus}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={next[status]} />
          <button type="submit" style={btn}>→ {next[status]}</button>
        </form>
      )}
      {!reported && (
        <form action={setBreachStatus}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} /><input type="hidden" name="report" value="1" />
          <button type="submit" style={{ ...btn, borderColor: "#fca5a5", color: "var(--red)" }}>Report to authority</button>
        </form>
      )}
    </div>
  );
}
