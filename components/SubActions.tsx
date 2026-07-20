"use client";

import { setSubStatus, toggleAutoRenew, renewNow } from "@/lib/actions";

const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer" };

export default function SubActions({ id, status, autoRenew }: { id: string; status: string; autoRenew: boolean }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
      <form action={toggleAutoRenew}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="value" value={String(autoRenew)} />
        <button type="submit" style={{ ...btn, color: autoRenew ? "var(--brand-text)" : "var(--muted)" }}>{autoRenew ? "Auto-renew: on" : "Auto-renew: off"}</button>
      </form>
      {status !== "cancelled" && (
        <form action={renewNow}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" style={{ ...btn, borderColor: "var(--brand-fill)", color: "var(--brand-text)" }}>Renew now</button>
        </form>
      )}
      {status === "active" && (
        <form action={setSubStatus}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="paused" />
          <button type="submit" style={btn}>Pause</button>
        </form>
      )}
      {status === "paused" && (
        <form action={setSubStatus}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="active" />
          <button type="submit" style={btn}>Resume</button>
        </form>
      )}
      {status !== "cancelled" && (
        <form action={setSubStatus}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="cancelled" />
          <button type="submit" style={{ ...btn, color: "var(--red)" }}>Cancel</button>
        </form>
      )}
    </div>
  );
}
