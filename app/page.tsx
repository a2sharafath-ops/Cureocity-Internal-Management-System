export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: "100%",
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow)",
          padding: "32px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "var(--sidebar)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: 20,
            }}
          >
            ✚
          </div>
          <b style={{ fontSize: 20 }}>Cureocity</b>
        </div>
        <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>
          Internal Management System
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
          Next.js + Tailwind + Supabase scaffold is live. This is the starting
          shell — features from the prototype will be ported in incrementally.
        </p>
        <div
          style={{
            marginTop: 20,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            fontSize: 12,
          }}
        >
          {["Next.js 14", "TypeScript", "Tailwind", "Supabase", "Vercel"].map(
            (t) => (
              <span
                key={t}
                style={{
                  background: "var(--teal-light)",
                  color: "var(--teal-dark)",
                  borderRadius: 999,
                  padding: "4px 10px",
                  fontWeight: 600,
                }}
              >
                {t}
              </span>
            )
          )}
        </div>
        <div style={{ marginTop: 24 }}>
          <a
            href="/clients"
            style={{
              display: "inline-block",
              background: "var(--teal)",
              color: "#fff",
              borderRadius: 10,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            View Clients (live from Supabase) →
          </a>
        </div>
      </div>
    </main>
  );
}
