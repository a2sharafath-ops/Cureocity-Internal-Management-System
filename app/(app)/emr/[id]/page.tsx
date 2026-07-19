import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { ageFromDob } from "@/lib/dob";
import { ProblemForm, AllergyForm, MedicationForm, VitalsForm, EncounterForm } from "@/components/EmrForms";
import { ProblemToggle, MedStop, AllergyDelete } from "@/components/EmrActions";
import RxForm from "@/components/RxForm";
import OrderForm from "@/components/OrderForm";
import { OrderActions, RxStatus } from "@/components/OrderActions";

export const dynamic = "force-dynamic";

const age = (dob: string | null) => ageFromDob(dob);

export default async function EmrChartPage({ params }: { params: { id: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/emr")) redirect("/dashboard");

  const cid = params.id;
  const supabase = createClient();
  const { data: client } = await supabase.from("clients").select("id, code, name, phone, gender, dob, conditions, abha_id, uhid").eq("id", cid).maybeSingle();
  if (!client) notFound();

  const [problemsR, allergiesR, medsR, vitalsR, encountersR, rxR, ordersR] = await Promise.all([
    supabase.from("problems").select("id, code, description, status, onset_date, resolved_date, noted_by").eq("client_id", cid).order("created_at", { ascending: false }),
    supabase.from("allergies").select("id, substance, reaction, severity, noted_by").eq("client_id", cid).order("created_at", { ascending: false }),
    supabase.from("medications").select("id, name, dose, frequency, route, status, start_date, end_date, prescriber").eq("client_id", cid).order("created_at", { ascending: false }),
    supabase.from("vitals").select("id, date, systolic, diastolic, pulse, temp_c, resp_rate, spo2, weight, notes, recorded_by").eq("client_id", cid).order("date", { ascending: false }).limit(20),
    supabase.from("encounters").select("id, date, type, chief_complaint, subjective, objective, assessment, plan, provider").eq("client_id", cid).order("date", { ascending: false }).limit(30),
    supabase.from("prescriptions").select("id, status, notes, flags, provider, signed_date, created_at, prescription_items(drug, dose, frequency, route, duration, quantity)").eq("client_id", cid).order("created_at", { ascending: false }).limit(30),
    supabase.from("orders").select("id, category, test, priority, status, result, result_date, provider, created_at").eq("client_id", cid).order("created_at", { ascending: false }).limit(40),
  ]);

  const problems = (problemsR.data ?? []) as { id: string; code: string | null; description: string; status: string; onset_date: string | null; resolved_date: string | null; noted_by: string | null }[];
  const allergies = (allergiesR.data ?? []) as { id: string; substance: string; reaction: string | null; severity: string; noted_by: string | null }[];
  const meds = (medsR.data ?? []) as { id: string; name: string; dose: string | null; frequency: string | null; route: string | null; status: string; start_date: string | null; end_date: string | null; prescriber: string | null }[];
  const vitals = (vitalsR.data ?? []) as { id: string; date: string; systolic: number | null; diastolic: number | null; pulse: number | null; temp_c: number | null; resp_rate: number | null; spo2: number | null; weight: number | null; notes: string | null; recorded_by: string | null }[];
  const encounters = (encountersR.data ?? []) as { id: string; date: string; type: string; chief_complaint: string | null; subjective: string | null; objective: string | null; assessment: string | null; plan: string | null; provider: string | null }[];
  const prescriptions = (rxR.data ?? []) as unknown as { id: string; status: string; notes: string | null; flags: string | null; provider: string | null; signed_date: string | null; created_at: string; prescription_items: { drug: string; dose: string | null; frequency: string | null; route: string | null; duration: string | null; quantity: string | null }[] }[];
  const orders = (ordersR.data ?? []) as { id: string; category: string; test: string; priority: string; status: string; result: string | null; result_date: string | null; provider: string | null; created_at: string }[];

  const activeMedNames = meds.filter((m) => m.status === "active").map((m) => m.name);
  const allergyNames = allergies.map((al) => al.substance);

  const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 18, marginBottom: 18 };
  const th: React.CSSProperties = { padding: "8px 12px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "8px 12px", fontSize: 14 };
  const sectionHead = (title: string, right?: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <h2 style={{ fontSize: 15, margin: 0 }}>{title}</h2><span style={{ flex: 1 }} />{right}
    </div>
  );
  const sevColor = (s: string) => s === "severe" ? "var(--red)" : s === "mild" ? "var(--muted)" : "#b45309";
  const a = age(client.dob);

  return (
    <div style={{ maxWidth: 1000 }}>
      <RealtimeRefresh tables={["problems", "allergies", "medications", "vitals", "encounters"]} />
      <Link href="/emr" style={{ color: "var(--muted)", textDecoration: "none", fontSize: 13 }}>← All charts</Link>

      {/* header */}
      <div style={{ ...card, marginTop: 8, display: "flex", alignItems: "center", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: "0 0 2px" }}>{client.name}</h1>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            {client.code ?? "—"} · {client.gender ?? "—"}{a != null ? ` · ${a} yrs` : ""}{client.phone ? ` · ${client.phone}` : ""}
          </div>
          {(client.abha_id || client.uhid) && (
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2, fontFamily: "monospace" }}>
              {client.abha_id ? `ABHA ${client.abha_id}` : ""}{client.abha_id && client.uhid ? " · " : ""}{client.uhid ? `UHID ${client.uhid}` : ""}
            </div>
          )}
        </div>
        <span style={{ flex: 1 }} />
        <a href={`/api/fhir/${cid}`} style={{ color: "var(--teal-dark)", textDecoration: "none", fontSize: 13, fontWeight: 600, border: "1px solid var(--teal)", borderRadius: 8, padding: "6px 12px", marginRight: 10 }}>⤓ Export FHIR</a>
        <Link href={`/clients/${cid}`} style={{ color: "var(--teal-dark)", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>360° profile →</Link>
      </div>

      {/* allergy banner */}
      {allergies.length > 0 && (
        <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 12, padding: "10px 16px", marginBottom: 18, color: "var(--red)", fontSize: 14 }}>
          <b>⚠ Allergies:</b> {allergies.map((al) => `${al.substance}${al.severity === "severe" ? " (severe)" : ""}`).join(", ")}
        </div>
      )}

      {/* problems */}
      <section style={card}>
        {sectionHead("Problem list", <ProblemForm clientId={cid} />)}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Problem</th><th style={th}>Code</th><th style={th}>Onset</th><th style={th}>Status</th><th style={th} /></tr></thead>
          <tbody>
            {problems.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid var(--border)", opacity: p.status === "resolved" ? 0.55 : 1 }}>
                <td style={{ ...td, fontWeight: 600 }}>{p.description}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{p.code ?? "—"}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{p.onset_date ?? "—"}</td>
                <td style={td}><span style={{ background: p.status === "active" ? "var(--green-bg)" : "#eef2f1", color: p.status === "active" ? "#166534" : "var(--muted)", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{p.status}</span></td>
                <td style={{ ...td, textAlign: "right" }}><ProblemToggle id={p.id} clientId={cid} status={p.status} /></td>
              </tr>
            ))}
            {problems.length === 0 && <tr><td colSpan={5} style={{ ...td, color: "var(--muted)", padding: "14px 12px" }}>No problems recorded.</td></tr>}
          </tbody>
        </table>
      </section>

      {/* allergies */}
      <section style={card}>
        {sectionHead("Allergies", <AllergyForm clientId={cid} />)}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Substance</th><th style={th}>Reaction</th><th style={th}>Severity</th><th style={th} /></tr></thead>
          <tbody>
            {allergies.map((al) => (
              <tr key={al.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 600 }}>{al.substance}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{al.reaction ?? "—"}</td>
                <td style={{ ...td, color: sevColor(al.severity), fontWeight: 600 }}>{al.severity}</td>
                <td style={{ ...td, textAlign: "right" }}><AllergyDelete id={al.id} clientId={cid} /></td>
              </tr>
            ))}
            {allergies.length === 0 && <tr><td colSpan={4} style={{ ...td, color: "var(--muted)", padding: "14px 12px" }}>No known allergies.</td></tr>}
          </tbody>
        </table>
      </section>

      {/* medications */}
      <section style={card}>
        {sectionHead("Medications", <MedicationForm clientId={cid} />)}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Drug</th><th style={th}>Dose</th><th style={th}>Frequency</th><th style={th}>Route</th><th style={th}>Status</th><th style={th} /></tr></thead>
          <tbody>
            {meds.map((m) => (
              <tr key={m.id} style={{ borderTop: "1px solid var(--border)", opacity: m.status === "stopped" ? 0.55 : 1 }}>
                <td style={{ ...td, fontWeight: 600 }}>{m.name}</td>
                <td style={td}>{m.dose ?? "—"}</td>
                <td style={td}>{m.frequency ?? "—"}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{m.route ?? "—"}</td>
                <td style={td}><span style={{ background: m.status === "active" ? "var(--green-bg)" : "#eef2f1", color: m.status === "active" ? "#166534" : "var(--muted)", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{m.status}</span></td>
                <td style={{ ...td, textAlign: "right" }}>{m.status === "active" && <MedStop id={m.id} clientId={cid} />}</td>
              </tr>
            ))}
            {meds.length === 0 && <tr><td colSpan={6} style={{ ...td, color: "var(--muted)", padding: "14px 12px" }}>No medications recorded.</td></tr>}
          </tbody>
        </table>
      </section>

      {/* vitals */}
      <section style={card}>
        {sectionHead("Vitals", <VitalsForm clientId={cid} />)}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead><tr><th style={th}>Date</th><th style={th}>BP</th><th style={th}>Pulse</th><th style={th}>Temp</th><th style={th}>RR</th><th style={th}>SpO₂</th><th style={th}>Wt</th><th style={th}>By</th></tr></thead>
            <tbody>
              {vitals.map((v) => (
                <tr key={v.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}>{v.date}</td>
                  <td style={td}>{v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : "—"}</td>
                  <td style={td}>{v.pulse ?? "—"}</td>
                  <td style={td}>{v.temp_c != null ? `${v.temp_c}°` : "—"}</td>
                  <td style={td}>{v.resp_rate ?? "—"}</td>
                  <td style={td}>{v.spo2 != null ? `${v.spo2}%` : "—"}</td>
                  <td style={td}>{v.weight != null ? `${v.weight}` : "—"}</td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 12 }}>{v.recorded_by ?? "—"}</td>
                </tr>
              ))}
              {vitals.length === 0 && <tr><td colSpan={8} style={{ ...td, color: "var(--muted)", padding: "14px 12px" }}>No vitals recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* encounters (SOAP) */}
      <section style={card}>
        {sectionHead("Encounters (SOAP)", <EncounterForm clientId={cid} />)}
        {encounters.length === 0 && <div style={{ color: "var(--muted)", fontSize: 14 }}>No encounters documented.</div>}
        <div style={{ display: "grid", gap: 12 }}>
          {encounters.map((e) => (
            <div key={e.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                <b style={{ fontSize: 14 }}>{e.date}</b>
                <span style={{ background: "#e0f2f1", color: "var(--teal-dark)", borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 600 }}>{e.type}</span>
                {e.chief_complaint && <span style={{ color: "var(--muted)", fontSize: 13 }}>· {e.chief_complaint}</span>}
                <span style={{ flex: 1 }} />
                <span style={{ color: "var(--muted)", fontSize: 12 }}>{e.provider ?? ""}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, fontSize: 13 }}>
                {([["S", e.subjective], ["O", e.objective], ["A", e.assessment], ["P", e.plan]] as const).map(([k, val]) => (
                  <div key={k}><span style={{ color: "var(--muted)", fontWeight: 700 }}>{k}</span> <span style={{ whiteSpace: "pre-wrap" }}>{val ?? "—"}</span></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* prescriptions */}
      <section style={card}>
        {sectionHead("e-Prescriptions", <RxForm clientId={cid} allergies={allergyNames} currentMeds={activeMedNames} />)}
        {prescriptions.length === 0 && <div style={{ color: "var(--muted)", fontSize: 14 }}>No prescriptions.</div>}
        <div style={{ display: "grid", gap: 10 }}>
          {prescriptions.map((r) => {
            const chip = r.status === "signed" ? ["var(--green-bg)", "#166534"] : r.status === "dispensed" ? ["#e0f2f1", "var(--teal-dark)"] : r.status === "cancelled" ? ["#fee2e2", "var(--red)"] : ["#eef2f1", "var(--muted)"];
            return (
              <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ background: chip[0], color: chip[1], borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{r.status}</span>
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>{r.signed_date ?? r.created_at.slice(0, 10)} · {r.provider ?? ""}</span>
                  <span style={{ flex: 1 }} />
                  <RxStatus id={r.id} clientId={cid} status={r.status} />
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {r.prescription_items.map((it, i) => (
                      <tr key={i} style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                        <td style={{ ...td, fontWeight: 600 }}>{it.drug}</td>
                        <td style={td}>{it.dose ?? ""}</td>
                        <td style={td}>{it.frequency ?? ""}</td>
                        <td style={{ ...td, color: "var(--muted)" }}>{it.route ?? ""}{it.duration ? ` · ${it.duration}` : ""}{it.quantity ? ` · #${it.quantity}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {r.flags && <div style={{ marginTop: 8, background: "var(--amber-bg)", color: "#92400e", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>⚠ Flagged at signing: {r.flags}</div>}
                {r.notes && <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>{r.notes}</div>}
              </div>
            );
          })}
        </div>
      </section>

      {/* lab / imaging orders */}
      <section style={card}>
        {sectionHead("Lab & imaging orders", <OrderForm clientId={cid} />)}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Test</th><th style={th}>Type</th><th style={th}>Priority</th><th style={th}>Status</th><th style={th}>Result</th><th style={th} /></tr></thead>
          <tbody>
            {orders.map((o) => {
              const chip = o.status === "resulted" ? ["var(--green-bg)", "#166534"] : o.status === "cancelled" ? ["#fee2e2", "var(--red)"] : o.status === "collected" ? ["var(--amber-bg)", "#92400e"] : ["#eef2f1", "var(--muted)"];
              return (
                <tr key={o.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...td, fontWeight: 600 }}>{o.test}</td>
                  <td style={{ ...td, color: "var(--muted)" }}>{o.category}</td>
                  <td style={td}>{o.priority !== "routine" ? <span style={{ color: o.priority === "stat" ? "var(--red)" : "#92400e", fontWeight: 600, textTransform: "uppercase", fontSize: 12 }}>{o.priority}</span> : <span style={{ color: "var(--muted)" }}>routine</span>}</td>
                  <td style={td}><span style={{ background: chip[0], color: chip[1], borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{o.status}</span></td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{o.result ? `${o.result}${o.result_date ? ` (${o.result_date})` : ""}` : "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}><OrderActions id={o.id} clientId={cid} status={o.status} /></td>
                </tr>
              );
            })}
            {orders.length === 0 && <tr><td colSpan={6} style={{ ...td, color: "var(--muted)", padding: "14px 12px" }}>No orders.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
