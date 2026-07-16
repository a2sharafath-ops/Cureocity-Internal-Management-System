"use client";

import { requestBlood, markBloodReceived } from "@/lib/actions";

type Blood = { requested_at: string | null; submitted: boolean; submitted_date: string | null } | null;

export default function BloodActions({ clientId, blood }: { clientId: string; blood: Blood }) {
  if (!blood) {
    return (
      <form action={requestBlood}>
        <input type="hidden" name="client_id" value={clientId} />
        <div style={{ marginBottom: 4 }}>
          <span style={{ background: "#eef2f1", color: "var(--muted)", borderRadius: 999, padding: "2px 9px", fontSize: 11 }}>Request: not sent</span>
        </div>
        <button type="submit" style={{ border: "none", background: "var(--teal)", color: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
          🩸 Send request
        </button>
      </form>
    );
  }
  if (blood.submitted) {
    return (
      <div>
        <span style={{ background: "var(--green-bg)", color: "#166534", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>Request sent · Report received ✓</span>
        <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>received {blood.submitted_date}</div>
      </div>
    );
  }
  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <span style={{ background: "var(--green-bg)", color: "#166534", borderRadius: 999, padding: "2px 9px", fontSize: 11 }}>Sent {blood.requested_at}</span>{" "}
        <span style={{ background: "var(--amber-bg)", color: "#92400e", borderRadius: 999, padding: "2px 9px", fontSize: 11 }}>Report awaited</span>
      </div>
      <form action={markBloodReceived}>
        <input type="hidden" name="client_id" value={clientId} />
        <button type="submit" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
          Mark received
        </button>
      </form>
    </div>
  );
}
