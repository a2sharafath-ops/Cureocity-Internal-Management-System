"use client";

import { requestBlood, markBloodReceived } from "@/lib/actions";
import SubmitButton from "@/components/SubmitButton";

type Blood = { requested_at: string | null; submitted: boolean; submitted_date: string | null } | null;

// One panel's request/receive controls. `panel` is passed through so the
// correct blood_requests row is targeted — a client can hold both a BluePrint
// and a Comprehensive panel at once.
export default function BloodActions({ clientId, blood, panel = "blueprint", label }: { clientId: string; blood: Blood; panel?: string; label?: string }) {
  const heading = label ? <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".3px", color: "var(--muted)", marginBottom: 4 }}>{label}</div> : null;

  if (!blood) {
    return (
      <div>
        {heading}
        <form action={requestBlood}>
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="panel" value={panel} />
          <div style={{ marginBottom: 4 }}>
            <span style={{ background: "var(--neutral-bg)", color: "var(--muted)", borderRadius: 999, padding: "2px 9px", fontSize: 11 }}>Request: not sent</span>
          </div>
          <SubmitButton pendingLabel="Sending…" doneLabel="✓ Sent" style={{ border: "none", background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
            Send request
          </SubmitButton>
        </form>
      </div>
    );
  }
  if (blood.submitted) {
    return (
      <div>
        {heading}
        <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>Request sent · Report received ✓</span>
        <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>received {blood.submitted_date}</div>
      </div>
    );
  }
  return (
    <div>
      {heading}
      <div style={{ marginBottom: 4 }}>
        <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11 }}>Sent {blood.requested_at}</span>{" "}
        <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11 }}>Report awaited</span>
      </div>
      <form action={markBloodReceived}>
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="panel" value={panel} />
        <SubmitButton pendingLabel="Saving…" doneLabel="✓ Received" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
          Mark received
        </SubmitButton>
      </form>
    </div>
  );
}
