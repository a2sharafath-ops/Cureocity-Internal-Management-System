"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addTaskBatch, type TaskBatchState } from "@/lib/actions";

const input: React.CSSProperties = { padding: "0 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%", height: 36, boxSizing: "border-box" };

export default function TaskBulkImport({ projects = [] }: { projects?: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<TaskBatchState, FormData>(addTaskBatch, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) { formRef.current?.reset(); setOpen(false); } }, [state.ok]);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 10, padding: "9px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Import task list</button>;
  return (
    <form ref={formRef} action={action} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}><b>Import an operational task list</b><span style={{ color: "var(--muted)", fontSize: 12 }}>Useful for a launch, event or campaign.</span></div>
      {projects.length > 0
        ? <label style={{ display: "grid", gap: 3, maxWidth: 420 }}><span style={{ fontSize: 11, color: "var(--muted)" }}>Project</span><select name="project_id" defaultValue="" style={input}><option value="">Operations inbox</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        : <label style={{ display: "grid", gap: 3, maxWidth: 420 }}><span style={{ fontSize: 11, color: "var(--muted)" }}>Initiative label (optional)</span><input name="initiative" maxLength={80} placeholder="e.g. App Launch · 24 Aug" style={input} /></label>}
      <label style={{ display: "grid", gap: 3 }}><span style={{ fontSize: 11, color: "var(--muted)" }}>One line per task</span><textarea name="lines" required rows={7} placeholder={"Confirm venue | Anu | 2026-08-22 | High\nPrint badges | | 2026-08-23 | Medium"} style={{ ...input, height: "auto", padding: 10, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} /><span style={{ color: "var(--muted)", fontSize: 11 }}>Format: Task title | exact staff name (optional) | YYYY-MM-DD (optional) | High, Medium or Low (optional). Up to 100 tasks.</span></label>
      {state.error && <div style={{ color: "var(--red)", fontSize: 12 }}>{state.error}</div>}
      <div style={{ display: "flex", gap: 8 }}><button disabled={pending} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: pending ? "wait" : "pointer" }}>{pending ? "Importing…" : "Import tasks"}</button><button type="button" onClick={() => setOpen(false)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer" }}>Cancel</button></div>
    </form>
  );
}
