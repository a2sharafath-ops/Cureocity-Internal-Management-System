"use client";

import { useState } from "react";
import { completeFollowup, skipFollowup } from "@/lib/actions";

const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" };

export default function FollowupActions({ id }: { id: string }) {
  const [logging, setLogging] = useState(false);
  if (logging) {
    return (
      <form action={completeFollowup} style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }} onSubmit={() => setLogging(false)}>
        <input type="hidden" name="id" value={id} />
        <input name="note" placeholder="Call note (optional)" style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "4px 8px", fontSize: 12, width: 190 }} />
        <button type="submit" style={{ ...btn, borderColor: "var(--brand-fill)", color: "var(--brand-text)" }}>Done</button>
        <button type="button" onClick={() => setLogging(false)} style={{ ...btn, color: "var(--muted)" }}>✕</button>
      </form>
    );
  }
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
      <button type="button" onClick={() => setLogging(true)} style={{ ...btn, borderColor: "var(--brand-fill)", color: "var(--brand-text)" }}>✓ Mark done</button>
      <form action={skipFollowup}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" style={{ ...btn, color: "var(--muted)" }}>Skip</button>
      </form>
    </div>
  );
}
