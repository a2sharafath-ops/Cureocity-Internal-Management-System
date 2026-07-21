"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { inviteStaff, type InviteState } from "@/lib/actions";
import { BRANCHES } from "@/lib/branches";

const ROLES = [
  "Front Desk", "Doctor", "Dietitian", "Fitness Trainer", "Health Coach", "Psychologist",
  "Manager", "Finance", "HR", "Staff", "Administrator", "Super Admin",
];

const input: React.CSSProperties = {
  width: "100%", padding: "0 10px", border: "1px solid var(--border)",
  borderRadius: 8, fontSize: 14, background: "#fff",
  height: 36, boxSizing: "border-box",
};
const label: React.CSSProperties = { display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10,
        padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: pending ? "default" : "pointer",
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? "Creating…" : "Create staff login"}
    </button>
  );
}

export default function AddStaffForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState<InviteState, FormData>(inviteStaff, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <div
      style={{
        marginBottom: 16, background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <b style={{ fontSize: 14 }}>Add staff</b>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}
        >
          {open ? "Cancel" : "+ New staff login"}
        </button>
      </div>

      {open && (
        <form ref={formRef} action={action} style={{ marginTop: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={label}>Full name</label>
              <input style={input} name="name" placeholder="e.g. Sini Antony" />
            </div>
            <div>
              <label style={label}>Email *</label>
              <input style={input} type="email" name="email" placeholder="name@cureo.city" required />
            </div>
            <div>
              <label style={label}>Role</label>
              <select style={input} name="role" defaultValue="Front Desk">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Branch</label>
              <select style={input} name="branch" defaultValue="Kochi">
                {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Temporary password *</label>
              <input style={input} name="password" placeholder="min 6 characters" required minLength={6} />
            </div>
          </div>

          {state.error && (
            <div style={{ marginTop: 12, background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
              {state.error}
            </div>
          )}
          {state.ok && (
            <div style={{ marginTop: 12, background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
              {state.ok}
            </div>
          )}

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <SubmitButton />
            <span style={{ color: "var(--muted)", fontSize: 12 }}>
              They can sign in immediately with this email + temporary password.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
