import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { consultQ } from "@/lib/consult-questions";
import PrintTrigger from "@/components/PrintTrigger";

export const dynamic = "force-dynamic";

// Printable consultation summary — the branded document the clinician previews
// and the client receives. RLS gates access: staff see any consultation; a
// client only their own once it's shared. Browser "Save as PDF" — no library.
export default async function ConsultPrintPage({
  params, searchParams,
}: { params: { id: string }; searchParams: { auto?: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("consultations")
    .select("id, kind, status, summary, flags, by_name, created_at, client_id, clients(name, code)")
    .eq("id", params.id)
    .maybeSingle();
  if (!data) notFound();
  const c = data as unknown as {
    kind: string; status: string; summary: string | null;
    flags: { text: string; severity: string }[] | null;
    by_name: string | null; created_at: string | null;
    clients: { name: string; code: string | null } | null;
  };
  const q = consultQ(c.kind);
  const flags = (c.flags ?? []) as { text: string; severity: string }[];
  const created = c.created_at ? new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "";
  const sevColor: Record<string, string> = { critical: "#b91c1c", warning: "#b45309", info: "#0369a1" };

  return (
    <div style={{ background: "#f3f4f6", minHeight: "100vh", padding: "24px 0" }}>
      <style>{`
        @media print { .no-print { display: none !important; } body { background: #fff !important; }
          .sheet { box-shadow: none !important; margin: 0 !important; } @page { size: A4; margin: 16mm; } }
      `}</style>

      <div className="no-print" style={{ maxWidth: 720, margin: "0 auto 14px", display: "flex", justifyContent: "flex-end", padding: "0 8px" }}>
        <PrintTrigger auto={searchParams.auto === "1"} />
      </div>

      <div className="sheet" style={{ maxWidth: 720, margin: "0 auto", background: "#fff", borderRadius: 8, boxShadow: "0 1px 6px rgba(0,0,0,.12)", padding: "40px 44px", color: "#111", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {/* Letterhead */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: "2px solid #111", paddingBottom: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.5px" }}>Cureocity</div>
            <div style={{ fontSize: 12, color: "#666" }}>{q.label}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#444" }}>
            <div>{c.status === "completed" ? "Completed" : "Draft"}</div>
            <div>{created}</div>
          </div>
        </div>

        {/* Client */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: "#888" }}>Prepared for</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{c.clients?.name ?? "Client"}</div>
          {c.clients?.code && <div style={{ fontSize: 12, color: "#666" }}>{c.clients.code}</div>}
        </div>

        {/* Summary */}
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: "#888", marginBottom: 6 }}>Consultation summary</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", minHeight: 60 }}>{c.summary?.trim() || "No summary recorded."}</div>

        {/* Flags */}
        {flags.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: "#888", marginBottom: 6 }}>Clinical flags</div>
            {flags.map((f, i) => (
              <div key={i} style={{ fontSize: 13, padding: "5px 0", borderTop: i ? "1px solid #eef0f1" : "none" }}>
                <span style={{ color: sevColor[f.severity] ?? "#444", fontWeight: 700, textTransform: "uppercase", fontSize: 10.5, marginRight: 8 }}>{f.severity}</span>
                {f.text}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 34, paddingTop: 12, borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#777" }}>
          <span>{c.by_name ? `By ${c.by_name}` : "Cureocity Care Team"}</span>
          <span>Cureocity · Kochi</span>
        </div>
      </div>
    </div>
  );
}
