"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ISSUE_STATUSES } from "@/lib/issue-reports";
import { triageIssueReport, type IssueActionState } from "@/lib/issue-actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} style={{ border: 0, borderRadius: 9, padding: "9px 14px", background: "var(--ink)", color: "#fff", fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending ? 0.65 : 1 }}>{pending ? "Saving…" : "Save triage"}</button>;
}

export default function IssueTriageForm({ id, status, note }: { id: string; status: string; note: string | null }) {
  const [state, action] = useActionState<IssueActionState, FormData>(triageIssueReport, {});
  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="id" value={id} />
      <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 12, fontWeight: 650 }}>Status
        <select name="status" defaultValue={status} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", background: "#fff", font: "inherit" }}>
          {ISSUE_STATUSES.map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
      <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 12, fontWeight: 650 }}>Administrator note
        <textarea name="admin_note" defaultValue={note ?? ""} maxLength={2000} rows={5} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "9px 10px", background: "#fff", font: "inherit", resize: "vertical" }} placeholder="Decision, owner, workaround, or verification note" />
      </label>
      {state.error && <div role="alert" style={{ color: "var(--red-text)", fontSize: 12 }}>{state.error}</div>}
      {state.ok && <div style={{ color: "var(--green-text)", fontSize: 12 }}>{state.ok}</div>}
      <div><SubmitButton /></div>
    </form>
  );
}
