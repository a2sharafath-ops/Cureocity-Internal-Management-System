"use client";

import { useState } from "react";
import { setClaimStatus } from "@/lib/actions";

const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 12, cursor: "pointer" };

export default function ClaimActions({ id, status, claimed }: { id: string; status: string; claimed: number }) {
  const [approving, setApproving] = useState(false);

  if (approving) {
    return (
      <form action={setClaimStatus} style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }} onSubmit={() => setApproving(false)}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value="approved" />
        <input name="amount_approved" type="number" min={0} defaultValue={claimed} required style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "4px 8px", fontSize: 12, width: 100 }} />
        <button type="submit" style={{ ...btn, borderColor: "var(--brand-fill)", color: "var(--brand-text)" }}>Approve</button>
        <button type="button" onClick={() => setApproving(false)} style={{ ...btn, color: "var(--muted)" }}>✕</button>
      </form>
    );
  }

  const simple = (to: string, label: string, color?: string) => (
    <form action={setClaimStatus}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={to} />
      <button type="submit" style={color ? { ...btn, color } : btn}>{label}</button>
    </form>
  );

  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
      {status === "draft" && simple("submitted", "Submit")}
      {status === "submitted" && simple("in_review", "Mark in review")}
      {(status === "submitted" || status === "in_review") && (
        <>
          <button type="button" onClick={() => setApproving(true)} style={{ ...btn, borderColor: "var(--brand-fill)", color: "var(--brand-text)" }}>Approve</button>
          {simple("rejected", "Reject", "var(--red)")}
        </>
      )}
      {status === "approved" && simple("paid", "Mark paid")}
    </div>
  );
}
