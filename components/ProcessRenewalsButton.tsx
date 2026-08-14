"use client";

import { useActionState } from "react";
import { processDueRenewals, type SubscriptionRenewState } from "@/lib/actions";

export default function ProcessRenewalsButton({ count }: { count: number }) {
  const [state, process] = useActionState<SubscriptionRenewState, FormData>(processDueRenewals, {});
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <form action={process}>
        <button type="submit" style={{ background: "var(--amber)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Process {count} due renewal{count === 1 ? "" : "s"}
        </button>
      </form>
      {state.error && <span style={{ maxWidth: 420, fontSize: 11, color: "var(--red-text)", textAlign: "right" }}>{state.error}</span>}
    </span>
  );
}
