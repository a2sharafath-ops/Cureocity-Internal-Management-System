"use client";

import { useState } from "react";
import { addProduct } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "#fff" };

export default function ProductForm() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ background: "#fff", color: "var(--teal-dark)", border: "1px solid var(--teal)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add product</button>;
  }
  return (
    <form action={addProduct} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 14, display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 0.8fr 0.8fr auto", gap: 10, alignItems: "end" }}>
      <div style={{ display: "grid", gap: 3 }}><label style={{ fontSize: 11, color: "var(--muted)" }}>Name</label><input style={input} name="name" required /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={{ fontSize: 11, color: "var(--muted)" }}>SKU</label><input style={input} name="sku" /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={{ fontSize: 11, color: "var(--muted)" }}>Category</label><input style={input} name="category" defaultValue="General" /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={{ fontSize: 11, color: "var(--muted)" }}>Price</label><input style={input} name="price" type="number" min={0} required /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={{ fontSize: 11, color: "var(--muted)" }}>Stock</label><input style={input} name="stock" type="number" min={0} defaultValue={0} /></div>
      <button type="submit" style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
    </form>
  );
}
