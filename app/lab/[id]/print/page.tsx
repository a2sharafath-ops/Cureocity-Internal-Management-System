import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/settings";
import { IST } from "@/lib/datetime";
import PrintTrigger from "@/components/PrintTrigger";
import { SheetStyles, FallbackHead, PatientBlock } from "@/components/SheetPage";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string; test: string; category: string | null; priority: string | null;
  notes: string | null; provider: string | null; created_at: string;
  client_id: string | null; consultation_id: string | null;
};

/**
 * Printable lab requisition — the form the patient hands to the lab.
 *
 * `[id]` is a consultation id, so every test advised in one session prints on
 * one sheet; that is how a doctor thinks about it and how a lab wants it. For
 * orders placed before consultations were linked (and for a one-off order from
 * the worklist) an order id also works, and prints that order alone.
 */
export default async function LabPrintPage({
  params, searchParams,
}: { params: { id: string }; searchParams: { auto?: string } }) {
  const supabase = createClient();

  // Try the session first, then fall back to a single order.
  const { data: bySession } = await supabase
    .from("orders")
    .select("id, test, category, priority, notes, provider, created_at, client_id, consultation_id")
    .eq("consultation_id", params.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });

  let orders = (bySession ?? []) as OrderRow[];
  if (orders.length === 0) {
    const { data: one } = await supabase
      .from("orders")
      .select("id, test, category, priority, notes, provider, created_at, client_id, consultation_id")
      .eq("id", params.id)
      .maybeSingle();
    if (one) orders = [one as OrderRow];
  }
  if (orders.length === 0) notFound();

  const clientId = orders[0].client_id;
  const { data: cl } = clientId
    ? await supabase.from("clients").select("name, code, dob, gender").eq("id", clientId).maybeSingle()
    : { data: null };
  const c = cl as { name: string; code: string | null; dob: string | null; gender: string | null } | null;

  const s = await getAppSettings();
  const sheet = s.docs.lab;
  const age = c?.dob ? Math.floor((Date.now() - new Date(c.dob).getTime()) / 31_557_600_000) : null;
  const date = new Date(orders[0].created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: IST });
  // A stat/urgent test on the sheet is the whole point of marking it, so the
  // most pressing priority in the set is called out at the top.
  const rank = (p: string | null) => (p === "stat" ? 3 : p === "urgent" ? 2 : 1);
  const top = orders.reduce((a, b) => (rank(b.priority) > rank(a.priority) ? b : a), orders[0]);
  const urgent = rank(top.priority) > 1;

  return (
    <>
      <SheetStyles sheet={sheet} />
      <div className="no-print" style={{ display: "flex", justifyContent: "center", padding: "14px 10px 0" }}>
        <PrintTrigger auto={searchParams?.auto === "1"} />
      </div>

      <div className="sheet">
        {sheet.bg
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="sheet-bg" src={sheet.bg} alt="" />
          : null}
        <div className="sheet-body">
          {!sheet.bg && <FallbackHead s={s} />}

          <PatientBlock
            title="Investigation request"
            docNo={orders[0].id.slice(0, 8).toUpperCase()}
            name={c?.name ?? "Patient"} code={c?.code ?? null}
            age={age} gender={c?.gender ?? null}
            doctor={orders[0].provider} date={date}
          />

          {urgent && (
            <div style={{ display: "inline-block", background: "#fee2e2", color: "#b91c1c", fontWeight: 800, fontSize: 11.5, letterSpacing: ".5px", padding: "4px 12px", borderRadius: 999, marginBottom: 12 }}>
              {String(top.priority).toUpperCase()} — process on priority
            </div>
          )}

          <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 10 }}>
            Kindly carry out the following investigation{orders.length === 1 ? "" : "s"}:
          </div>

          <table className="rx-table">
            <thead>
              <tr>
                <th style={{ width: "5%" }}>#</th>
                <th style={{ width: "55%" }}>Investigation</th>
                <th style={{ width: "18%" }}>Type</th>
                <th style={{ width: "22%" }}>Priority</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, n) => (
                <tr key={o.id}>
                  <td style={{ color: "#9ca3af" }}>{n + 1}</td>
                  <td>
                    <div style={{ fontWeight: 700, color: "#111" }}>{o.test}</div>
                    {o.notes && <div style={{ fontSize: 11, color: "#374151", marginTop: 2 }}>{o.notes}</div>}
                  </td>
                  <td style={{ textTransform: "capitalize" }}>{o.category || "lab"}</td>
                  <td style={{ textTransform: "capitalize", fontWeight: rank(o.priority) > 1 ? 700 : 400, color: rank(o.priority) > 1 ? "#b91c1c" : "#374151" }}>
                    {o.priority || "routine"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 22, fontSize: 11.5, color: "#6b7280", lineHeight: 1.6 }}>
            Please send a copy of the report to {s.letterhead.email || "the clinic"}.
            Fasting may be required for some tests — check with the laboratory before your sample is taken.
          </div>

          <div style={{ marginTop: 46, display: "flex", justifyContent: "flex-end" }}>
            <div style={{ textAlign: "center", minWidth: 190 }}>
              <div style={{ borderTop: "1px solid #9ca3af", paddingTop: 5, fontSize: 12, fontWeight: 700, color: "#111" }}>{orders[0].provider ?? "Requesting clinician"}</div>
              <div style={{ fontSize: 10.5, color: "#6b7280" }}>Signature &amp; seal</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
