"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import {
  generateSuperAdminCopilotDraft,
  type SuperAdminCopilotState,
} from "@/lib/staff-copilot-actions";
import {
  CUREOCITY_ASSISTANT_NAME,
  CUREOCITY_ASSISTANT_VOICE_LABEL,
  type StaffAssistantSurface,
} from "@/lib/staff-copilot";
import {
  generateStaffNavigationDraft,
  type StaffNavigationAssistantState,
} from "@/lib/staff-navigation-assistant-actions";
import {
  generateFrontDeskOperationalDraft,
  type FrontDeskAssistantState,
} from "@/lib/front-desk-assistant-actions";
import { FRONT_DESK_WORKFLOWS } from "@/lib/front-desk-assistant";
import { SUPER_ADMIN_COPILOT_TASKS } from "@/lib/super-admin-copilot";

const input: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "10px 11px",
  background: "#fff",
  color: "var(--ink)",
  font: "inherit",
  fontSize: 13,
  boxSizing: "border-box",
};

function SuperAdminQuickDraft() {
  const [state, action, pending] = useActionState<SuperAdminCopilotState, FormData>(
    generateSuperAdminCopilotDraft,
    {},
  );

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <form action={action} style={{ display: "grid", gap: 9 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
          Review-only task
          <select name="task_type" style={input}>
            {SUPER_ADMIN_COPILOT_TASKS.map((task) => (
              <option key={task.key} value={task.key}>{task.label}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
          What should the Assistant focus on?
          <textarea
            name="instruction"
            rows={4}
            maxLength={1500}
            placeholder="Do not enter names, emails, client details, clinical information, credentials, or instructions to perform an action."
            style={{ ...input, resize: "vertical", lineHeight: 1.45 }}
          />
        </label>
        {state.error && (
          <div role="alert" style={{ borderRadius: 9, padding: "9px 10px", background: "var(--red-bg)", color: "var(--red-text)", fontSize: 12 }}>
            {state.error}
          </div>
        )}
        <button
          type="submit"
          disabled={pending}
          style={{ border: 0, borderRadius: 10, padding: "10px 13px", background: "var(--ink)", color: "#fff", fontWeight: 750, cursor: pending ? "default" : "pointer", opacity: pending ? 0.65 : 1 }}
        >
          {pending ? "Preparing review draft…" : "Generate review draft"}
        </button>
      </form>

      {state.draft && (
        <section aria-label="Generated review draft" style={{ border: "1px solid var(--border)", borderRadius: 11, padding: 12, display: "grid", gap: 8, background: "var(--neutral-bg)" }}>
          <div style={{ color: "#5b21b6", fontSize: 10.5, fontWeight: 800 }}>AI-ASSISTED DRAFT · NO ACTION</div>
          <b style={{ fontSize: 13.5 }}>{state.draft.title}</b>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.5 }}>{state.draft.text}</div>
          {state.draft.caution && <div style={{ color: "var(--amber-text)", fontSize: 11.5 }}><b>Check carefully:</b> {state.draft.caution}</div>}
          <div style={{ color: "var(--muted)", fontSize: 11 }}>
            Continue in the full workspace to review, edit, accept, or discard this saved draft. Nothing was sent, changed, approved, or applied.
          </div>
        </section>
      )}
    </div>
  );
}

function StaffNavigationQuickDraft() {
  const [state, action, pending] = useActionState<StaffNavigationAssistantState, FormData>(
    generateStaffNavigationDraft,
    {},
  );

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <form action={action} style={{ display: "grid", gap: 9 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
          Which Cureocity area do you want to find?
          <textarea
            name="instruction"
            rows={4}
            maxLength={500}
            placeholder="Example: Where can I report an app bug? Do not enter names, contact details, client information, credentials, or record content."
            style={{ ...input, resize: "vertical", lineHeight: 1.45 }}
          />
        </label>
        {state.error && (
          <div role="alert" style={{ borderRadius: 9, padding: "9px 10px", background: "var(--red-bg)", color: "var(--red-text)", fontSize: 12 }}>
            {state.error}
          </div>
        )}
        <button type="submit" disabled={pending} style={{ border: 0, borderRadius: 10, padding: "10px 13px", background: "var(--ink)", color: "#fff", fontWeight: 750, cursor: pending ? "default" : "pointer", opacity: pending ? 0.65 : 1 }}>
          {pending ? "Preparing checklist…" : "Prepare navigation checklist"}
        </button>
      </form>
      {state.draft && (
        <section aria-label="Generated navigation checklist" style={{ border: "1px solid var(--border)", borderRadius: 11, padding: 12, display: "grid", gap: 8, background: "var(--neutral-bg)" }}>
          <div style={{ color: "#5b21b6", fontSize: 10.5, fontWeight: 800 }}>DETERMINISTIC DRAFT · NO AI CALL · NO ACTION</div>
          <b style={{ fontSize: 13.5 }}>{state.draft.title}</b>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.5 }}>{state.draft.text}</div>
          <div style={{ color: "var(--amber-text)", fontSize: 11.5 }}><b>Boundary:</b> {state.draft.caution}</div>
          <div style={{ color: "var(--muted)", fontSize: 11 }}>Continue in the full workspace to review, accept, discard, or inspect route evidence. Record details cannot be added.</div>
        </section>
      )}
    </div>
  );
}

function FrontDeskQuickDraft() {
  const [state, action, pending] = useActionState<FrontDeskAssistantState, FormData>(
    generateFrontDeskOperationalDraft,
    {},
  );

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <form action={action} style={{ display: "grid", gap: 9 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
          Front Desk workflow
          <select name="workflow_key" defaultValue="lead_intake" style={input}>
            {FRONT_DESK_WORKFLOWS.map((workflow) => (
              <option key={workflow.key} value={workflow.key}>{workflow.label}</option>
            ))}
          </select>
        </label>
        <div style={{ color: "var(--muted)", fontSize: 11.5, lineHeight: 1.45 }}>
          No names or record details are requested. The Assistant uses only the selected workflow key and versioned static route metadata.
        </div>
        {state.error && (
          <div role="alert" style={{ borderRadius: 9, padding: "9px 10px", background: "var(--red-bg)", color: "var(--red-text)", fontSize: 12 }}>
            {state.error}
          </div>
        )}
        <button type="submit" disabled={pending} style={{ border: 0, borderRadius: 10, padding: "10px 13px", background: "var(--ink)", color: "#fff", fontWeight: 750, cursor: pending ? "default" : "pointer", opacity: pending ? 0.65 : 1 }}>
          {pending ? "Preparing checklist…" : "Prepare operational checklist"}
        </button>
      </form>
      {state.draft && (
        <section aria-label="Generated Front Desk operational checklist" style={{ border: "1px solid var(--border)", borderRadius: 11, padding: 12, display: "grid", gap: 8, background: "var(--neutral-bg)" }}>
          <div style={{ color: "#5b21b6", fontSize: 10.5, fontWeight: 800 }}>DETERMINISTIC DRAFT · STATIC ROUTES · NO AI CALL · NO ACTION</div>
          <b style={{ fontSize: 13.5 }}>{state.draft.title}</b>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.5 }}>{state.draft.text}</div>
          <div style={{ color: "var(--amber-text)", fontSize: 11.5 }}><b>Boundary:</b> {state.draft.caution}</div>
          <div style={{ color: "var(--muted)", fontSize: 11 }}>Continue in the full workspace to review, edit, accept, discard, or inspect route evidence.</div>
        </section>
      )}
    </div>
  );
}

export default function CureocityAssistantLauncher({ surface }: { surface: StaffAssistantSurface }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const launcherButton = launcherRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      launcherButton?.focus();
    };
  }, [open]);

  if (!surface.visible) return null;

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        style={{
          position: "fixed",
          right: 22,
          bottom: 22,
          zIndex: 40,
          border: "1px solid rgba(255,255,255,0.5)",
          borderRadius: 999,
          padding: "11px 16px",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "linear-gradient(135deg, #8E0E15, #e11f34)",
          color: "#fff",
          boxShadow: "0 12px 30px rgba(105, 12, 22, 0.28)",
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        <span aria-hidden="true">✦</span>
        {CUREOCITY_ASSISTANT_NAME}
      </button>

      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80 }}>
          <button
            type="button"
            aria-label="Close Cureocity Assistant"
            onClick={() => setOpen(false)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, padding: 0, background: "rgba(15, 23, 42, 0.34)", cursor: "default" }}
          />
          <aside
            id={panelId}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: "min(440px, calc(100vw - 20px))",
              height: "100%",
              overflowY: "auto",
              background: "var(--bg)",
              boxShadow: "-18px 0 46px rgba(15, 23, 42, 0.2)",
              padding: 18,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: "var(--brand-fill)", color: "#fff", display: "grid", placeItems: "center", fontSize: 17, flexShrink: 0 }} aria-hidden="true">✦</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 id={titleId} style={{ margin: 0, fontSize: 19 }}>{CUREOCITY_ASSISTANT_NAME}</h2>
                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{surface.role} · review-first assistance</div>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close Cureocity Assistant panel"
                style={{ border: "1px solid var(--border)", borderRadius: 999, width: 34, height: 34, background: "var(--card)", color: "var(--ink)", fontSize: 18, cursor: "pointer" }}
              >
                ×
              </button>
            </div>

            <p id={descriptionId} style={{ margin: "14px 0", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.55 }}>
              Ask for help without leaving this page. The Assistant uses only capabilities approved for your real staff role. It cannot send, approve, publish, pay, change access, or update records by itself.
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <span style={{ borderRadius: 999, padding: "4px 9px", background: surface.enabled ? "var(--green-bg)" : "var(--amber-bg)", color: surface.enabled ? "var(--green-text)" : "var(--amber-text)", fontSize: 11, fontWeight: 800 }}>
                {surface.enabled ? "Available" : surface.functional ? "Configured pilot · currently off" : "Scope not approved"}
              </span>
              <Link href={surface.fullWorkspaceHref} style={{ color: "var(--brand)", fontSize: 12, fontWeight: 750 }}>
                Open full workspace and history →
              </Link>
            </div>

            {surface.reasons.length > 0 && (
              <ul style={{ margin: "0 0 14px", padding: "10px 10px 10px 28px", borderRadius: 10, background: "var(--amber-bg)", color: "var(--amber-text)", fontSize: 12, lineHeight: 1.45 }}>
                {surface.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            )}

            {surface.allowedTasks.length > 0 && (
              <details style={{ marginBottom: 14 }}>
                <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 800 }}>Approved assistance for this role</summary>
                <ul style={{ margin: "8px 0 0", paddingLeft: 20, color: "var(--muted)", fontSize: 12, lineHeight: 1.45 }}>
                  {surface.allowedTasks.map((task) => <li key={task}>{task}</li>)}
                </ul>
              </details>
            )}

            {surface.quickPromptKind === "super_admin" ? (
              <SuperAdminQuickDraft />
            ) : surface.quickPromptKind === "staff_navigation" ? (
              <StaffNavigationQuickDraft />
            ) : surface.quickPromptKind === "front_desk_checklist" ? (
              <FrontDeskQuickDraft />
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                  Ask Cureocity Assistant
                  <textarea
                    disabled
                    rows={4}
                    aria-describedby={`${descriptionId}-text-help`}
                    placeholder="Text input is unavailable for this role or configuration."
                    style={{ ...input, resize: "none", background: "var(--neutral-bg)", cursor: "not-allowed" }}
                  />
                </label>
                <div id={`${descriptionId}-text-help`} style={{ color: "var(--muted)", fontSize: 11.5, lineHeight: 1.45 }}>
                  {surface.quickPromptHelp}
                </div>
                <button type="button" disabled style={{ border: 0, borderRadius: 10, padding: "10px 13px", background: "var(--ink)", color: "#fff", fontWeight: 750, opacity: 0.45, cursor: "not-allowed" }}>
                  Send
                </button>
              </div>
            )}

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                disabled
                aria-label="Voice input coming soon; microphone access is disabled"
                title="Coming soon after explicit privacy, consent, retention, and voice-provider approval"
                style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", background: "var(--neutral-bg)", color: "var(--muted)", fontWeight: 750, cursor: "not-allowed" }}
              >
                🎙 {CUREOCITY_ASSISTANT_VOICE_LABEL}
              </button>
              <p style={{ margin: "7px 0 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.4 }}>
                Voice is not active. Cureocity Assistant does not request microphone permission, record audio, or store a transcript. It requires separate privacy, consent, retention, and provider approval before implementation.
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
