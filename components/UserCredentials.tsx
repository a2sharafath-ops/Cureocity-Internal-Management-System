"use client";

// Credential controls for one staff login, on Users & Roles.
//
// Collapsed to a single "Sign-in" button until opened, because this is the
// destructive corner of the page and it shouldn't sit one stray click away
// from the role dropdown. Reset link is presented first and set-password
// second, on purpose: the first means nobody learns anyone's password.
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
};
const input: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 8, padding: "6px 9px",
  fontSize: 12.5, background: "#fff", minWidth: 0, flex: 1,
};

function Submit({ label, busy, wide }: { label: string; busy: string; wide?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ ...btn, ...(wide ? { width: "100%" } : null), opacity: pending ? 0.6 : 1 }}>
      {pending ? busy : label}
    </button>
  );
}

function Result({ state }: { state: CredState }) {
  if (!state || (!state.ok && !state.error)) return null;
  const bad = Boolean(state.error);
  return (
    <div style={{
      fontSize: 11.5, marginTop: 5, padding: "5px 8px", borderRadius: 7,
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

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={btn}>Sign-in</button>;
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", minWidth: 290, textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 7 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--muted)" }}>
          Sign-in for {name}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setOpen(false)} style={{ ...btn, border: "none", background: "transparent", color: "var(--muted)", padding: 2 }}>✕</button>
      </div>

      {isSelf && (
        <div style={{ fontSize: 11.5, color: "var(--amber-text)", background: "var(--amber-bg)", borderRadius: 7, padding: "5px 8px", marginBottom: 8 }}>
          This is your own account — changing the email here changes how you sign in.
        </div>
      )}

      <form action={emailAction} style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="hidden" name="id" value={id} />
        <input name="email" type="email" defaultValue={email ?? ""} placeholder="name@cureo.city" style={input} required />
        <Submit label="Save" busy="…" />
      </form>
      <Result state={emailState} />
      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3 }}>
        The old address is notified when this changes.
      </div>

      <div style={{ borderTop: "1px solid var(--border)", margin: "9px 0 8px" }} />

      <form action={resetAction}>
        <input type="hidden" name="id" value={id} />
        <Submit label="Send password reset link" busy="Sending…" wide />
      </form>
      <Result state={resetState} />

      {!showPw ? (
        <button type="button" onClick={() => setShowPw(true)}
          style={{ ...btn, border: "none", background: "transparent", color: "var(--muted)", padding: "6px 0 0", fontSize: 11.5 }}>
          Their email doesn&apos;t work? Set a password directly →
        </button>
      ) : (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 4 }}>
            Use only when they can&apos;t receive mail. You&apos;ll know their password — ask them to
            change it at /account once they&apos;re in. This is logged.
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
  );
}
