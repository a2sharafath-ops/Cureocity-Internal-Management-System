import { IST } from "@/lib/datetime";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppSettings, brandLogo } from "@/lib/settings";
import PrintTrigger from "@/components/PrintTrigger";

export const dynamic = "force-dynamic";

// Printable diet chart — a clean A4-style page the dietitian or client can save
// as PDF via the browser. RLS gates access: staff see any chart; a client only
// their own published one. No PDF library needed.
export default async function DietChartPrintPage(
  props: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("diet_charts")
    .select("id, client_id, version, status, calories, protein, notes, summary, meals, by_name, created_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!data) notFound();
  const dc = data as {
    client_id: string | null; version: number; status: string;
    calories: number | null; protein: string | null; notes: string | null; summary: string | null;
    meals: [string, string][]; by_name: string | null; created_at: string;
  };

  let clientName = "—";
  let clientCode: string | null = null;
  if (dc.client_id) {
    const { data: c } = await supabase.from("clients").select("name, code").eq("id", dc.client_id).maybeSingle();
    if (c) { clientName = (c as { name: string }).name; clientCode = (c as { code: string | null }).code; }
  }

  const meals = Array.isArray(dc.meals) ? dc.meals : [];
  const created = new Date(dc.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: IST });
  const settings = await getAppSettings();
  const logo = brandLogo(settings);

  return (
    <div style={{ background: "#f3f4f6", minHeight: "100vh", padding: "24px 0" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .sheet { box-shadow: none !important; margin: 0 !important; }
          @page { size: A4; margin: 16mm; }
        }
      `}</style>

      <div className="no-print" style={{ maxWidth: 720, margin: "0 auto 14px", display: "flex", justifyContent: "flex-end", padding: "0 8px" }}>
        <PrintTrigger auto={searchParams.auto === "1"} />
      </div>

      <div className="sheet" style={{ maxWidth: 720, margin: "0 auto", background: "#fff", borderRadius: 8, boxShadow: "0 1px 6px rgba(0,0,0,.12)", padding: "40px 44px", color: "#111", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {/* Letterhead */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #111", paddingBottom: 12, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={logo} alt="" width={38} height={38} style={{ display: "block", maxWidth: 44, maxHeight: 44 }} />
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.5px" }}>Cureocity</div>
              <div style={{ fontSize: 12, color: "#666" }}>Personalised Diet Plan</div>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#444" }}>
            <div>Version {dc.version} · {dc.status}</div>
            <div>{created}</div>
          </div>
        </div>

        {/* Client + targets */}
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: "#888" }}>Prepared for</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{clientName}</div>
            {clientCode && <div style={{ fontSize: 12, color: "#666" }}>{clientCode}</div>}
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: "#888" }}>Calories</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{dc.calories ? `${dc.calories} kcal` : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: "#888" }}>Protein</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{dc.protein ?? "—"}</div>
            </div>
          </div>
        </div>

        {/* Plan summary */}
        {dc.summary && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: "#888", marginBottom: 4 }}>Plan summary</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{dc.summary}</div>
          </div>
        )}

        {/* Meals */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 10px", background: "#f6f7f8", borderBottom: "1px solid #e5e7eb", width: 160, fontSize: 12, textTransform: "uppercase", letterSpacing: ".4px", color: "#666" }}>Meal</th>
              <th style={{ textAlign: "left", padding: "8px 10px", background: "#f6f7f8", borderBottom: "1px solid #e5e7eb", fontSize: 12, textTransform: "uppercase", letterSpacing: ".4px", color: "#666" }}>What to eat</th>
            </tr>
          </thead>
          <tbody>
            {meals.length ? meals.map(([label, detail], i) => (
              <tr key={i}>
                <td style={{ padding: "10px", borderBottom: "1px solid #eef0f1", fontWeight: 600, verticalAlign: "top" }}>{label}</td>
                <td style={{ padding: "10px", borderBottom: "1px solid #eef0f1", verticalAlign: "top" }}>{detail || "—"}</td>
              </tr>
            )) : (
              <tr><td colSpan={2} style={{ padding: "14px 10px", color: "#888" }}>No meals listed.</td></tr>
            )}
          </tbody>
        </table>

        {dc.notes && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: "#888", marginBottom: 4 }}>Notes</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{dc.notes}</div>
          </div>
        )}

        {settings.diet.footerNote.trim() && (
          <div style={{ marginTop: 20, fontSize: 12.5, lineHeight: 1.5, color: "#555", whiteSpace: "pre-wrap" }}>{settings.diet.footerNote}</div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 34, paddingTop: 12, borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#777" }}>
          <span>{dc.by_name ? `Prepared by ${dc.by_name}` : settings.letterhead.name}</span>
          <span>{settings.letterhead.website}</span>
        </div>
      </div>
    </div>
  );
}
