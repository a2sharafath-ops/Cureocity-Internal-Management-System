"use client";

import { useEffect } from "react";

type RuntimeError = Error & { digest?: string };

export default function RuntimeErrorView({
  error,
  reset,
  audience = "staff",
  global = false,
}: {
  error: RuntimeError;
  reset: () => void;
  audience?: "staff" | "client";
  global?: boolean;
}) {
  useEffect(() => {
    // Keep client diagnostics intentionally sparse; the server request hook
    // records server failures without sending data to an external service.
    console.error("[client-runtime-error]", JSON.stringify({
      event: "client_error_boundary",
      scope: audience,
      name: error.name,
      digest: error.digest,
    }));
  }, [audience, error]);

  const home = audience === "client" ? "/portal" : "/dashboard";
  const support = audience === "client" ? "the front desk" : "your administrator";

  return (
    <div style={{
      minHeight: global ? "100vh" : "min(70vh, 680px)",
      display: "grid",
      placeItems: "center",
      padding: 24,
      background: "var(--bg, #f6f7f8)",
      color: "var(--text, #17202a)",
      fontFamily: "var(--font-sans, system-ui, sans-serif)",
    }}>
      <main style={{
        width: "min(100%, 520px)",
        padding: "28px 30px",
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 16,
        background: "var(--card, #fff)",
        boxShadow: "0 12px 35px rgba(20,20,25,.08)",
      }}>
        <div aria-hidden="true" style={{ fontSize: 30, marginBottom: 12 }}>↻</div>
        <h1 style={{ margin: "0 0 10px", fontSize: 22 }}>We couldn&apos;t load this page</h1>
        <p style={{ margin: "0 0 20px", color: "var(--muted, #667085)", lineHeight: 1.55, fontSize: 14 }}>
          Your data was not changed. Try the request again. If it keeps failing,
          contact {support}{error.digest ? <> and share reference <code>{error.digest}</code></> : null}.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={reset} style={{ border: 0, borderRadius: 9, padding: "9px 15px", background: "var(--brand-fill, #405cf5)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            Try again
          </button>
          <a href={home} style={{ border: "1px solid var(--border, #d0d5dd)", borderRadius: 9, padding: "8px 14px", color: "inherit", textDecoration: "none", fontSize: 14 }}>
            Go to {audience === "client" ? "my portal" : "dashboard"}
          </a>
        </div>
      </main>
    </div>
  );
}
