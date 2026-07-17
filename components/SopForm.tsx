"use client";

import { useState } from "react";
import { addSop } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };

export default function SopForm() {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ New SOP</button>;
  return (
    <form action={addSop} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Title</label><input style={input} name="title" required /></div>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Category</label><select style={input} name="category" defaultValue="Operations"><option>Operations</option><option>Clinical</option><option>Compliance</option><option>HR</option></select></div>
      </div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Content</label><textarea style={{ ...input, minHeight: 90, resize: "vertical", fontFamily: "inherit" }} name="content" /></div>
      <div><button type="submit" style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save SOP</button></div>
    </form>
  );
}
