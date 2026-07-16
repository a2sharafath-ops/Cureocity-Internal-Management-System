import Sidebar from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <header
          style={{
            height: 56,
            background: "var(--card)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            padding: "0 24px",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <span style={{ color: "var(--muted)", fontSize: 13 }}>
            Cureocity — Internal Management System
          </span>
          <span style={{ flex: 1 }} />
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
            }}
          >
            <span
              style={{
                width: 28, height: 28, borderRadius: "50%", background: "var(--teal)",
                color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12,
              }}
            >
              SA
            </span>
            <b style={{ fontSize: 13 }}>Sharafath</b>
            <span style={{ color: "var(--muted)" }}>· Administrator</span>
          </span>
        </header>
        <main style={{ padding: "24px" }}>{children}</main>
      </div>
    </div>
  );
}
