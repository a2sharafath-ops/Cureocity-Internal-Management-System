"use client";

// Kicks off (or re-seeds) a client's care journey — booking tasks, blood
// request and care-team assignment. Before the journey exists this is the
// prominent "Start journey" action; once it's running it becomes a quiet
// "Re-run setup" for the rare repair, so a completed journey doesn't keep
// showing a call-to-action.

import { repairClientJourney } from "@/lib/actions";
import SubmitButton from "@/components/SubmitButton";

export default function RepairJourneyButton({ clientId, started = false }: { clientId: string; started?: boolean }) {
  const label = started ? "Re-run setup" : "Start journey";
  const confirmMsg = started
    ? "Re-run this client's journey setup?\n\nRe-checks the booking tasks, blood request and care team, adding only what's missing. Safe to run more than once."
    : "Start this client's care journey?\n\nThis queues the booking tasks, blood request and care-team assignment.";
  const style: React.CSSProperties = started
    ? { border: "none", background: "transparent", padding: "6px 4px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: "var(--muted)", textDecoration: "underline" }
    : { border: "1px solid var(--border)", background: "#fff", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--ink)" };

  return (
    <form
      action={repairClientJourney}
      onSubmit={(e) => { if (!confirm(confirmMsg)) e.preventDefault(); }}
    >
      <input type="hidden" name="client_id" value={clientId} />
      <SubmitButton pendingLabel={started ? "Re-running…" : "Starting…"} doneLabel="✓ Done" style={style}>{label}</SubmitButton>
    </form>
  );
}
