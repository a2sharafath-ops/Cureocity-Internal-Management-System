"use client";

// Trial (pre-sale) controls for the assigned clinician on their own workspace.
//
//  • Assessment → the full Start → console (inputs) → Complete → summary flow,
//    identical to a client assessment. "Start" opens the console; the trial's
//    appointment flips to completed when the console session is completed.
//  • Training → a workout, not an assessment: just Attended / No-show.
//
// All actions are ownership-checked server-side, so they only do anything for
// the provider the trial is booked with (or front desk / admin).

import { markExperienceOutcome, startConsultFromAppointment } from "@/lib/actions";
import SubmitButton from "@/components/SubmitButton";

export default function TrialOutcomeActions({
  id, kind, status,
}: { id: string; kind: "assessment" | "training"; status: string }) {
  // Once recorded, show the outcome rather than the controls.
  if (status === "completed") return <span style={chip("var(--green-bg)", "var(--green-text)")}>{kind === "assessment" ? "✓ Completed" : "✓ Attended"}</span>;
  if (status === "cancelled") return <span style={chip("var(--red-bg)", "var(--red-text)")}>Cancelled</span>;
  if (status === "no_show") return <span style={chip("var(--amber-bg)", "var(--amber-text)")}>No-show</span>;

  return (
    <div style={{ display: "inline-flex", gap: 6 }}>
      {kind === "assessment" ? (
        // Opens the console; the assessment is completed & summarized in there.
        <form action={startConsultFromAppointment} style={{ margin: 0 }}>
          <input type="hidden" name="appointment_id" value={id} />
          <SubmitButton pendingLabel="Opening…" doneLabel="Opening…"
            style={{ border: "none", background: "var(--brand-fill)", color: "#fff", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            ▶ Start
          </SubmitButton>
        </form>
      ) : (
        <form action={markExperienceOutcome} style={{ margin: 0 }}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="status" value="completed" />
          <SubmitButton pendingLabel="Saving…" doneLabel="✓ Attended"
            style={{ border: "none", background: "var(--brand-fill)", color: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            ✓ Attended
          </SubmitButton>
        </form>
      )}
      <form action={markExperienceOutcome} style={{ margin: 0 }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="status" value="no_show" />
        <SubmitButton pendingLabel="…" doneLabel="✓"
          style={{ border: "1px solid var(--border)", background: "#fff", color: "var(--amber-text)", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
          No-show
        </SubmitButton>
      </form>
    </div>
  );
}

const chip = (bg: string, c: string): React.CSSProperties => ({
  background: bg, color: c, borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap",
});
