"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { moduleScope } from "@/lib/deployment";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  // Branding logo (public read) — falls back to the bundled mark.
  const [logo, setLogo] = useState("/cureocity-mark.png?v=2");
  useEffect(() => {
    supabase.from("app_settings").select("data").eq("id", 1).maybeSingle().then(({ data }) => {
      const l = (data as { data?: { brand?: { logo?: string } } } | null)?.data?.brand?.logo;
      if (l) setLogo(l);
    });
  }, [supabase]);

  async function onForgot() {
    setError(null); setResetMsg(null);
    if (!email) { setError("Enter your email above first, then tap Forgot password."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { setError(error.message); return; }
    setResetMsg("Check your email for a reset link. It opens a page to set a new password.");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push(moduleScope()?.home ?? "/dashboard");
    router.refresh();
  }

  const input: React.CSSProperties = {
    width: "100%", padding: "10px 12px", border: "1px solid var(--border)",
    borderRadius: 10, fontSize: 14, background: "#fff", marginTop: 6,
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--bg)" }}>
      <form
        onSubmit={onSubmit}
        style={{
          width: "100%", maxWidth: 380, background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "28px 26px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "#fff", border: "1px solid var(--border)", display: "grid", placeItems: "center", overflow: "hidden" }}>
            <img src={logo} alt="Cureocity" style={{ maxWidth: 26, maxHeight: 26, display: "block" }} />
          </div>
          <b style={{ fontSize: 18 }}>Cureocity</b>
        </div>
        <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>Sign in</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>
          Sign in to Cureocity
        </p>

        <label htmlFor="login-email" style={{ fontSize: 12, color: "var(--muted)" }}>Email</label>
        <input id="login-email" style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />

        <div style={{ height: 12 }} />
        <label htmlFor="login-password" style={{ fontSize: 12, color: "var(--muted)" }}>Password</label>
        <input id="login-password" style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />

        {error && (
          <div style={{ marginTop: 12, background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
            {error}
          </div>
        )}
        {resetMsg && (
          <div style={{ marginTop: 12, background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
            {resetMsg}
          </div>
        )}

        <div style={{ marginTop: 10, textAlign: "right" }}>
          <button type="button" onClick={onForgot} style={{ background: "none", border: "none", padding: 0, color: "var(--brand-text)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 18, width: "100%", background: "var(--ink)", color: "#fff", border: "none",
            borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 600, cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
