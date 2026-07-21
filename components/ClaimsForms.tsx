"use client";

import { useState } from "react";
import { addInsurer, addPolicy, createClaim } from "@/lib/actions";

const input: React.CSSProperties = { padding: "0 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" , height: 36, boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };
const primary: React.CSSProperties = { background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const ghost: React.CSSProperties = { background: "#fff", color: "var(--brand-text)", border: "1px solid var(--brand-fill)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const panel: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 14 };

type Client = { id: string; name: string };
type Insurer = { id: string; name: string };
type Policy = { id: string; label: string };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "grid", gap: 3 }}><label style={lbl}>{label}</label>{children}</div>;
}

export function InsurerForm() {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={ghost}>+ Add insurer</button>;
  return (
    <form action={addInsurer} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ ...panel, display: "grid", gridTemplateColumns: "1.6fr 1fr 1.6fr auto", gap: 10, alignItems: "end" }}>
      <Field label="Insurer name"><input style={input} name="name" required /></Field>
      <Field label="Type"><select style={input} name="kind" defaultValue="private"><option value="private">Private</option><option value="govt">Government</option><option value="tpa">TPA</option></select></Field>
      <Field label="Contact"><input style={input} name="contact" placeholder="email / phone" /></Field>
      <button type="submit" style={primary}>Add</button>
    </form>
  );
}

export function PolicyForm({ clients, insurers }: { clients: Client[]; insurers: Insurer[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={ghost}>+ Add policy</button>;
  return (
    <form action={addPolicy} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ ...panel, display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
      <Field label="Patient"><select style={input} name="client_id" required defaultValue=""><option value="" disabled>Patient…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Insurer"><select style={input} name="insurer_id" defaultValue=""><option value="">—</option>{insurers.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
      <Field label="Policy #"><input style={input} name="policy_number" /></Field>
      <Field label="Coverage ₹"><input style={input} name="coverage_amount" type="number" min={0} /></Field>
      <Field label="Valid to"><input style={input} name="valid_to" type="date" /></Field>
      <button type="submit" style={primary}>Add</button>
    </form>
  );
}

export function ClaimForm({ clients, policies }: { clients: Client[]; policies: Record<string, Policy[]> }) {
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState("");
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ ...primary, borderRadius: 10, padding: "9px 15px" }}>+ New claim</button>;
  const clientPolicies = policies[client] ?? [];
  return (
    <form action={createClaim} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ ...panel, display: "grid", gridTemplateColumns: "1.3fr 1.5fr 2fr 1fr auto", gap: 10, alignItems: "end" }}>
      <Field label="Patient"><select style={input} name="client_id" required value={client} onChange={(e) => setClient(e.target.value)}><option value="" disabled>Patient…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Policy"><select style={input} name="policy_id" defaultValue=""><option value="">— (no policy)</option>{clientPolicies.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
      <Field label="Service / procedure"><input style={input} name="service_desc" placeholder="e.g. Consultation + labs" /></Field>
      <Field label="Amount ₹"><input style={input} name="amount_claimed" type="number" min={0} required /></Field>
      <button type="submit" style={primary}>Create</button>
    </form>
  );
}
