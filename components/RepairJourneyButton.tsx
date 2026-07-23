"use client";

// Re-runs a client's care journey (BluePrint / PT / Comprehensive) — queues the
// booking tasks, blood request and care-team assignment that a real sale would.
// Idempotent, but confirmed anyway since it creates tasks and notifications.

import { repairClientJourney } from "@/lib/actions";

export default function RepairJourneyButton({ clientId }: { clientId: string }) {
  return (
    <form
      action={repairClientJourney}
      onSubmit={(e) => { if (!confirm("Start / repair this client's care journey?\n\nThis queues the booking tasks, blood request and care-team assignment. Safe to run more than once.")) e.preventDefault(); }}
    >
      <input type="hidden" name="client_id" value={clientId} />
      <button type="submit" style={{
        border: "1px solid var(--border)", background: "#fff", borderRadius: 10,
        padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--ink)",
      }}>
        Start / repair journey
      </button>
    </form>
  );
}
