"use client";

import { useState } from "react";
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
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--brand-fill)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>
            ✚
          </div>
          <b style={{ fontSize: 18 }}>Cureocity</b>
        </div>
        <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>Sign in</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>
          Internal Management System
        </p>

        <label style={{ fontSize: 12, color: "var(--muted)" }}>Email</label>
        <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />

        <div style={{ height: 12 }} />
        <label style={{ fontSize: 12, color: "var(--muted)" }}>Password</label>
        <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />

        {error && (
          <div style={{ marginTop: 12, background: "var(--red-bg)", color: "#991b1b", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
            {error}
          </div>
        )}

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
