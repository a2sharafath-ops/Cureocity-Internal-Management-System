"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { changePassword, type PwState } from "@/lib/actions";

const input: React.CSSProperties = {
  width: "100%", padding: "9px 11px", border: "1px solid var(--border)",
  borderRadius: 8, fontSize: 14, background: "#fff",
};
const label: React.CSSProperties = { display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4, marginTop: 12 };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        marginTop: 18, background: "var(--teal)", color: "#fff", border: "none", borderRadius: 10,
        padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: pending ? "default" : "pointer",
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? "Updating…" : "Update password"}
    </button>
  );
}

export default function ChangePasswordForm() {
  const [state, action] = useFormState<PwState, FormData>(changePassword, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form
      ref={formRef}
      action={action}
      style={{
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
        boxShadow: "var(--shadow)", padding: "20px 22px", maxWidth: 420,
      }}
    >
      <label style={{ ...label, marginTop: 0 }}>Current password</label>
      <input style={input} type="password" name="current" required autoComplete="current-password" />

      <label style={label}>New password</label>
      <input style={input} type="password" name="next" required minLength={6} autoComplete="new-password" />

      <label style={label}>Confirm new password</label>
      <input style={input} type="password" name="confirm" required minLength={6} autoComplete="new-password" />

      {state.error && (
        <div style={{ marginTop: 14, background: "var(--red-bg)", color: "#991b1b", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
          {state.error}
        </div>
      )}
      {state.ok && (
        <div style={{ marginTop: 14, background: "var(--green-bg)", color: "#166534", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
          {state.ok}
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
