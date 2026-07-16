import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic"; // always fetch fresh during development

type PackageRow = { name: string; sessions: number; is_facility: boolean } | null;
type ClientRow = {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  used: number;
  branch: string | null;
  joined: string | null;
  packages: PackageRow;
};

function schedLabel(c: ClientRow) {
  const p = c.packages;
  if (!p) return "—";
  if (p.is_facility) return "Facility access";
  if (p.sessions > 0) return `${c.used} / ${p.sessions} sessions`;
  return "—";
}

export default async function ClientsPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, code, name, phone, used, branch, joined, packages(name, sessions, is_facility)")
    .order("code", { ascending: true });

  const clients = (data ?? []) as unknown as ClientRow[];

  return (
    <main style={{ minHeight: "100vh", padding: "28px 20px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div
            style={{
              width: 34, height: 34, borderRadius: 9, background: "var(--sidebar)",
              color: "#fff", display: "grid", placeItems: "center", fontWeight: 800,
            }}
          >
            ✚
          </div>
          <b style={{ fontSize: 18 }}>Cureocity</b>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>· Clients</span>
          <span style={{ flex: 1 }} />
          <Link href="/" style={{ color: "var(--teal-dark)", fontSize: 13, textDecoration: "none" }}>
            ← Home
          </Link>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
          Live from Supabase · {clients.length} client{clients.length === 1 ? "" : "s"}
        </p>

        {error ? (
          <div
            style={{
              background: "var(--red-bg)", color: "#991b1b", border: "1px solid #fecaca",
              borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 14,
            }}
          >
            <b>Couldn&apos;t load clients.</b> {error.message}
            <div style={{ marginTop: 6, color: "#7f1d1d", fontSize: 12 }}>
              Check that the schema was run and the Supabase keys in .env.local are correct
              (restart the dev server after changing them).
            </div>
          </div>
        ) : (
          <div
            style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12 }}>
                  <th style={{ padding: "12px 16px" }}>Client</th>
                  <th style={{ padding: "12px 16px" }}>Package</th>
                  <th style={{ padding: "12px 16px" }}>Sessions</th>
                  <th style={{ padding: "12px 16px" }}>Branch</th>
                  <th style={{ padding: "12px 16px" }}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <b>{c.name}</b>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>
                        {c.code ?? "—"} · {c.phone ?? "—"}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          background: "var(--teal-light)", color: "var(--teal-dark)",
                          borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600,
                        }}
                      >
                        {c.packages?.name ?? "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{schedLabel(c)}</td>
                    <td style={{ padding: "12px 16px" }}>{c.branch ?? "—"}</td>
                    <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{c.joined ?? "—"}</td>
                  </tr>
                ))}
                {clients.length === 0 && !error && (
                  <tr>
                    <td colSpan={5} style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)" }}>
                      No clients yet — did the seed run in the SQL editor?
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
