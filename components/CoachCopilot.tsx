"use client";

import { useActionState, useState, useTransition } from "react";
import {
  acceptCoachCopilotDraft, discardCoachCopilotDraft, generateCoachCopilotDraft,
  type CoachCopilotState,
} from "@/lib/actions";
import { COACH_COPILOT_TASKS } from "@/lib/coach-copilot";

export type CoachCopilotHistory = {
  id: string;
  client_name: string;
  task_type: string;
  title: string;
  draft_text: string;
  accepted_text: string | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
};

const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
const input: React.CSSProperties = { width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", background: "#fff", font: "inherit", fontSize: 12.5, boxSizing: "border-box" };
const button: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "7px 11px", background: "#fff", color: "var(--ink)", fontSize: 12, fontWeight: 700, cursor: "pointer" };
const taskLabel = (key: string) => COACH_COPILOT_TASKS.find((task) => task.key === key)?.label ?? key;

function DraftReview({ draft }: { draft: NonNullable<CoachCopilotState["draft"]> }) {
  const [text, setText] = useState(draft.text);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const accept = () => startTransition(async () => {
    setError(null); setMessage(null);
    const result = await acceptCoachCopilotDraft(draft.id, text);
    if (result.error) setError(result.error); else setMessage(result.ok ?? "Accepted.");
  });
  const discard = () => startTransition(async () => {
    setError(null); setMessage(null);
    const result = await discardCoachCopilotDraft(draft.id);
    if (result.error) setError(result.error); else setMessage(result.ok ?? "Discarded.");
  });

  return <section style={{ ...box, padding: 15, display: "grid", gap: 10 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ background: "#ede9fe", color: "#5b21b6", borderRadius: 999, padding: "2px 8px", fontSize: 10.5, fontWeight: 750 }}>AI-assisted draft</span><b style={{ fontSize: 14 }}>{draft.title}</b></div>
    {draft.caution && <div style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 8, padding: "8px 10px", fontSize: 11.5 }}><b>Check carefully:</b> {draft.caution}</div>}
    <textarea value={text} onChange={(event) => setText(event.target.value)} rows={10} style={{ ...input, resize: "vertical", lineHeight: 1.5 }} aria-label="Editable Copilot draft" />
    {draft.evidence.length > 0 && <details><summary style={{ cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}>Why the Copilot suggested this</summary><ul style={{ margin: "7px 0 0", paddingLeft: 20, color: "var(--muted)", fontSize: 11.5 }}>{draft.evidence.map((item) => <li key={item} style={{ marginBottom: 3 }}>{item}</li>)}</ul></details>}
    <div style={{ color: "var(--muted)", fontSize: 11 }}>Edit anything that is not accurate or appropriate. Accepting preserves it as labelled working text; it does not send a message, create a referral, change a goal or close a safety item.</div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><button type="button" disabled={busy || Boolean(message)} onClick={accept} style={{ ...button, border: 0, background: "var(--ink)", color: "#fff" }}>{busy ? "Saving…" : "Accept edited draft"}</button><button type="button" disabled={busy || Boolean(message)} onClick={discard} style={button}>Discard</button>{message && <span style={{ color: "var(--green-text)", fontSize: 11.5 }}>{message}</span>}{error && <span style={{ color: "var(--red-text)", fontSize: 11.5 }}>{error}</span>}</div>
  </section>;
}

export default function CoachCopilot({
  clients, history, enabled,
}: {
  clients: { id: string; name: string; code: string | null }[];
  history: CoachCopilotHistory[];
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState<CoachCopilotState, FormData>(generateCoachCopilotDraft, {});
  const [selectedTask, setSelectedTask] = useState(COACH_COPILOT_TASKS[0].key);
  const selected = COACH_COPILOT_TASKS.find((task) => task.key === selectedTask)!;

  return <div style={{ display: "grid", gap: 16, maxWidth: 1120 }}>
    <div><h2 style={{ fontSize: 18, margin: "0 0 3px" }}>Cureocity Assistant for Health Coach</h2><div style={{ color: "var(--muted)", fontSize: 12.5 }}>Draft-only behavioural coaching support. You remain responsible for checking every word and choosing the next action.</div></div>
    <div style={{ background: "#eff6ff", color: "#1e3a8a", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 13px", fontSize: 12 }}><b>Human approval is mandatory.</b> Cureocity Assistant cannot diagnose, interpret tests, change medication, prescribe diet or exercise, provide therapy, override a clinician or close a safety alert.</div>

    {!enabled && <div style={{ ...box, padding: 16, color: "var(--amber-text)", background: "var(--amber-bg)", fontSize: 12.5 }}><b>Copilot is not active yet.</b> It stays off until its OpenAI connection and Cureocity privacy/clinical-governance approval are both configured.</div>}

    <form action={action} style={{ ...box, padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 11.5, color: "var(--muted)", fontWeight: 650 }}>Client<select name="client_id" required defaultValue="" style={input}><option value="" disabled>Select a client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.code ? ` · ${client.code}` : ""}</option>)}</select></label>
        <label style={{ display: "grid", gap: 4, fontSize: 11.5, color: "var(--muted)", fontWeight: 650 }}>What should Cureocity Assistant help with?<select name="task_type" value={selectedTask} onChange={(event) => setSelectedTask(event.target.value as typeof selectedTask)} style={input}>{COACH_COPILOT_TASKS.map((task) => <option key={task.key} value={task.key}>{task.label}</option>)}</select></label>
      </div>
      <div style={{ background: "var(--neutral-bg)", borderRadius: 8, padding: "8px 10px", color: "var(--muted)", fontSize: 11.5 }}>{selected.help}</div>
      <label style={{ display: "grid", gap: 4, fontSize: 11.5, color: "var(--muted)", fontWeight: 650 }}>Optional context from your conversation<textarea name="instruction" maxLength={1500} rows={3} placeholder="Add only what the client said or what you want the draft to focus on. Do not paste lab reports or medication instructions." style={{ ...input, resize: "vertical" }} /></label>
      {state.error && <div style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>{state.error}</div>}
      <div><button disabled={pending || !enabled} style={{ ...button, border: 0, background: "var(--ink)", color: "#fff", cursor: pending || !enabled ? "default" : "pointer", opacity: enabled ? 1 : 0.5 }}>{pending ? "Drafting…" : "Generate draft"}</button></div>
    </form>

    {state.draft && <DraftReview key={state.draft.id} draft={state.draft} />}

    <section style={{ ...box, overflow: "hidden" }}><div style={{ padding: "12px 15px" }}><b style={{ fontSize: 13.5 }}>Recent Cureocity Assistant work</b><div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>Drafts remain labelled and auditable. They are never treated as a completed coaching action.</div></div>{history.length ? history.map((item) => <details key={item.id} style={{ borderTop: "1px solid var(--border)", padding: "10px 15px" }}><summary style={{ cursor: "pointer", fontSize: 12.5 }}><b>{item.client_name}</b> · {taskLabel(item.task_type)} · <span style={{ color: item.status === "Accepted" ? "var(--green-text)" : item.status === "Discarded" ? "var(--muted)" : "var(--amber-text)", fontWeight: 700 }}>{item.status}</span> · <span style={{ color: "var(--muted)" }}>{new Date(item.created_at).toLocaleDateString("en-GB")}</span></summary><div style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.5 }}>{item.accepted_text ?? item.draft_text}</div><div style={{ color: "var(--muted)", fontSize: 10.5, marginTop: 6 }}>AI-assisted {item.status === "Accepted" ? "working text accepted by the Health Coach" : item.status.toLowerCase()}</div></details>) : <div style={{ borderTop: "1px solid var(--border)", padding: 15, color: "var(--muted)", fontSize: 12.5 }}>No Cureocity Assistant drafts yet.</div>}</section>
  </div>;
}
