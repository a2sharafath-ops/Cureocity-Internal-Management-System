"use client";

import { setReferralStatus } from "@/lib/actions";

const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer" };

export default function ReferralActions({ id, status }: { id: string; status: string }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
      {status === "invited" && (
        <form action={setReferralStatus}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="joined" />
          <button type="submit" style={{ ...btn, borderColor: "var(--brand-fill)", color: "var(--brand-text)" }}>Mark joined</button>
        </form>
      )}
      {status === "joined" && (
        <form action={setReferralStatus}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="rewarded" />
          <input type="hidden" name="reward_amount" value="500" />
          <button type="submit" style={{ ...btn, borderColor: "var(--amber)", color: "#92400e" }}>Reward ₹500</button>
        </form>
      )}
      {status === "rewarded" && <span style={{ fontSize: 12, color: "var(--muted)" }}>✓ complete</span>}
    </div>
  );
}
