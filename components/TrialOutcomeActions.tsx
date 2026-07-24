"use client";

// Attended / No-show controls for a pre-sale trial (assessment or training),
// shown to the *assigned* clinician on their own workspace. The action is
// ownership-checked server-side, so these only do anything for the provider the
// trial is booked with (or front desk / admin).

import { markExperienceOutcome } from "@/lib/actions";
import SubmitButton from "@/components/SubmitButton";

export default function TrialOutcomeActions({
  id, kind, status,
}: { id: string; kind: "assessment" | "training"; status: string }) {
  // Once it's recorded, show the outcome rather than the buttons.
  if (status === "completed") return <span style={chip("var(--green-bg)", "var(--green-text)")}>✓ Attended</span>;
  if (status === "cancelled") return <span style={chip("var(--red-bg)", "var(--red-text)")}>Cancelled</span>;
  if (status === "no_show") return <span style={chip("var(--amber-bg)", "var(--amber-text)")}>No-show</span>;

  return (
    <div style={{ display: "inline-flex", gap: 6 }}>
      <form action={markExperienceOutcome} style={{ margin: 0 }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="status" value="completed" />
        <SubmitButton pendingLabel="Saving…" doneLabel="✓ Attended"
          style={{ border: "none", background: "var(--brand-fill)", color: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
          ✓ Attended
        </SubmitButton>
      </form>
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
