import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SessionActions from "@/components/SessionActions";
import PortalLoginForm from "@/components/PortalLoginForm";
import FileUploadForm from "@/components/FileUploadForm";
import FilesGrid from "@/components/FilesGrid";
import MeasurementForm from "@/components/MeasurementForm";
import InvoiceActions from "@/components/InvoiceActions";
import InvoiceForm from "@/components/InvoiceForm";
import { getProfile } from "@/lib/auth";
import { canWrite, canConsult, canBill } from "@/lib/roles";

import RealtimeRefresh from "@/components/RealtimeRefresh";

export const dynamic = "force-dynamic";

function fmtHour(h: number | null) {
  if (h == null) return "—";
  const am = h < 12;
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${am ? "AM" : "PM"}`;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".4px" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{value ?? "—"}</div>
    </div>
  );
}

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*, packages(name, sessions, is_facility)")
    .eq("id", params.id)
    .maybeSingle();

  if (!client) notFound();

  const [{ data: sessions }, { data: trainerData }, { data: consultData }] = await Promise.all([
    supabase.from("sessions").select("*, staff(name)").eq("client_id", params.id).order("seq", { ascending: true }),
    supabase.from("staff").select("id, name").eq("is_trainer", true).order("name"),
    supabase.from("consultations").select("id, kind, status, summary, approved, shared, created_at").eq("client_id", params.id).order("created_at", { ascending: false }),
  ]);
  const trainers = (trainerData ?? []) as { id: string; name: string }[];
  const consults = (consultData ?? []) as { id: string; kind: string; status: string; summary: string | null; approved: boolean; shared: boolean }[];

  const me = await getProfile();
  const showPortal = canWrite(me?.role ?? "");
  const { data: portalProfile } = showPortal
    ? await supabase.from("profiles").select("email").eq("client_id", params.id).eq("role", "Client").maybeSingle()
    : { data: null };

  // files + signed URLs
  const { data: fileRows } = await supabase
    .from("files").select("id, name, kind, path, created_at").eq("client_id", params.id).order("created_at", { ascending: false });
  const files = await Promise.all(((fileRows ?? []) as { id: string; name: string | null; kind: string; path: string; created_at: string }[]).map(async (f) => {
    const { data: signed } = await supabase.storage.from("client-files").createSignedUrl(f.path, 3600);
    return { id: f.id, name: f.name, kind: f.kind, created_at: f.created_at, url: signed?.signedUrl ?? null };
  }));

  const canMeasure = canWrite(me?.role ?? "") || canConsult(me?.role ?? "");
  const showBilling = canBill(me?.role ?? "");
  const { data: invoiceRows } = showBilling
    ? await supabase.from("invoices").select("id, num, description, amount, status, method, issued_date").eq("client_id", params.id).order("created_at", { ascending: false })
    : { data: [] };
  const invoices = (invoiceRows ?? []) as { id: string; num: number | null; description: string | null; amount: number; status: string; method: string | null; issued_date: string | null }[];
  const { data: measureRows } = await supabase
    .from("measurements").select("*").eq("client_id", params.id).order("date", { ascending: false }).limit(12);
  const measures = (measureRows ?? []) as { id: string; date: string; weight: number | null; bmi: number | null; body_fat: number | null; muscle_mass: number | null; visceral_fat: number | null; waist: number | null; hip: number | null; resting_hr: number | null; recorded_by: string | null }[];

  const pkg = (client as { packages: { name: string; sessions: number; is_facility: boolean } | null }).packages;
  const sess = (sessions ?? []) as {
    id: string; seq: number; date: string; hour: number; status: string; rescheduled: boolean;
    trainer_id: string; staff: { name: string } | null;
  }[];
  const done = sess.filter((s) => s.status === "completed").length;

  return (
    <div style={{ maxWidth: 900 }}>
      <Link href="/clients" style={{ color: "var(--teal-dark)", fontSize: 13, textDecoration: "none" }}>
        ← Clients
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "10px 0 18px" }}>
        <div
          style={{
            width: 46, height: 46, borderRadius: "50%", background: "var(--teal)",
            color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 16,
          }}
        >
          {client.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
        </div>
        <div>
          <RealtimeRefresh tables={["sessions","consultations","files","measurements","meal_logs","invoices"]} />
      <h1 style={{ fontSize: 20, margin: 0 }}>{client.name}</h1>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            {client.code} · {pkg?.name ?? "—"} · joined {client.joined ?? "—"}
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <Link
          href={`/clients/${params.id}/edit`}
          style={{ border: "1px solid var(--border)", background: "#fff", color: "var(--ink)", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          ✎ Edit
        </Link>
      </div>

      {/* Profile */}
      <div
        style={{
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
          boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 16,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Profile</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <Stat label="Phone" value={client.phone} />
          <Stat label="Email" value={client.email} />
          <Stat label="Branch" value={client.branch} />
          <Stat label="Gender" value={client.gender} />
          <Stat label="Occupation" value={client.occupation} />
          <Stat label="Height / Weight" value={`${client.height ?? "—"} cm · ${client.weight ?? "—"} kg`} />
          <Stat label="Conditions" value={client.conditions} />
          <Stat label="Goals" value={(client.goals ?? []).join(", ") || "—"} />
          <Stat label="Emergency" value={client.emergency} />
        </div>
      </div>

      {/* Sessions */}
      <div
        style={{
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
          boxShadow: "var(--shadow)", padding: "18px 20px",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>🏋 Strength Sessions</div>
        {pkg?.is_facility ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            Facility access member — no scheduled sessions (check-in/out + workout plan).
          </div>
        ) : sess.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>No sessions scheduled.</div>
        ) : (
          <>
            <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>
              {sess.length} sessions · alternate days · {done} completed · {sess.length - done} upcoming
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 11 }}>
                    <th style={{ padding: "8px 12px" }}>#</th>
                    <th style={{ padding: "8px 12px" }}>Date</th>
                    <th style={{ padding: "8px 12px" }}>Time</th>
                    <th style={{ padding: "8px 12px" }}>Trainer</th>
                    <th style={{ padding: "8px 12px" }}>Status</th>
                    <th style={{ padding: "8px 12px" }} />
                  </tr>
                </thead>
                <tbody>
                  {sess.slice(0, 40).map((s) => (
                    <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px 12px" }}>{s.seq}</td>
                      <td style={{ padding: "8px 12px" }}>
                        {s.date}
                        {s.rescheduled && (
                          <span style={{ marginLeft: 6, background: "var(--amber-bg)", color: "#92400e", borderRadius: 999, padding: "1px 6px", fontSize: 10 }}>
                            rescheduled
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "8px 12px" }}>{fmtHour(s.hour)}</td>
                      <td style={{ padding: "8px 12px" }}>{s.staff?.name ?? "—"}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span
                          style={{
                            borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600,
                            background: s.status === "completed" ? "var(--green-bg)" : "#eef2f1",
                            color: s.status === "completed" ? "#166534" : "var(--muted)",
                          }}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <SessionActions
                          id={s.id}
                          clientId={client.id}
                          date={s.date}
                          hour={s.hour}
                          trainerId={s.trainer_id}
                          status={s.status}
                          trainers={trainers}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Consultations */}
      <div
        style={{
          marginTop: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
          boxShadow: "var(--shadow)", padding: "18px 20px",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>🩺 Consultations ({consults.length})</div>
        {consults.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>No consultations yet.</div>
        ) : (
          consults.map((cs) => (
            <div key={cs.id} style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ background: "var(--teal-light)", color: "var(--teal-dark)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{cs.kind}</span>
                <span style={{ background: cs.status === "completed" ? "var(--green-bg)" : "#eef2f1", color: cs.status === "completed" ? "#166534" : "var(--muted)", borderRadius: 999, padding: "2px 9px", fontSize: 11 }}>{cs.status}</span>
                {cs.approved && <span style={{ background: "var(--green-bg)", color: "#166534", borderRadius: 999, padding: "2px 9px", fontSize: 11 }}>✔ approved</span>}
                {cs.shared && <span style={{ background: "var(--blue-bg)", color: "#1e40af", borderRadius: 999, padding: "2px 9px", fontSize: 11 }}>shared</span>}
              </div>
              {cs.summary && <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>{cs.summary}</div>}
            </div>
          ))
        )}
      </div>

      {/* Billing */}
      {showBilling && (
        <div style={{ marginTop: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>💳 Billing</div>
            <span style={{ flex: 1 }} />
            <InvoiceForm clientId={params.id} />
          </div>
          {invoices.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>No invoices for this client.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 6px", color: "var(--muted)" }}>INV-{String(i.num ?? 0).padStart(3, "0")}</td>
                    <td style={{ padding: "8px 6px" }}>{i.description}</td>
                    <td style={{ padding: "8px 6px", fontWeight: 600 }}>₹{Number(i.amount).toLocaleString("en-IN")}</td>
                    <td style={{ padding: "8px 6px" }}>
                      <span style={{ background: i.status === "Paid" ? "var(--green-bg)" : i.status === "Unpaid" ? "var(--amber-bg)" : "#eef2f1", color: i.status === "Paid" ? "#166534" : i.status === "Unpaid" ? "#92400e" : "var(--muted)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{i.status}</span>
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "right" }}><InvoiceActions id={i.id} status={i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Measurements / InBody */}
      <div style={{ marginTop: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>📏 Measurements / InBody</div>
        </div>
        {measures.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>No measurements recorded yet.</div>
        ) : (
          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 11 }}>
                  <th style={{ padding: "6px 10px" }}>Date</th>
                  <th style={{ padding: "6px 10px" }}>Weight</th>
                  <th style={{ padding: "6px 10px" }}>BMI</th>
                  <th style={{ padding: "6px 10px" }}>Body fat %</th>
                  <th style={{ padding: "6px 10px" }}>Muscle</th>
                  <th style={{ padding: "6px 10px" }}>Visceral</th>
                  <th style={{ padding: "6px 10px" }}>Waist/Hip</th>
                  <th style={{ padding: "6px 10px" }}>RHR</th>
                </tr>
              </thead>
              <tbody>
                {measures.map((m) => (
                  <tr key={m.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px 10px" }}>{m.date}</td>
                    <td style={{ padding: "6px 10px" }}>{m.weight ?? "—"}{m.weight ? " kg" : ""}</td>
                    <td style={{ padding: "6px 10px" }}>{m.bmi ?? "—"}</td>
                    <td style={{ padding: "6px 10px" }}>{m.body_fat ?? "—"}</td>
                    <td style={{ padding: "6px 10px" }}>{m.muscle_mass ?? "—"}</td>
                    <td style={{ padding: "6px 10px" }}>{m.visceral_fat ?? "—"}</td>
                    <td style={{ padding: "6px 10px" }}>{(m.waist ?? "—")}/{(m.hip ?? "—")}</td>
                    <td style={{ padding: "6px 10px" }}>{m.resting_hr ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canMeasure && <MeasurementForm clientId={params.id} />}
      </div>

      {/* Files */}
      <div style={{ marginTop: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>📎 Files &amp; documents</div>
        <FilesGrid files={files} />
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Upload blood report (PDF/image)</div>
            <FileUploadForm variant="staff" clientId={params.id} kind="blood_report" label="Upload blood report" accept=".pdf,image/*" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Upload progress photo</div>
            <FileUploadForm variant="staff" clientId={params.id} kind="progress_photo" label="Upload photo" accept="image/*" />
          </div>
        </div>
      </div>

      {/* Portal access (staff) */}
      {showPortal && (
        <div style={{ marginTop: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>🔑 Client Portal access</div>
          <PortalLoginForm clientId={params.id} existingEmail={portalProfile?.email ?? null} />
        </div>
      )}
    </div>
  );
}
