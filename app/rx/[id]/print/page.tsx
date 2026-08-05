import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/settings";
import { IST } from "@/lib/datetime";
import PrintTrigger from "@/components/PrintTrigger";
import { SheetStyles, FallbackHead, PatientBlock } from "@/components/SheetPage";

export const dynamic = "force-dynamic";

/**
 * Printable prescription — the sheet the patient carries to a pharmacy.
 *
 * Medicines only. Advised investigations print on their own requisition
 * (/lab/[id]/print) because a lab keeps the form it is given, and a patient
 * should not have to hand over the page listing their medication to get a
 * blood test.
 *
 * Access is RLS-gated: staff read per the prescriptions policy, a client only
 * their own once shared.
 */
export default async function RxPrintPage({
  params, searchParams,
}: { params: { id: string }; searchParams: { auto?: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("prescriptions")
    .select("id, status, notes, provider, signed_date, created_at, client_id, clients(name, code, dob, gender), prescription_items(drug, dose, frequency, route, duration, quantity, instructions)")
    .eq("id", params.id)
    .maybeSingle();
  if (!data) notFound();

  const rx = data as unknown as {
    id: string; status: string; notes: string | null; provider: string | null;
    signed_date: string | null; created_at: string; client_id: string | null;
    clients: { name: string; code: string | null; dob: string | null; gender: string | null } | null;
    prescription_items: { drug: string; dose: string | null; frequency: string | null; route: string | null; duration: string | null; quantity: string | null; instructions: string | null }[];
  };

  const s = await getAppSettings();
  const sheet = s.docs.rx;
  const items = rx.prescription_items ?? [];
  const c = rx.clients;
  const age = c?.dob ? Math.floor((Date.now() - new Date(c.dob).getTime()) / 31_557_600_000) : null;
  const issued = rx.signed_date ?? rx.created_at;
  const date = new Date(issued.length <= 10 ? `${issued}T00:00:00Z` : issued)
    .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: issued.length <= 10 ? "UTC" : IST });

  return (
    <>
      <SheetStyles sheet={sheet} />
      <div className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", padding: "14px 10px 0" }}>
        <PrintTrigger auto={searchParams?.auto === "1"} />
        {rx.status === "draft" && (
          <span style={{ fontSize: 12.5, color: "#b45309", fontWeight: 600 }}>
            Draft — sign it before giving this to the client.
          </span>
        )}
      </div>

      <div className="sheet">
        {sheet.bg
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="sheet-bg" src={sheet.bg} alt="" />
          : null}
        <div className="sheet-body">
          {!sheet.bg && <FallbackHead s={s} />}
          {s.rx.header && !sheet.bg && (
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12 }}>{s.rx.header}</div>
          )}

          <PatientBlock
            title="Prescription"
            docNo={rx.id.slice(0, 8).toUpperCase()}
            name={c?.name ?? "Client"} code={c?.code ?? null}
            age={age} gender={c?.gender ?? null}
            doctor={rx.provider} date={date}
          />

          {/* The ℞ mark is what makes a sheet read as a prescription at a glance. */}
          <div style={{ fontSize: 30, fontWeight: 700, color: s.brand.color || "#e11d48", lineHeight: 1, marginBottom: 6 }}>℞</div>

          {items.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#6b7280", padding: "10px 0" }}>No medicines on this prescription.</div>
          ) : (
            <table className="rx-table">
              <thead>
                <tr>
                  <th style={{ width: "4%" }}>#</th>
                  <th style={{ width: "38%" }}>Medicine</th>
                  <th style={{ width: "16%" }}>Dose</th>
                  <th style={{ width: "20%" }}>Frequency</th>
                  <th style={{ width: "22%" }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i, n) => (
                  <tr key={n}>
                    <td style={{ color: "#9ca3af" }}>{n + 1}</td>
                    <td>
                      <div style={{ fontWeight: 700, color: "#111" }}>{i.drug}</div>
                      {(i.route || i.quantity) && (
                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                          {[i.route, i.quantity ? `Qty ${i.quantity}` : null].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      {i.instructions && <div style={{ fontSize: 11, color: "#374151", marginTop: 2 }}>{i.instructions}</div>}
                    </td>
                    <td>{i.dose || "—"}</td>
                    <td>{i.frequency || "—"}</td>
                    <td>{i.duration || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {rx.notes && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".5px", color: "#9ca3af", fontWeight: 700, marginBottom: 3 }}>Advice</div>
              <div style={{ fontSize: 12, color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{rx.notes}</div>
            </div>
          )}

          {/* Signature sits in the flow, not pinned to the page bottom: pinned,
              it would overprint the drug list on a long prescription. */}
          <div style={{ marginTop: 46, display: "flex", justifyContent: "flex-end" }}>
            <div style={{ textAlign: "center", minWidth: 190 }}>
              <div style={{ borderTop: "1px solid #9ca3af", paddingTop: 5, fontSize: 12, fontWeight: 700, color: "#111" }}>{rx.provider ?? "Prescriber"}</div>
              <div style={{ fontSize: 10.5, color: "#6b7280" }}>Signature &amp; seal</div>
            </div>
          </div>

          {s.rx.footer && (
            <div style={{ marginTop: 22, fontSize: 10, color: "#9ca3af", lineHeight: 1.5 }}>{s.rx.footer}</div>
          )}
        </div>
      </div>
    </>
  );
}
