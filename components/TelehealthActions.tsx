"use client";

import { setTelehealthStatus } from "@/lib/actions";

const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" };

export default function TelehealthActions({ id, status, roomUrl }: { id: string; status: string; roomUrl: string | null }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
      {roomUrl && status !== "ended" && (
        <a href={roomUrl} target="_blank" rel="noopener noreferrer" style={{ ...btn, borderColor: "var(--ink)", color: "#fff", background: "var(--ink)", textDecoration: "none" }}>▶ Join</a>
      )}
      {status === "scheduled" && (
        <form action={setTelehealthStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="active" /><button type="submit" style={btn}>Start</button></form>
      )}
      {status !== "ended" && (
        <form action={setTelehealthStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="ended" /><button type="submit" style={{ ...btn, color: "var(--red)" }}>End</button></form>
      )}
    </div>
  );
}
