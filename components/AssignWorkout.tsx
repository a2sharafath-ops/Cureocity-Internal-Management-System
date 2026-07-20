"use client";

import { useState } from "react";
import { assignWorkout } from "@/lib/actions";

export default function AssignWorkout({ templateId, clients }: { templateId: string; clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ border: "1px solid var(--brand-fill)", background: "#fff", color: "var(--brand-text)", borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Assign →</button>;
  }
  return (
    <form action={assignWorkout} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input type="hidden" name="template_id" value={templateId} />
      <select name="client_id" required defaultValue="" style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "4px 8px", fontSize: 12, background: "#fff" }}>
        <option value="" disabled>Client…</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button type="submit" style={{ border: "1px solid var(--ink)", background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Assign</button>
      <button type="button" onClick={() => setOpen(false)} style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>✕</button>
    </form>
  );
}
