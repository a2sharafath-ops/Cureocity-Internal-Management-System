"use client";

// One-click "Mark done" for a scheduled consultation, with a confirm so it can't
// be hit by accident. Closes the consult + appointment without opening the
// console (see markConsultDone in lib/actions). Rendered on the clinician
// workspace Today / Overdue rows next to ▶ Start.

import { markConsultDone } from "@/lib/actions";
import SubmitButton from "@/components/SubmitButton";

export default function MarkConsultDone({ appointmentId, who }: { appointmentId: string; who?: string | null }) {
  return (
    <form
      action={markConsultDone}
      onSubmit={(e) => {
        if (!confirm(`Mark ${who ? `${who}'s ` : "this "}consultation complete?\n\nThis closes it out and stops it showing as due. It won't record a summary — use ▶ Start if you need to write one up.`)) {
          e.preventDefault();
        }
      }}
      style={{ margin: 0 }}
    >
      <input type="hidden" name="appointment_id" value={appointmentId} />
      <SubmitButton
        persist
        pendingLabel="Saving…"
        doneLabel="✓ Done"
        style={{ border: "1px solid var(--border)", background: "#fff", color: "var(--ink)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
      >
        Mark done
      </SubmitButton>
    </form>
  );
}
