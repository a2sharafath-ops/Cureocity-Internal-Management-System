import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canManagePackages } from "@/lib/roles";
import PackageToggle from "@/components/PackageToggle";

export const dynamic = "force-dynamic";

type Pkg = {
  id: string;
  name: string;
  sessions: number;
  validity: number;
  price: number;
  is_facility: boolean;
  active: boolean;
};

function money(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

function kind(p: Pkg) {
  if (p.is_facility) return "Facility access";
  if (p.id.startsWith("comp")) return "Comprehensive";
  if (p.id.startsWith("pt")) return "Personal Training";
  if (p.id === "bp1") return "BluePrint";
  return "—";
}

export default async function PackagesPage() {
  const me = await getProfile();
  const manager = canManagePackages(me?.role ?? "");

  const supabase = createClient();
  const { data, error } = await supabase
    .from("packages")
    .select("id, name, sessions, validity, price, is_facility, active")
    .order("price", { ascending: true });

  const pkgs = (data ?? []) as Pkg[];

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Packages</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        Product catalog · {pkgs.filter((p) => p.active).length} active of {pkgs.length}
      </p>

      {error ? (
        <div style={{ background: "var(--red-bg)", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 14 }}>
          <b>Couldn&apos;t load packages.</b> {error.message}
        </div>
      ) : (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12 }}>
                <th style={{ padding: "12px 16px" }}>Package</th>
                <th style={{ padding: "12px 16px" }}>Type</th>
                <th style={{ padding: "12px 16px" }}>Sessions</th>
                <th style={{ padding: "12px 16px" }}>Validity</th>
                <th style={{ padding: "12px 16px" }}>Price</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                {manager && <th style={{ padding: "12px 16px" }} />}
              </tr>
            </thead>
            <tbody>
              {pkgs.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid var(--border)", opacity: p.active ? 1 : 0.55 }}>
                  <td style={{ padding: "12px 16px" }}><b>{p.name}</b></td>
                  <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{kind(p)}</td>
                  <td style={{ padding: "12px 16px" }}>{p.is_facility ? "—" : p.sessions}</td>
                  <td style={{ padding: "12px 16px" }}>{p.validity} days</td>
                  <td style={{ padding: "12px 16px" }}><b>{money(p.price)}</b></td>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600,
                        background: p.active ? "var(--green-bg)" : "#eef2f1",
                        color: p.active ? "#166534" : "var(--muted)",
                      }}
                    >
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {manager && (
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <PackageToggle id={p.id} active={p.active} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
