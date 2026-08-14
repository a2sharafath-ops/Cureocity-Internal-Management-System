"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { ISSUE_SEVERITIES, ISSUE_TYPES } from "@/lib/issue-reports";
import { submitIssueReport, type IssueActionState } from "@/lib/issue-actions";

const input: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "9px 10px",
  background: "#fff",
  color: "var(--ink)",
  font: "inherit",
  fontSize: 13,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ border: 0, borderRadius: 9, padding: "9px 15px", background: "var(--ink)", color: "#fff", fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending ? 0.65 : 1 }}>
      {pending ? "Sending…" : "Submit report"}
    </button>
  );
}
function IssueReportForm({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const submissionKey = useId();
  const contextRef = useRef<HTMLInputElement>(null);
  const [state, action] = useActionState<IssueActionState, FormData>(submitIssueReport, {});

  useEffect(() => {
    if (!contextRef.current) return;
    contextRef.current.value = JSON.stringify({
      browser: navigator.userAgent.slice(0, 500),
      platform: navigator.platform.slice(0, 100),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    });
  }, [pathname]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="issue-report-title" style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(17,24,39,.46)", display: "grid", placeItems: "center", padding: 18 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div style={{ width: "min(100%, 560px)", maxHeight: "calc(100vh - 36px)", overflowY: "auto", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, boxShadow: "0 24px 70px rgba(0,0,0,.2)", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h2 id="issue-report-title" style={{ margin: 0, fontSize: 18 }}>Report an issue</h2>
            <p style={{ margin: "5px 0 0", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.45 }}>Tell the administrator what happened. The current page and basic browser details are attached automatically.</p>
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Close report form" style={{ border: 0, background: "transparent", fontSize: 20, cursor: "pointer", color: "var(--muted)" }}>×</button>
        </div>

        {state.ok ? (
          <div style={{ marginTop: 18, background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 10, padding: "14px 15px", fontSize: 13 }}>
            <b>{state.ok}</b>
            {state.warning && <div style={{ marginTop: 5, color: "var(--amber-text)" }}>{state.warning}</div>}
            <div style={{ marginTop: 12 }}><button type="button" onClick={onClose} style={{ border: "1px solid var(--border)", borderRadius: 8, background: "#fff", padding: "7px 12px", cursor: "pointer" }}>Close</button></div>
          </div>
        ) : (
          <form action={action} style={{ marginTop: 18, display: "grid", gap: 13 }}>
            <input type="hidden" name="route" value={pathname} />
            <input type="hidden" name="submission_key" value={submissionKey} />
            <input ref={contextRef} type="hidden" name="browser_context" defaultValue="{}" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 12, fontWeight: 650 }}>Type
                <select name="type" defaultValue="Bug" style={input}>{ISSUE_TYPES.map((value) => <option key={value}>{value}</option>)}</select>
              </label>
              <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 12, fontWeight: 650 }}>Severity
                <select name="severity" defaultValue="Medium" style={input}>{ISSUE_SEVERITIES.map((value) => <option key={value}>{value}</option>)}</select>
              </label>
            </div>
            <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 12, fontWeight: 650 }}>What happened?
              <textarea name="description" minLength={15} maxLength={4000} required rows={6} style={{ ...input, resize: "vertical", lineHeight: 1.45 }} placeholder="What were you trying to do, what did you expect, and what happened instead?" />
            </label>
            <div style={{ borderRadius: 9, background: "var(--neutral-bg)", padding: "9px 11px", color: "var(--muted)", fontSize: 11.5, lineHeight: 1.45 }}>
              Don&apos;t include passwords, access links, payment details, or clinical notes. Refer to a client only by opening their page first; the system records the internal client reference without copying their name.
            </div>
            <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 12, fontWeight: 650 }}>Screenshot (optional, max 5 MB)
              <input type="file" name="attachment" accept="image/png,image/jpeg,image/webp" style={{ ...input, padding: 7 }} />
              <span style={{ fontWeight: 400, fontSize: 11 }}>Review the image first and remove any patient, password, payment, or private information.</span>
            </label>
            {state.error && <div role="alert" style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 9, padding: "9px 11px", fontSize: 12.5 }}>{state.error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 9 }}>
              <button type="button" onClick={onClose} style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "8px 13px", background: "#fff", cursor: "pointer" }}>Cancel</button>
              <SubmitButton />
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function IssueReportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Report an issue" style={{ border: "1px solid rgba(20,20,25,0.07)", background: "rgba(255,255,255,0.55)", borderRadius: 999, padding: "7px 11px", cursor: "pointer", color: "var(--muted)", fontSize: 12, fontWeight: 650, whiteSpace: "nowrap" }}>
        ⚑ Report issue
      </button>
      {open && <IssueReportForm onClose={() => setOpen(false)} />}
    </>
  );
}
