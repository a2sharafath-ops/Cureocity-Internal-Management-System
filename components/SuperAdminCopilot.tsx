"use client";

import { useActionState, useState, useTransition } from "react";
import {
  acceptSuperAdminCopilotDraft,
  discardSuperAdminCopilotDraft,
  generateSuperAdminCopilotDraft,
  type SuperAdminCopilotState,
} from "@/lib/staff-copilot-actions";
import { SUPER_ADMIN_COPILOT_TASKS } from "@/lib/super-admin-copilot";

export type SuperAdminCopilotHistory = {
  id: string;
  task_type: string;
  title: string;
  draft_text: string;
  accepted_text: string | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
};

const box: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow)",
};
const input: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
  background: "#fff",
  font: "inherit",
  fontSize: 12.5,
  boxSizing: "border-box",
};
const button: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "7px 11px",
  background: "#fff",
  color: "var(--ink)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const taskLabel = (key: string) =>
  SUPER_ADMIN_COPILOT_TASKS.find((task) => task.key === key)?.label ?? key;

function DraftReview({ draft }: { draft: NonNullable<SuperAdminCopilotState["draft"]> }) {
  const [text, setText] = useState(draft.text);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const accept = () => startTransition(async () => {
    setError(null);
    setMessage(null);
    const result = await acceptSuperAdminCopilotDraft(draft.id, text);
    if (result.error) setError(result.error);
    else setMessage(result.ok ?? "Accepted as working text.");
  });
  const discard = () => startTransition(async () => {
    setError(null);
    setMessage(null);
    const result = await discardSuperAdminCopilotDraft(draft.id);
    if (result.error) setError(result.error);
    else setMessage(result.ok ?? "Draft discarded.");
  });

  return (
    <section style={{ ...box, padding: 15, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ background: "#ede9fe", color: "#5b21b6", borderRadius: 999, padding: "2px 8px", fontSize: 10.5, fontWeight: 750 }}>
          AI-assisted draft · no action
        </span>
        <b style={{ fontSize: 14 }}>{draft.title}</b>
      </div>
      {draft.caution && (
        <div style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 8, padding: "8px 10px", fontSize: 11.5 }}>
          <b>Check carefully:</b> {draft.caution}
        </div>
      )}
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={11}
        style={{ ...input, resize: "vertical", lineHeight: 1.5 }}
        aria-label="Editable Super Admin Copilot draft"
      />
      {draft.evidence.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}>Recorded evidence used</summary>
          <ul style={{ margin: "7px 0 0", paddingLeft: 20, color: "var(--muted)", fontSize: 11.5 }}>
            {draft.evidence.map((item) => <li key={item} style={{ marginBottom: 3 }}>{item}</li>)}
          </ul>
        </details>
      )}
      <div style={{ color: "var(--muted)", fontSize: 11 }}>
        Review and edit every word. “Accept” only stores this labelled working text in the Copilot audit trail. It does not send a message, create or update a record, alter staff access, approve work, deploy, or contact anyone.
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" disabled={busy || Boolean(message)} onClick={accept} style={{ ...button, border: 0, background: "var(--ink)", color: "#fff" }}>
          {busy ? "Saving…" : "Accept reviewed text only"}
        </button>
        <button type="button" disabled={busy || Boolean(message)} onClick={discard} style={button}>Discard</button>
        {message && <span style={{ color: "var(--green-text)", fontSize: 11.5 }}>{message}</span>}
        {error && <span style={{ color: "var(--red-text)", fontSize: 11.5 }}>{error}</span>}
      </div>
    </section>
  );
}

export default function SuperAdminCopilot({
  history,
  enabled,
  historyError,
}: {
  history: SuperAdminCopilotHistory[];
  enabled: boolean;
  historyError?: string | null;
}) {
  const [state, action, pending] = useActionState<SuperAdminCopilotState, FormData>(
    generateSuperAdminCopilotDraft,
    {},
  );
  const [selectedTask, setSelectedTask] = useState(SUPER_ADMIN_COPILOT_TASKS[0].key);
  const selected = SUPER_ADMIN_COPILOT_TASKS.find((task) => task.key === selectedTask)!;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ background: "#eff6ff", color: "#1e3a8a", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 13px", fontSize: 12 }}>
        <b>Review-first pilot.</b> Copilot reads only aggregate/anonymized operational context and prepares text for you to review. It has no tool or endpoint for messages, data changes, access changes, approvals, deployments, payments or clinical actions.
      </div>

      {!enabled && (
        <div style={{ ...box, padding: 16, color: "var(--amber-text)", background: "var(--amber-bg)", fontSize: 12.5 }}>
          <b>Super Admin pilot is not active.</b> It remains disabled until migration 0183 is applied in the intended non-production environment, the dedicated Super Admin feature flag is enabled, and the external AI connection is configured.
        </div>
      )}

      <form action={action} style={{ ...box, padding: 16, display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 11.5, color: "var(--muted)", fontWeight: 650 }}>
          What reviewable draft should Copilot prepare?
          <select
            name="task_type"
            value={selectedTask}
            onChange={(event) => setSelectedTask(event.target.value as typeof selectedTask)}
            style={input}
          >
            {SUPER_ADMIN_COPILOT_TASKS.map((task) => <option key={task.key} value={task.key}>{task.label}</option>)}
          </select>
        </label>
        <div style={{ background: "var(--neutral-bg)", borderRadius: 8, padding: "8px 10px", color: "var(--muted)", fontSize: 11.5 }}>
          {selected.help}
        </div>
        <label style={{ display: "grid", gap: 4, fontSize: 11.5, color: "var(--muted)", fontWeight: 650 }}>
          Optional review focus
          <textarea
            name="instruction"
            maxLength={1500}
            rows={3}
            placeholder="Example: Focus on the oldest overdue operational items. Do not enter names, emails, client details, clinical information, credentials or instructions to perform an action."
            style={{ ...input, resize: "vertical" }}
          />
        </label>
        {state.error && (
          <div style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>{state.error}</div>
        )}
        <div>
          <button
            disabled={pending || !enabled}
            style={{ ...button, border: 0, background: "var(--ink)", color: "#fff", cursor: pending || !enabled ? "default" : "pointer", opacity: enabled ? 1 : 0.5 }}
          >
            {pending ? "Preparing review draft…" : "Generate review draft"}
          </button>
        </div>
      </form>

      {state.draft && <DraftReview key={state.draft.id} draft={state.draft} />}

      <section style={{ ...box, overflow: "hidden" }}>
        <div style={{ padding: "12px 15px" }}>
          <b style={{ fontSize: 13.5 }}>Recent Super Admin Copilot drafts</b>
          <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>
            Generated, accepted and discarded drafts remain labelled and auditable. None is evidence that an operational action occurred.
          </div>
        </div>
        {historyError ? (
          <div style={{ borderTop: "1px solid var(--border)", padding: 15, color: "var(--red-text)", fontSize: 12.5 }}>{historyError}</div>
        ) : history.length ? history.map((item) => (
          <details key={item.id} style={{ borderTop: "1px solid var(--border)", padding: "10px 15px" }}>
            <summary style={{ cursor: "pointer", fontSize: 12.5 }}>
              <b>{taskLabel(item.task_type)}</b> · <span style={{ color: item.status === "Accepted" ? "var(--green-text)" : item.status === "Discarded" ? "var(--muted)" : "var(--amber-text)", fontWeight: 700 }}>{item.status}</span> · <span style={{ color: "var(--muted)" }}>{new Date(item.created_at).toLocaleDateString("en-GB")}</span>
            </summary>
            <div style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.5 }}>{item.accepted_text ?? item.draft_text}</div>
            <div style={{ color: "var(--muted)", fontSize: 10.5, marginTop: 6 }}>AI-assisted review text only · no action executed</div>
          </details>
        )) : (
          <div style={{ borderTop: "1px solid var(--border)", padding: 15, color: "var(--muted)", fontSize: 12.5 }}>No Super Admin Copilot drafts yet.</div>
        )}
      </section>
    </div>
  );
}
