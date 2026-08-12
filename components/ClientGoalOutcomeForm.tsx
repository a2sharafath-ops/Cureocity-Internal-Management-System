"use client";

import { useActionState } from "react";
import { recordClientGoalOutcome, type ClientGoalOutcomeState } from "@/lib/actions";
import type { ClientGoalOutcome } from "@/lib/client-goal-outcome";

const field: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", border: "1px solid var(--border)",
  borderRadius: 8, padding: "8px 10px", background: "#fff", font: "inherit", fontSize: 12,
};

export default function ClientGoalOutcomeForm({ goalId, reports }: {
  goalId: string;
  reports: ClientGoalOutcome[];
}) {
  const [state, action] = useActionState<ClientGoalOutcomeState, FormData>(recordClientGoalOutcome, {});
  const latest = reports[0] ?? null;
  return <div style={{ marginTop: 8, marginLeft: 42 }}>
    {latest && <div style={{ background: "var(--neutral-bg)", borderRadius: 8, padding: "7px 9px", fontSize: 11.5 }}>
      <b>Your latest progress rating: {latest.achievement_rating}/10</b>
      <span style={{ color: "var(--muted)" }}> · {new Date(latest.reported_at).toLocaleDateString("en-GB")}</span>
      {latest.support_requested && <span style={{ color: "var(--amber-text)", fontWeight: 700 }}> · support requested</span>}
    </div>}
    {reports.length > 1 && <details style={{ marginTop: 5, fontSize: 11 }}><summary style={{ cursor: "pointer", color: "var(--muted)" }}>Your earlier progress reports ({reports.length - 1})</summary>{reports.slice(1).map((report) => <div key={report.id} style={{ borderTop: "1px solid var(--border)", padding: "5px 0" }}><b>{report.achievement_rating}/10 · {new Date(report.reported_at).toLocaleDateString("en-GB")}</b>{report.support_requested ? " · support requested" : ""}{report.progress_note ? ` — ${report.progress_note}` : ""}</div>)}</details>}
    <details style={{ marginTop: 7 }}>
      <summary style={{ cursor: "pointer", color: "var(--brand-text)", fontWeight: 700, fontSize: 12 }}>Share how this goal is going</summary>
      <form action={action} style={{ display: "grid", gap: 8, marginTop: 8, border: "1px solid var(--border)", borderRadius: 9, padding: 10 }}>
        <input type="hidden" name="goal_id" value={goalId} />
        {state.error && <div style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 7, padding: 8, fontSize: 11.5 }}>{state.error}</div>}
        {state.ok && <div style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 7, padding: 8, fontSize: 11.5 }}>{state.ok}</div>}
        <label style={{ display: "grid", gap: 4, fontSize: 11.5 }}>
          In your own view, how much progress have you made toward this goal?
          <select name="achievement_rating" required defaultValue="" style={field}>
            <option value="" disabled>Choose 0–10</option>
            {Array.from({ length: 11 }, (_, rating) => <option key={rating} value={rating}>{rating}{rating === 0 ? " — no progress yet" : rating === 10 ? " — fully achieved" : ""}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 11.5 }}>What helped, or what got in the way? (optional)
          <textarea name="progress_note" maxLength={1000} rows={3} style={{ ...field, resize: "vertical" }} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5 }}><input type="checkbox" name="support_requested" /> I would like support from my care team with this goal.</label>
        <div style={{ color: "var(--muted)", fontSize: 10.5 }}>This is your self-report, not a test or performance score. Previous reports remain in your care record.</div>
        <button type="submit" style={{ justifySelf: "start", border: 0, borderRadius: 8, padding: "8px 12px", background: "var(--brand-fill)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Share progress</button>
      </form>
    </details>
  </div>;
}
