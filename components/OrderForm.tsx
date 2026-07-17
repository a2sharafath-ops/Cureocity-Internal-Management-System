"use client";

import { useState } from "react";
import { createOrder } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };

const LAB = ["CBC", "Lipid panel", "HbA1c", "Fasting glucose", "TSH", "Liver function (LFT)", "Renal function (RFT)", "Vitamin D", "Vitamin B12", "Urinalysis"];
const IMG = ["X-ray chest", "X-ray knee", "USG abdomen", "ECG", "Echocardiogram", "MRI spine", "CT head", "DEXA scan"];

export default function OrderForm({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("lab");
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ background: "#fff", color: "var(--teal-dark)", border: "1px solid var(--teal)", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Order test</button>;
  }
  const list = category === "imaging" ? IMG : LAB;
  return (
    <form action={createOrder} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1.6fr 1fr auto", gap: 10, alignItems: "end" }}>
      <input type="hidden" name="client_id" value={clientId} />
      <div><label style={lbl}>Category</label>
        <select style={input} name="category" value={category} onChange={(e) => setCategory(e.target.value)}><option value="lab">Lab</option><option value="imaging">Imaging</option></select>
      </div>
      <div><label style={lbl}>Test</label>
        <input style={input} name="test" list="order-tests" required placeholder="Type or pick…" />
        <datalist id="order-tests">{list.map((t) => <option key={t} value={t} />)}</datalist>
      </div>
      <div><label style={lbl}>Priority</label>
        <select style={input} name="priority" defaultValue="routine"><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option></select>
      </div>
      <button type="submit" style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Order</button>
    </form>
  );
}
