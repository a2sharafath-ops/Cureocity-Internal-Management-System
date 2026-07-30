"use client";

// Password-recovery landing page. Supabase's recovery email link drops the user
// here with a temporary recovery session already established (the client parses
// the token from the URL on load). Without this page the recovery session just
// logged them into the dashboard with no way to actually set a new password.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // The recovery token is exchanged for a session automatically on load; give
    // it a tick, then check. Also listen for the PASSWORD_RECOVERY event in case
    // it lands just after mount.
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setHasSession(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    if (password !== confirm) { setError("The two passwords don't match."); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setSaving(false); return; }
    setDone(true);
    setSaving(false);
  }

  const input: React.CSSProperties = {
    width: "100%", padding: "10px 12px", border: "1px solid var(--border)",
    borderRadius: 10, fontSize: 14, background: "#fff", marginTop: 6,
  };
  const card: React.CSSProperties = {
    width: "100%", maxWidth: 380, background: "var(--card)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "28px 26px",
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--bg)" }}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--brand-fill)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>✚</div>
          <b style={{ fontSize: 18 }}>Cureocity</b>
        </div>

        {done ? (
          <>
            <h1 style={{ fontSize: 18, margin: "0 0 6px" }}>Password updated</h1>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>Your new password is set. You can continue to the dashboard.</p>
            <button onClick={() => { router.push("/dashboard"); router.refresh(); }} style={{ width: "100%", background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Go to dashboard</button>
          </>
        ) : !ready ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Checking your reset link…</p>
        ) : !hasSession ? (
          <>
            <h1 style={{ fontSize: 18, margin: "0 0 6px" }}>Reset link expired</h1>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>This reset link is invalid or has expired. Request a new one from the sign-in page.</p>
            <a href="/login" style={{ display: "block", textAlign: "center", background: "var(--ink)", color: "#fff", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Back to sign in</a>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>Set a new password</h1>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>Choose a new password for your account.</p>

            <label style={{ fontSize: 12, color: "var(--muted)" }}>New password</label>
            <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />

            <div style={{ height: 12 }} />
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Confirm new password</label>
            <input style={input} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />

            {error && <div style={{ marginTop: 12, background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>{error}</div>}

            <button type="submit" disabled={saving} style={{ marginTop: 18, width: "100%", background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>{saving ? "Saving…" : "Update password"}</button>
          </form>
        )}
      </div>
    </main>
  );
}
