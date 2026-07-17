"use client";

import { payPayable, setEstimateStatus } from "@/lib/actions";

const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 12, cursor: "pointer" };

export function PayPayable({ id }: { id: string }) {
  return (
    <form action={payPayable}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" style={{ ...btn, borderColor: "var(--teal)", color: "var(--teal-dark)" }}>Mark paid</button>
    </form>
  );
}

export function EstimateActions({ id, status }: { id: string; status: string }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
      {(status === "Sent" || status === "Draft") && (
        <>
          <form action={setEstimateStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="Accepted" /><button type="submit" style={{ ...btn, borderColor: "var(--teal)", color: "var(--teal-dark)" }}>Accept</button></form>
          <form action={setEstimateStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="Expired" /><button type="submit" style={{ ...btn, color: "var(--muted)" }}>Expire</button></form>
        </>
      )}
    </div>
  );
}
