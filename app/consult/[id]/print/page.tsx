import { IST } from "@/lib/datetime";
import { notFound } from "next/navigation";
import { printClient } from "@/lib/print-access";
import { consultQ } from "@/lib/consult-questions";
import { getAppSettings, brandLogo } from "@/lib/settings";
import PrintTrigger from "@/components/PrintTrigger";

export const dynamic = "force-dynamic";

// Printable consultation summary — the branded document the clinician previews
// and the client receives. RLS gates access: staff see any consultation; a
// client only their own once it's shared. Browser "Save as PDF" — no library.
export default async function ConsultPrintPage({
  params, searchParams,
}: { params: { id: string }; searchParams: { auto?: string; doc_token?: string } }) {
  // A renderer has no session, so a valid one-document token unlocks the
  // read. See lib/print-access.ts.
  const supabase = printClient("summary", params.id, searchParams.doc_token);
  const { data } = await supabase
    .from("consultations")
    .select("id, kind, status, summary, ai_summary, flags, by_name, created_at, client_id, clients(name, code)")
    .eq("id", params.id)
    .maybeSingle();
  if (!data) notFound();
  const c = data as unknown as {
    kind: string; status: string; summary: string | null; ai_summary: string | null;
    flags: { text: string; severity: string }[] | null;
    by_name: string | null; created_at: string | null;
    clients: { name: string; code: string | null } | null;
  };
  const q = consultQ(c.kind);
  const flags = (c.flags ?? []) as { text: string; severity: string }[];
  const created = c.created_at ? new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: IST }) : "";
  const createdTime = c.created_at ? new Date(c.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: IST }) : "";
  const sevColor: Record<string, string> = { critical: "#b91c1c", warning: "#b45309", info: "#0369a1" };
  const clientName = c.clients?.name ?? "Client";

  const settings = await getAppSettings();
  const lh = settings.letterhead;
  const logo = brandLogo(settings);

  // Shared letterhead + contact footer (editable in Templates & Branding).
  const Letterhead = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, borderBottom: "2px solid var(--brand-fill, #e11d48)", paddingBottom: 14, marginBottom: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img src={logo} alt="Cureocity" width={44} height={44} style={{ display: "block", maxWidth: 52, maxHeight: 52 }} />
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.5px", color: "#111" }}>Cureocity</div>
      </div>
      <div style={{ textAlign: "right", fontSize: 12, color: "#555", lineHeight: 1.5 }}>
        <div style={{ fontWeight: 800, color: "#111", fontSize: 14 }}>{lh.name}</div>
        <div>{lh.addr1}</div>
        <div>{lh.addr2}</div>
      </div>
    </div>
  );
  const ContactFooter = () => (
    <div className="page-footer" style={{ display: "flex", justifyContent: "space-between", gap: 12, borderTop: "1px solid #e5e7eb", paddingTop: 10, fontSize: 11.5, color: "#777" }}>
      <span>📞 {lh.phone}</span><span>✉ {lh.email}</span><span>🌐 {lh.website}</span>
    </div>
  );

  // ---- Diet consultation → branded letter template -------------------------
  if (c.kind === "Diet") {
    const paras = (c.summary?.trim() || "").split(/\n\s*\n|\n/).map((s) => s.trim()).filter(Boolean);
    return (
      <div style={{ background: "#f3f4f6", minHeight: "100vh", padding: "24px 0" }}>
        <style>{`@media print { .no-print { display:none !important; } body { background:#fff !important; } .sheet { box-shadow:none !important; margin:0 !important; } @page { size:A4; margin:16mm 16mm 22mm; } .page-footer { position:fixed; bottom:8mm; left:16mm; right:16mm; } }`}</style>
        <div className="no-print" style={{ maxWidth: 760, margin: "0 auto 14px", display: "flex", justifyContent: "flex-end", padding: "0 8px" }}>
          <PrintTrigger auto={searchParams.auto === "1"} />
        </div>
        <div className="sheet" style={{ maxWidth: 760, margin: "0 auto", background: "#fff", borderRadius: 8, boxShadow: "0 1px 6px rgba(0,0,0,.12)", padding: "40px 46px 64px", color: "#111", fontFamily: "system-ui, -apple-system, sans-serif" }}>
          <Letterhead />

          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 14 }}>Dear {clientName},</div>

          <div style={{ fontSize: 13, lineHeight: 1.65, textAlign: "justify", fontWeight: 600 }}>
            {paras.length ? paras.map((p, i) => (
              <p key={i} style={{ margin: "0 0 12px" }}>{p}</p>
            )) : <p style={{ color: "#888" }}>No consultation summary recorded yet.</p>}
          </div>

          <div style={{ marginTop: 18, fontSize: 13, fontWeight: 700, lineHeight: 1.6 }}>
            <div>Date of consultation: {created}</div>
            {createdTime && <div>Time of consultation: {createdTime}</div>}
          </div>

          {settings.consult.initialClosing.trim() && (
            <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.65, textAlign: "justify", fontWeight: 600 }}>{settings.consult.initialClosing}</p>
          )}

          <div style={{ marginTop: 22, fontSize: 13, fontWeight: 700, lineHeight: 1.6 }}>
            <div>Warm Regards,</div>
            <div>{c.by_name ?? "Cureocity Nutrition Team"}</div>
            <div>Dietitian</div>
            <div>{settings.consult.signoffCompany}</div>
          </div>

          <div style={{ marginTop: 40 }}><ContactFooter /></div>
        </div>
      </div>
    );
  }

  // ---- Other disciplines → structured summary sheet ------------------------
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
        <Letterhead />

        {/* Client */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: "#888" }}>Prepared for</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{clientName}</div>
          {c.clients?.code && <div style={{ fontSize: 12, color: "#666" }}>{c.clients.code}</div>}
          <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{q.label}{created ? ` · ${created}` : ""}</div>
        </div>

        {/* Summary */}
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: "#888", marginBottom: 6 }}>Consultation summary</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", minHeight: 60 }}>{c.summary?.trim() || "No summary recorded."}</div>

        {/* The AI-drafted overview, when one was generated. It used to live only
            in a small box on the client card; moving it here keeps it in the
            record now that the card links to this document instead. */}
        {c.ai_summary?.trim() && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: "#888", marginBottom: 6 }}>Overview</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "#333" }}>{c.ai_summary.trim()}</div>
          </div>
        )}

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

        <div style={{ marginTop: 34 }}><ContactFooter /></div>
        <div style={{ marginTop: 8, fontSize: 11.5, color: "#777" }}>{c.by_name ? `By ${c.by_name}` : "Cureocity Care Team"}</div>
      </div>
    </div>
  );
}
