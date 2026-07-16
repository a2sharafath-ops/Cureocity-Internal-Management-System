"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createPortalLogin, type InviteState } from "@/lib/actions";

const input: React.CSSProperties = {
  width: "100%", padding: "8px 10px", border: "1px solid var(--border)",
  borderRadius: 8, fontSize: 14, background: "#fff",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}>
      {pending ? "Creating…" : "Create portal login"}
    </button>
  );
}

export default function PortalLoginForm({
  clientId, existingEmail,
}: { clientId: string; existingEmail: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState<InviteState, FormData>(createPortalLogin, {});

  if (existingEmail && !state.ok) {
    return (
      <div style={{ fontSize: 13, color: "var(--muted)" }}>
        Portal login active: <b style={{ color: "var(--ink)" }}>{existingEmail}</b>
      </div>
    );
  }

  return (
    <div>
      {state.ok ? (
        <div style={{ background: "var(--green-bg)", color: "#166534", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>{state.ok}</div>
      ) : !open ? (
        <button type="button" onClick={() => setOpen(true)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 13, cursor: "pointer" }}>
          + Create portal login
        </button>
      ) : (
        <form action={action} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 460 }}>
          <input type="hidden" name="client_id" value={clientId} />
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Client email</label>
            <input style={input} type="email" name="email" required placeholder="client@email.com" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Temporary password</label>
            <input style={input} name="password" required minLength={6} placeholder="min 6 characters" />
          </div>
          {state.error && (
            <div style={{ gridColumn: "1 / -1", background: "var(--red-bg)", color: "#991b1b", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>{state.error}</div>
          )}
          <div style={{ gridColumn: "1 / -1" }}><SubmitButton /></div>
        </form>
      )}
    </div>
  );
}
