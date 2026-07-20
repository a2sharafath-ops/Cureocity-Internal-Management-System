"use client";

import { setTaskStatus, deleteTask } from "@/lib/actions";

const NEXT: Record<string, string> = { todo: "doing", doing: "done", blocked: "doing" };
const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer" };

export default function TaskActions({ id, status }: { id: string; status: string }) {
  return (
    <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", flexWrap: "wrap" }}>
      {NEXT[status] && status !== "done" && (
        <form action={setTaskStatus}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={NEXT[status]} />
          <button type="submit" style={{ ...btn, borderColor: "var(--brand-fill)", color: "var(--brand-text)" }}>→ {NEXT[status]}</button>
        </form>
      )}
      {status !== "blocked" && status !== "done" && (
        <form action={setTaskStatus}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="blocked" />
          <button type="submit" style={{ ...btn, color: "#b45309" }}>Block</button>
        </form>
      )}
      {status === "done" && (
        <form action={setTaskStatus}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="todo" />
          <button type="submit" style={btn}>Reopen</button>
        </form>
      )}
      <form action={deleteTask}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" title="Remove" style={{ ...btn, color: "var(--muted)" }}>✕</button>
      </form>
    </div>
  );
}
