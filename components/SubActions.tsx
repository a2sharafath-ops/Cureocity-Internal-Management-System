"use client";

import { useActionState, useState } from "react";
import { setSubStatus, toggleAutoRenew, renewNow, type SubscriptionRenewState } from "@/lib/actions";

const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer" };

export default function SubActions({ id, status, autoRenew }: { id: string; status: string; autoRenew: boolean }) {
  const [renewState, renew] = useActionState<SubscriptionRenewState, FormData>(renewNow, {});
  const [initialMutationKey] = useState(() => crypto.randomUUID());
  const mutationKey = renewState.nextMutationKey ?? initialMutationKey;

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
      <form action={toggleAutoRenew}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="value" value={String(autoRenew)} />
        <button type="submit" style={{ ...btn, color: autoRenew ? "var(--brand-text)" : "var(--muted)" }}>{autoRenew ? "Auto-renew: on" : "Auto-renew: off"}</button>
      </form>
      {status !== "cancelled" && (
        <form action={renew}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="mutation_key" value={mutationKey} />
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
      {renewState.error && <span style={{ flexBasis: "100%", fontSize: 11, color: "var(--red-text)", textAlign: "right" }}>{renewState.error}</span>}
    </div>
  );
}
