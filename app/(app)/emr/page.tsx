import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import RealtimeRefresh from "@/components/RealtimeRefresh";

export const dynamic = "force-dynamic";

export default async function EmrIndexPage({ searchParams }: { searchParams: { q?: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/emr")) redirect("/dashboard");

  const q = (searchParams.q ?? "").trim();
  const supabase = createClient();
  let query = supabase.from("clients").select("id, code, name, phone, gender, dob").order("name");
  if (q) query = query.ilike("name", `%${q}%`);
  const { data } = await query.limit(200);
  const clients = (data ?? []) as { id: string; code: string | null; name: string; phone: string | null; gender: string | null; dob: string | null }[];

  // counts for active problems / allergies across all patients (single queries)
  const [{ data: probs }, { data: alls }, { data: meds }] = await Promise.all([
    supabase.from("problems").select("client_id").eq("status", "active"),
    supabase.from("allergies").select("client_id"),
    supabase.from("medications").select("client_id").eq("status", "active"),
  ]);
  const tally = (rows: { client_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.client_id, (m.get(r.client_id) ?? 0) + 1);
    return m;
  };
  const pC = tally(probs), aC = tally(alls), mC = tally(meds);

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "10px 16px" };
  const pill = (n: number, color: string, bg: string) => n ? <span style={{ background: bg, color, borderRadius: 999, padding: "1px 8px", fontSize: 12, fontWeight: 600 }}>{n}</span> : <span style={{ color: "var(--muted)" }}>—</span>;

  return (
    <div style={{ maxWidth: 980 }}>
      <RealtimeRefresh tables={["problems", "allergies", "medications"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>EMR / Patient charts</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>Clinical records — problems, allergies, medications, vitals and SOAP notes. Access limited to clinicians.</p>

      <form style={{ marginBottom: 14 }}>
        <input name="q" defaultValue={q} placeholder="Search patients…" style={{ width: 280, padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, background: "#fff" }} />
      </form>

      <div style={{ ...box, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr><th style={th}>Patient</th><th style={th}>Code</th><th style={th}>Problems</th><th style={th}>Allergies</th><th style={th}>Meds</th><th style={th} /></tr></thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 600 }}>{c.name}</td>
                <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{c.code ?? "—"}</td>
                <td style={td}>{pill(pC.get(c.id) ?? 0, "#166534", "var(--green-bg)")}</td>
                <td style={td}>{pill(aC.get(c.id) ?? 0, "var(--red)", "#fee2e2")}</td>
                <td style={td}>{pill(mC.get(c.id) ?? 0, "var(--teal-dark)", "#e0f2f1")}</td>
                <td style={{ ...td, textAlign: "right" }}><Link href={`/emr/${c.id}`} style={{ color: "var(--teal-dark)", textDecoration: "none", fontWeight: 600 }}>Open chart →</Link></td>
              </tr>
            ))}
            {clients.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No patients found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
