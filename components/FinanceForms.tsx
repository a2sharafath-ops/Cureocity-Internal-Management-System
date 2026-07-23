"use client";

import { useState } from "react";
import { addPayable, addEstimate, addLedgerEntry, submitReimbursement, setPettyFloat } from "@/lib/actions";

const input: React.CSSProperties = { padding: "0 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" , height: 36, boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };
const primary: React.CSSProperties = { background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const panel: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 16 };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "grid", gap: 3 }}><label style={lbl}>{label}</label>{children}</div>;
}

export function PayableForm() {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ ...primary, borderRadius: 10, padding: "9px 15px" }}>+ Add payable</button>;
  return (
    <form action={addPayable} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ ...panel, display: "grid", gridTemplateColumns: "1.4fr 1.6fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
      <Field label="Vendor"><input style={input} name="vendor" required /></Field>
      <Field label="Item"><input style={input} name="item" /></Field>
      <Field label="Amount (₹)"><input style={input} name="amount" type="number" min={0} required /></Field>
      <Field label="Due"><input style={input} name="due_date" type="date" /></Field>
      <button type="submit" style={primary}>Add</button>
    </form>
  );
}

export function EstimateForm() {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ ...primary, borderRadius: 10, padding: "9px 15px" }}>+ New estimate</button>;
  return (
    <form action={addEstimate} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ ...panel, display: "grid", gridTemplateColumns: "1.4fr 1.6fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
      <Field label="Prospect"><input style={input} name="lead_name" required /></Field>
      <Field label="Item / package"><input style={input} name="item" /></Field>
      <Field label="Amount (₹)"><input style={input} name="amount" type="number" min={0} required /></Field>
      <Field label="Status"><select style={input} name="status" defaultValue="Sent"><option>Draft</option><option>Sent</option><option>Accepted</option><option>Expired</option></select></Field>
      <button type="submit" style={primary}>Add</button>
    </form>
  );
}

export function ReimbursementForm({ staff }: { staff: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [payee, setPayee] = useState("");   // "id|name" or "" for free-text
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ ...primary, borderRadius: 10, padding: "9px 15px" }}>+ New claim</button>;
  const [pid, pname] = payee.split("|");
  return (
    <form action={submitReimbursement} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ ...panel, display: "grid", gridTemplateColumns: "1.3fr 1fr 0.8fr 0.9fr auto", gap: 10, alignItems: "end" }}>
      <input type="hidden" name="payee_staff" value={pid && pid !== "other" ? pid : ""} />
      <input type="hidden" name="payee_name" value={payee === "" ? "" : (pname ?? "")} />
      <Field label="Paid by (staff)">
        <select style={input} value={payee} onChange={(e) => setPayee(e.target.value)} required>
          <option value="" disabled>Choose…</option>
          {staff.map((s) => <option key={s.id} value={`${s.id}|${s.name}`}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Category">
        <select style={input} name="category" defaultValue="Other">
          <option>Travel</option><option>Meals</option><option>Supplies</option><option>Client care</option><option>Other</option>
        </select>
      </Field>
      <Field label="Amount (₹)"><input style={input} name="amount" type="number" min={0} required /></Field>
      <Field label="Date incurred"><input style={input} name="incurred_date" type="date" /></Field>
      <button type="submit" style={primary}>Submit</button>
      <div style={{ gridColumn: "1 / 4" }}><Field label="What was it for?"><input style={input} name="description" required /></Field></div>
      <div style={{ gridColumn: "4 / 6" }}><Field label="Receipt (optional)"><input style={{ ...input, paddingTop: 6 }} name="receipt" type="file" accept="image/*,application/pdf" /></Field></div>
    </form>
  );
}

// Record a petty-cash top-up: money moved from bank into the cash box. It is a
// normal cash receipt, tagged kind="Top-up" so it reads as a float refill.
export function TopUpForm() {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ ...primary, borderRadius: 10, padding: "7px 13px", fontSize: 12 }}>+ Record top-up</button>;
  return (
    <form action={addLedgerEntry} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ display: "flex", gap: 8, alignItems: "end" }}>
      <input type="hidden" name="account" value="cash" />
      <input type="hidden" name="direction" value="in" />
      <input type="hidden" name="kind" value="Top-up" />
      <input type="hidden" name="party" value="Bank → petty cash" />
      <Field label="Top-up amount (₹)"><input style={{ ...input, width: 140 }} name="amount" type="number" min={0} required autoFocus /></Field>
      <button type="submit" style={{ ...primary, padding: "9px 14px" }}>Add</button>
    </form>
  );
}

export function EditFloatForm({ float, threshold }: { float: number; threshold: number }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 12, cursor: "pointer" }}>Set float</button>;
  return (
    <form action={setPettyFloat} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ display: "flex", gap: 8, alignItems: "end" }}>
      <Field label="Cash float (₹)"><input style={{ ...input, width: 110 }} name="float_amount" type="number" min={0} defaultValue={float} required /></Field>
      <Field label="Low at (₹)"><input style={{ ...input, width: 110 }} name="low_threshold" type="number" min={0} defaultValue={threshold} required /></Field>
      <button type="submit" style={{ ...primary, padding: "9px 14px" }}>Save</button>
    </form>
  );
}

export function LedgerForm({ account }: { account: "bank" | "cash" }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ ...primary, borderRadius: 10, padding: "9px 15px" }}>+ Add entry</button>;
  return (
    <form action={addLedgerEntry} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ ...panel, display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
      <input type="hidden" name="account" value={account} />
      <Field label={account === "bank" ? "Party" : "Description"}><input style={input} name="party" required /></Field>
      {account === "bank" ? <Field label="Ref"><input style={input} name="ref" /></Field> : <div />}
      {account === "bank" ? <Field label="Type"><select style={input} name="kind" defaultValue="NEFT"><option>NEFT</option><option>UPI</option><option>IMPS</option><option>Card</option><option>Cheque</option></select></Field> : <div />}
      <Field label="Direction"><select style={input} name="direction" defaultValue="in"><option value="in">In</option><option value="out">Out</option></select></Field>
      <Field label="Amount (₹)"><input style={input} name="amount" type="number" min={0} required /></Field>
      <button type="submit" style={primary}>Add</button>
    </form>
  );
}
