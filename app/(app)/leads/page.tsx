import { createClient } from "@/lib/supabase/server";
import LeadStageSelect from "@/components/LeadStageSelect";

export const dynamic = "force-dynamic";

type Lead = {
  id: string;
  name: string;
  phone: string | null;
  source: string | null;
  interest: string | null;
  stage: string | null;
  fde: string | null;
  notes: string | null;
};

export default async function LeadsPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, name, phone, source, interest, stage, fde, notes")
    .order("num", { ascending: true });

  const leads = (data ?? []) as Lead[];

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Leads</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        Pipeline · live from Supabase · {leads.length} lead{leads.length === 1 ? "" : "s"}
      </p>

      {error ? (
        <div style={{ background: "var(--red-bg)", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 14 }}>
          <b>Couldn&apos;t load leads.</b> {error.message}
        </div>
      ) : (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12 }}>
                <th style={{ padding: "12px 16px" }}>Lead</th>
                <th style={{ padding: "12px 16px" }}>Interest</th>
                <th style={{ padding: "12px 16px" }}>Source</th>
                <th style={{ padding: "12px 16px" }}>FDE</th>
                <th style={{ padding: "12px 16px" }}>Stage</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <b>{l.name}</b>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{l.phone ?? "—"}</div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>{l.interest ?? "—"}</td>
                  <td style={{ padding: "12px 16px" }}>{l.source ?? "—"}</td>
                  <td style={{ padding: "12px 16px" }}>{l.fde ?? "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <LeadStageSelect id={l.id} stage={l.stage ?? "1-New Lead"} />
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)" }}>
                    No leads yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
