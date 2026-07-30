"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { AiState } from "@/lib/ai";

function Btn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1, whiteSpace: "nowrap" }}>
      {pending ? "Generating…" : `✨ ${label}`}
    </button>
  );
}

export default function AiSummaryButton({
  action, label, clientId, date,
}: {
  action: (prev: AiState, formData: FormData) => Promise<AiState>;
  label: string;
  clientId: string;
  date?: string;
}) {
  const [state, formAction] = useFormState<AiState, FormData>(action, {});
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="client_id" value={clientId} />
        {date !== undefined && <input type="hidden" name="date" value={date} />}
        <Btn label={label} />
      </form>
      {state.error && <div style={{ color: "var(--red-text)", fontSize: 12, marginTop: 6 }}>{state.error}</div>}
      {state.text && (
        <div style={{ marginTop: 8, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700, letterSpacing: ".4px", textTransform: "uppercase" }}>{label} · AI draft — review before use</span>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={() => { navigator.clipboard?.writeText(state.text ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 12, cursor: "pointer" }}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.5 }}>{state.text}</div>
        </div>
      )}
    </div>
  );
}
