"use client";

// Remark log + next callback for one lead.
//
// One form, not two. The sales audit found the follow-up date filled 17% of
// the time while remarks said "call tomorrow" — that gap exists because
// recording what happened and deciding what happens next were separate
// chores. Here the outcome picks a sensible callback date automatically, so
// the common case is: type what happened, pick an outcome, save.

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addLeadRemark, setLeadFollowup } from "@/lib/actions";
import { REMARK_OUTCOMES, SUGGESTED_OFFSET, followupView, FOLLOWUP_TONE, type RemarkOutcome } from "@/lib/lead-followup";

export type Remark = {
  id: string; body: string; outcome: string | null;
  by_name: string | null; created_at: string;
};

const box: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px", marginTop: 16,
};
const field: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 8, padding: "6px 9px",
  fontSize: 12.5, background: "#fff",
};
// Same look, fixed height. An <input> and a <select> have different intrinsic
// heights, so equal padding leaves them staggered in a row. Deliberately not
// applied to the <textarea>, which must stay free to grow.
const fieldControl: React.CSSProperties = { ...field, padding: "0 9px", height: 34, boxSizing: "border-box" };
const btn: React.CSSProperties = {
  border: "1px solid var(--border)", background: "#fff", borderRadius: 8,
  padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: "var(--ink)",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

const OUTCOME_LABEL: Record<string, string> = Object.fromEntries(
  REMARK_OUTCOMES.map((o) => [o.key, o.label]),
);

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      style={{ ...btn, background: "var(--ink)", color: "#fff", border: "none", opacity: pending ? 0.6 : 1 }}>
      {pending ? "Saving…" : "Save remark"}
    </button>
  );
}

export default function LeadRemarks({
  leadId, remarks, nextFollowUp, followUpNote, followUpOwner, today, canWrite, legacyNotes,
}: {
  leadId: string;
  remarks: Remark[];
  nextFollowUp: string | null;
  followUpNote: string | null;
  followUpOwner: string | null;
  today: string;
  canWrite: boolean;
  /** the imported free-text history — shown once, below the structured log */
  legacyNotes: string | null;
}) {
  const [state, action] = useFormState(addLeadRemark, {} as { ok?: string; error?: string });
  const [outcome, setOutcome] = useState<RemarkOutcome>("no_answer");
  const [showAll, setShowAll] = useState(false);

  const v = followupView(nextFollowUp, today);
  const tone = FOLLOWUP_TONE[v.status];
  const suggested = SUGGESTED_OFFSET[outcome];
  const shown = showAll ? remarks : remarks.slice(0, 5);

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700 }}>🗒 Remarks &amp; callback</div>
        <span style={{ background: tone.bg, color: tone.color, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>
          {v.label}
        </span>
        {nextFollowUp && (
          <span style={{ color: "var(--muted)", fontSize: 12 }}>
            {nextFollowUp}{followUpOwner ? ` · ${followUpOwner}` : ""}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {canWrite && nextFollowUp && (
          <form action={setLeadFollowup}>
            <input type="hidden" name="lead_id" value={leadId} />
            <input type="hidden" name="next_follow_up" value="" />
            <button type="submit" style={{ ...btn, border: "none", background: "transparent", color: "var(--muted)", fontSize: 11.5 }}>
              Clear callback
            </button>
          </form>
        )}
      </div>
      {followUpNote && (
        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>{followUpNote}</div>
      )}

      {canWrite && (
        <form action={action} style={{ marginTop: 11 }}>
          <input type="hidden" name="lead_id" value={leadId} />
          <textarea
            name="body" rows={2} required
            placeholder="What happened on this call?"
            style={{ ...field, width: "100%", fontSize: 13, resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", marginTop: 7 }}>
            <select name="outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as RemarkOutcome)} style={fieldControl}>
              {REMARK_OUTCOMES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <label style={{ fontSize: 11.5, color: "var(--muted)" }}>Call back</label>
            <input
              type="date" name="next_follow_up"
              // Re-keyed on outcome so changing it refreshes the suggestion
              // rather than leaving a stale default the user didn't choose.
              key={outcome}
              defaultValue={suggested != null ? addDays(today, suggested) : ""}
              min={today} style={fieldControl}
            />
            <input name="next_note" placeholder="Callback note (optional)" style={{ ...fieldControl, flex: 1, minWidth: 140 }} />
            <Save />
          </div>
          {suggested == null && (
            <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}>
              No callback suggested for this outcome — set a date if you still want one.
            </div>
          )}
        </form>
      )}

      {state.error && (
        <div style={{ marginTop: 9, background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 8, padding: "6px 9px", fontSize: 12 }}>{state.error}</div>
      )}
      {state.ok && (
        <div style={{ marginTop: 9, background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 8, padding: "6px 9px", fontSize: 12 }}>{state.ok}</div>
      )}

      <div style={{ marginTop: 12 }}>
        {shown.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 12.5 }}>No remarks logged yet.</div>
        )}
        {shown.map((r) => (
          <div key={r.id} style={{ borderTop: "1px solid var(--border)", padding: "8px 0", fontSize: 12.5 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 2 }}>
              <b>{when(r.created_at)}</b>
              {r.outcome && (
                <span style={{ background: "var(--neutral-bg)", color: "var(--muted)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>
                  {OUTCOME_LABEL[r.outcome] ?? r.outcome}
                </span>
              )}
              {r.by_name && <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{r.by_name}</span>}
            </div>
            <div>{r.body}</div>
          </div>
        ))}
        {remarks.length > 5 && (
          <button type="button" onClick={() => setShowAll(!showAll)}
            style={{ ...btn, border: "none", background: "transparent", color: "var(--brand-text)", padding: "7px 0 0", fontSize: 12 }}>
            {showAll ? "Show fewer" : `Show all ${remarks.length}`}
          </button>
        )}
      </div>

      {legacyNotes && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontSize: 11.5, color: "var(--muted)" }}>
            Imported history (before the remark log)
          </summary>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
            {legacyNotes}
          </div>
        </details>
      )}
    </div>
  );
}
