"use client";

// Credential controls for one staff login, on Users & Roles.
//
// Labelled "Credentials", not "Sign-in": the label sits on a button, and a
// button reads as a verb, so "Sign-in" looked like it would sign you in as
// that person rather than open their details.
//
// Presented as a dropdown anchored to the button, floating above the table.
// It can't live inside the cell: that's the narrowest column on the page and
// the table card clips its overflow, so an inline panel gets sliced off at the
// right edge.
//
// The panel JSX is inline rather than a nested <Panel/> component — a
// component defined inside the render body is a new type on every render, so
// React remounts it and the half-typed email address is lost the moment
// anything else in the panel changes.
//
// React 18 / Next 14 here, so form state is useFormState from react-dom and
// pending comes from useFormStatus inside a child of the form — not React 19's
// useActionState, which doesn't exist in this runtime.

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { updateUserEmail, sendUserPasswordReset, setUserPassword, type CredState } from "@/lib/actions";

const btn: React.CSSProperties = {
  border: "1px solid var(--border)", background: "#fff", borderRadius: 8,
  padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--ink)",
  whiteSpace: "nowrap",
};
const input: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 8, padding: "6px 9px",
  fontSize: 12.5, background: "#fff", minWidth: 0, flex: 1, width: "100%",
};

function Submit({ label, busy, wide }: { label: string; busy: string; wide?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      style={{ ...btn, ...(wide ? { width: "100%" } : null), opacity: pending ? 0.6 : 1 }}>
      {pending ? busy : label}
    </button>
  );
}

function Result({ state }: { state: CredState }) {
  if (!state || (!state.ok && !state.error)) return null;
  const bad = Boolean(state.error);
  return (
    <div style={{
      fontSize: 11.5, marginTop: 5, padding: "5px 8px", borderRadius: 7, lineHeight: 1.4,
      background: bad ? "var(--red-bg)" : "var(--green-bg)",
      color: bad ? "var(--red-text)" : "var(--green-text)",
    }}>
      {state.error ?? state.ok}
    </div>
  );
}

export default function UserCredentials({
  id, email, name, isSelf,
}: { id: string; email: string | null; name: string; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [emailState, emailAction] = useFormState<CredState, FormData>(updateUserEmail, {});
  const [resetState, resetAction] = useFormState<CredState, FormData>(sendUserPasswordReset, {});
  const [pwState, pwAction] = useFormState<CredState, FormData>(setUserPassword, {});

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ ...btn, ...(open ? { borderColor: "var(--brand)", color: "var(--brand-text)" } : null) }}
      >
        Credentials
      </button>

      {open && (
        <>
          {/* click-away catcher: above the page, below the panel */}
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />

          <div
            role="dialog"
            aria-label={`Credentials for ${name}`}
            style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 41,
              width: 320, textAlign: "left", cursor: "auto",
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10,
              padding: "11px 13px", boxShadow: "0 12px 34px rgba(20,20,25,0.18)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--muted)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Credentials — {name}
              </span>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                style={{ ...btn, border: "none", background: "transparent", color: "var(--muted)", padding: 2 }}>
                ✕
              </button>
            </div>

            {isSelf && (
              <div style={{ fontSize: 11.5, lineHeight: 1.4, color: "var(--amber-text)", background: "var(--amber-bg)", borderRadius: 7, padding: "6px 8px", marginBottom: 9 }}>
                This is your own account — changing the email here changes how you sign in.
              </div>
            )}

            <form action={emailAction} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="hidden" name="id" value={id} />
              <input name="email" type="email" defaultValue={email ?? ""} placeholder="name@cureo.city" style={input} required />
              <Submit label="Save" busy="…" />
            </form>
            <Result state={emailState} />
            <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4, lineHeight: 1.4 }}>
              The old address is notified when this changes.
            </div>

            <div style={{ borderTop: "1px solid var(--border)", margin: "10px 0 9px" }} />

            <form action={resetAction}>
              <input type="hidden" name="id" value={id} />
              <Submit label="Send password reset link" busy="Sending…" wide />
            </form>
            <Result state={resetState} />

            {!showPw ? (
              <button type="button" onClick={() => setShowPw(true)}
                style={{ ...btn, border: "none", background: "transparent", color: "var(--muted)", padding: "7px 0 0", fontSize: 11.5, whiteSpace: "normal", textAlign: "left" }}>
                Their email doesn&apos;t work? Set a password directly →
              </button>
            ) : (
              <div style={{ marginTop: 9 }}>
                <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 5, lineHeight: 1.45 }}>
                  Use only when they can&apos;t receive mail. You&apos;ll know their password — ask
                  them to change it at /account once they&apos;re in. This is logged.
                </div>
                <form action={pwAction} style={{ display: "flex", gap: 6 }}>
                  <input type="hidden" name="id" value={id} />
                  <input name="password" type="text" autoComplete="off" placeholder="Temporary password (8+)" minLength={8} style={input} required />
                  <Submit label="Set" busy="…" />
                </form>
                <Result state={pwState} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
