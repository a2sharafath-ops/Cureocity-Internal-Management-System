"use client";

import { useActionState, useState, useTransition } from "react";
import {
  acceptDietitianReviewDraft,
  discardDietitianReviewDraft,
  generateDietitianReviewDraft,
  type DietitianAssistantState,
} from "@/lib/dietitian-assistant-actions";
import { DIETITIAN_WORKFLOWS } from "@/lib/dietitian-assistant";

export type DietitianAssistantHistory = {
  id: string;
  title: string;
  draft_text: string;
  accepted_text: string | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
};

const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
const input: React.CSSProperties = { width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 10px", background: "#fff", font: "inherit", fontSize: 12.5, boxSizing: "border-box" };
const button: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 11px", background: "#fff", color: "var(--ink)", fontSize: 12, fontWeight: 700, cursor: "pointer" };

function DraftReview({ draft }: { draft: NonNullable<DietitianAssistantState["draft"]> }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const run = (operation: "accept" | "discard") => startTransition(async () => {
    setMessage(null);
    setError(null);
    const result = operation === "accept" ? await acceptDietitianReviewDraft(draft.id) : await discardDietitianReviewDraft(draft.id);
    if (result.error) setError(result.error);
    else setMessage(result.ok ?? "Done");
  });

  return (
    <section style={{ ...box, padding: 16, display: "grid", gap: 10 }} aria-label="Review Dietitian checklist">
      <div style={{ color: "#5b21b6", fontSize: 10.5, fontWeight: 800 }}>DETERMINISTIC DRAFT · STATIC RULES · NO AI CALL · NO RECORD READ · NO ACTION</div>
      <b style={{ fontSize: 14 }}>{draft.title}</b>
      <textarea aria-label="Dietitian review checklist" rows={15} value={draft.text} readOnly style={{ ...input, resize: "vertical", lineHeight: 1.5, background: "var(--neutral-bg)" }} />
      {draft.evidence.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Static rule and route evidence</summary>
          <ul style={{ margin: "7px 0 0", paddingLeft: 20, color: "var(--muted)", fontSize: 11.5 }}>
            {draft.evidence.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </details>
      )}
      <div style={{ color: "var(--amber-text)", fontSize: 11.5 }}><b>Boundary:</b> {draft.caution}</div>
      {error && <div role="alert" style={{ color: "var(--red-text)", fontSize: 12 }}>{error}</div>}
      {message && <div role="status" style={{ color: "var(--green-text)", fontSize: 12 }}>{message}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" disabled={busy} onClick={() => run("accept")} style={{ ...button, background: "var(--ink)", color: "#fff", opacity: busy ? 0.6 : 1 }}>Accept reviewed text</button>
        <button type="button" disabled={busy} onClick={() => run("discard")} style={{ ...button, opacity: busy ? 0.6 : 1 }}>Discard</button>
      </div>
      <div style={{ color: "var(--muted)", fontSize: 11 }}>Accepting stores generated text only. It does not inspect a chart, settle a target, make a clinical recommendation, or perform any workflow action.</div>
    </section>
  );
}

export default function DietitianAssistant({ history, enabled, historyError }: { history: DietitianAssistantHistory[]; enabled: boolean; historyError: string | null }) {
  const [state, action, pending] = useActionState<DietitianAssistantState, FormData>(generateDietitianReviewDraft, {});
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ ...box, padding: 16, background: "#eff6ff", color: "#1e3a8a", fontSize: 12.5 }}>
        <b>Dietitian review-checklist pilot.</b> Choose a workflow to receive static navigation and existing review-rule guidance. It calls no AI provider and reads no client, consultation, assessment, chart, meal, recipe, monitoring, concern, finance, HR, staff, or message record.
      </div>
      {!enabled && (
        <div style={{ ...box, padding: 16, color: "var(--amber-text)", background: "var(--amber-bg)", fontSize: 12.5 }}>
          <b>This pilot is not active.</b> Migrations 0186 and 0191 must be applied in the intended Development environment and the dedicated Dietitian feature flag must be enabled. The default deployed state remains off.
        </div>
      )}
      <form action={action} style={{ ...box, padding: 16, display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
          Dietitian review workflow
          <select name="workflow_key" defaultValue="chart_review_readiness" style={input}>
            {DIETITIAN_WORKFLOWS.map((workflow) => <option key={workflow.key} value={workflow.key}>{workflow.label}</option>)}
          </select>
        </label>
        <div style={{ color: "var(--muted)", fontSize: 11.5 }}>Do not enter record details. This selector sends only the workflow key and uses versioned static route and review-rule metadata.</div>
        {state.error && <div role="alert" style={{ color: "var(--red-text)", background: "var(--red-bg)", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>{state.error}</div>}
        <div>
          <button disabled={pending || !enabled} style={{ ...button, border: 0, background: "var(--ink)", color: "#fff", cursor: pending || !enabled ? "default" : "pointer", opacity: enabled ? 1 : 0.5 }}>
            {pending ? "Preparing checklist…" : "Prepare review checklist"}
          </button>
        </div>
      </form>
      {state.draft && <DraftReview key={state.draft.id} draft={state.draft} />}
      <section style={{ ...box, overflow: "hidden" }}>
        <div style={{ padding: "12px 15px" }}>
          <b style={{ fontSize: 13.5 }}>Recent Dietitian checklists</b>
          <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>Static rule evidence is retained; accepted text remains separate and performs no action.</div>
        </div>
        {historyError ? (
          <div style={{ borderTop: "1px solid var(--border)", padding: 15, color: "var(--red-text)", fontSize: 12.5 }}>{historyError}</div>
        ) : history.length ? history.map((item) => (
          <details key={item.id} style={{ borderTop: "1px solid var(--border)", padding: "10px 15px" }}>
            <summary style={{ cursor: "pointer", fontSize: 12.5 }}><b>{item.title}</b> · <span style={{ fontWeight: 700 }}>{item.status}</span> · <span style={{ color: "var(--muted)" }}>{new Date(item.created_at).toLocaleDateString("en-GB")}</span></summary>
            <div style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.5 }}>{item.accepted_text ?? item.draft_text}</div>
            <div style={{ color: "var(--muted)", fontSize: 10.5, marginTop: 6 }}>Static Dietitian review draft · no AI call · no record read · no action executed</div>
          </details>
        )) : <div style={{ borderTop: "1px solid var(--border)", padding: 15, color: "var(--muted)", fontSize: 12.5 }}>No Dietitian checklists yet.</div>}
      </section>
    </div>
  );
}
