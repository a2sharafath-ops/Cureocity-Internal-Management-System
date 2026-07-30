"use client";

import { useState, useTransition } from "react";
import type { AiState } from "@/lib/ai";

// Summary editor: generate with AI *or* type it yourself, then save. Used
// anywhere a saved summary lives (InBody, consultation). The AI action already
// persists; the manual Save writes the (possibly edited) text to the same field.
export default function SummaryEditor({
  label, clientId, initial = "", date, aiAction, saveAction, sendAction,
}: {
  label: string;
  clientId: string;
  initial?: string;
  date?: string;
  aiAction?: (prev: AiState, formData: FormData) => Promise<AiState>;
  saveAction: (clientId: string, text: string, date?: string) => Promise<{ ok?: boolean; error?: string }>;
  sendAction?: (clientId: string, date?: string) => Promise<{ ok?: boolean; error?: string }>;
}) {
  const [text, setText] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const generate = () => {
    if (!clientId) { setErr("Pick a client first."); return; }
    setErr(null); setMsg(null);
    start(async () => {
      const fd = new FormData();
      fd.set("client_id", clientId);
      if (date !== undefined) fd.set("date", date);
      const r = await aiAction!({}, fd);
      if (r.error) setErr(r.error);
      else { setText(r.text ?? ""); setMsg("Generated & saved — edit if needed."); }
    });
  };
  const save = () => {
    if (!clientId) { setErr("Pick a client first."); return; }
    setErr(null); setMsg(null);
    start(async () => {
      const r = await saveAction(clientId, text, date);
      if (r.error) setErr(r.error);
      else setMsg("Saved.");
    });
  };
  const send = () => {
    if (!clientId) { setErr("Pick a client first."); return; }
    if (!text.trim()) { setErr("Nothing to send — write or generate it first."); return; }
    setErr(null); setMsg(null);
    start(async () => {
      const s = await saveAction(clientId, text, date);
      if (s.error) { setErr(s.error); return; }
      const r = await sendAction!(clientId, date);
      if (r.error) setErr(r.error);
      else setMsg("Sent to client.");
    });
  };

  const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <b style={{ fontSize: 12.5 }}>{label}</b>
        <span style={{ flex: 1 }} />
        {aiAction && <button type="button" onClick={generate} disabled={busy} style={{ ...btn, color: "var(--brand-text)", background: "var(--brand-tint)" }}>{busy ? "Working…" : "✨ Generate"}</button>}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Generate with AI, or write the summary here…" style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff", resize: "vertical", boxSizing: "border-box" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <button type="button" onClick={save} disabled={busy} style={{ ...btn, border: "none", background: "var(--ink)", color: "#fff" }}>{busy ? "Saving…" : "Save"}</button>
        {sendAction && <button type="button" onClick={send} disabled={busy} style={{ ...btn, border: "none", background: "var(--brand-fill)", color: "#fff" }}>Send to client</button>}
        {msg && <span style={{ color: "var(--green-text)", fontSize: 12 }}>{msg}</span>}
        {err && <span style={{ color: "var(--red-text)", fontSize: 12 }}>{err}</span>}
      </div>
    </div>
  );
}
