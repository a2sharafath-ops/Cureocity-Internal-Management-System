"use client";

import { payPayable, setEstimateStatus, approveReimbursement, rejectReimbursement, payReimbursement } from "@/lib/actions";

const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 12, cursor: "pointer" };

export function ReimbursementActions({ id, status, canApprove }: { id: string; status: string; canApprove: boolean }) {
  if (!canApprove) return <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>;
  if (status === "Submitted") {
    return (
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <form action={approveReimbursement}><input type="hidden" name="id" value={id} /><button type="submit" style={{ ...btn, borderColor: "var(--brand-fill)", color: "var(--brand-text)" }}>Approve</button></form>
        <form action={rejectReimbursement}><input type="hidden" name="id" value={id} /><button type="submit" style={{ ...btn, color: "var(--red)" }}>Reject</button></form>
      </div>
    );
  }
  if (status === "Approved") {
    return (
      <form action={payReimbursement} style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
        <input type="hidden" name="id" value={id} />
        <select name="account" defaultValue="bank" style={{ ...btn, padding: "3px 6px" }}><option value="bank">Bank</option><option value="cash">Cash</option></select>
        <button type="submit" style={{ ...btn, borderColor: "var(--brand-fill)", color: "var(--brand-text)" }}>Mark paid</button>
      </form>
    );
  }
  return <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>;
}

export function PayPayable({ id }: { id: string }) {
  return (
    <form action={payPayable}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" style={{ ...btn, borderColor: "var(--brand-fill)", color: "var(--brand-text)" }}>Mark paid</button>
    </form>
  );
}

export function EstimateActions({ id, status }: { id: string; status: string }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
      {(status === "Sent" || status === "Draft") && (
        <>
          <form action={setEstimateStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="Accepted" /><button type="submit" style={{ ...btn, borderColor: "var(--brand-fill)", color: "var(--brand-text)" }}>Accept</button></form>
          <form action={setEstimateStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="Expired" /><button type="submit" style={{ ...btn, color: "var(--muted)" }}>Expire</button></form>
        </>
      )}
    </div>
  );
}
