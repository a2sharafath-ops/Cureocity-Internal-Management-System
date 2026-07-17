import { createClient } from "@/lib/supabase/server";
import { BP_SCORES, band, type BpScores } from "@/lib/blueprint";
import FileUploadForm from "@/components/FileUploadForm";
import FilesGrid from "@/components/FilesGrid";
import MealSelfForm from "@/components/MealSelfForm";
import { MEALS, type MealLog } from "@/lib/meals";

import RealtimeRefresh from "@/components/RealtimeRefresh";

import { todayISO } from "@/lib/today";

export const dynamic = "force-dynamic";

const TODAY = todayISO();

function fmtHour(h: number | null) {
  if (h == null) return "—";
  const am = h < 12; const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${am ? "AM" : "PM"}`;
}

function card(children: React.ReactNode, extra?: React.CSSProperties) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 16, ...extra }}>
      {children}
    </div>
  );
}

export default async function PortalHome() {
  const supabase = createClient();

  // RLS scopes these to the logged-in client only
  const { data: client } = await supabase
    .from("clients")
    .select("*, packages(name, is_facility)")
    .limit(1)
    .maybeSingle();

  if (!client) {
    return card(<div style={{ color: "var(--muted)", fontSize: 14 }}>No client record is linked to your login. Please contact the front desk.</div>);
  }

  const pkg = (client as { packages: { name: string; is_facility: boolean } | null }).packages;

  const [{ data: sessions }, { data: consults }, { data: bpData }, { data: bloodData }, { data: fileRows }] = await Promise.all([
    supabase.from("sessions").select("seq, date, hour, status").eq("client_id", client.id).order("seq"),
    supabase.from("consultations").select("kind, summary, created_at").eq("client_id", client.id).eq("shared", true).order("created_at", { ascending: false }),
    supabase.from("blueprints").select("generated, generated_date, consolidated, scores").eq("client_id", client.id).eq("generated", true).maybeSingle(),
    supabase.from("blood_requests").select("submitted, submitted_date, requested_at").eq("client_id", client.id).maybeSingle(),
    supabase.from("files").select("id, name, kind, path, created_at").eq("client_id", client.id).order("created_at", { ascending: false }),
  ]);

  const { data: mealRows } = await supabase.from("meal_logs").select("*").eq("client_id", client.id).eq("date", TODAY);
  const mealMap = new Map(((mealRows ?? []) as MealLog[]).map((m) => [m.meal, m]));
  const showMeals = !pkg?.is_facility;

  const { data: latestM } = await supabase
    .from("measurements").select("date, weight, bmi, body_fat, muscle_mass, visceral_fat")
    .eq("client_id", client.id).order("date", { ascending: false }).limit(1).maybeSingle();
  const m = latestM as { date: string; weight: number | null; bmi: number | null; body_fat: number | null; muscle_mass: number | null; visceral_fat: number | null } | null;

  const { data: invRows } = await supabase
    .from("invoices").select("id, num, description, amount, status").eq("client_id", client.id).order("created_at", { ascending: false });
  const invoices = (invRows ?? []) as { id: string; num: number | null; description: string | null; amount: number; status: string }[];

  const files = await Promise.all(((fileRows ?? []) as { id: string; name: string | null; kind: string; path: string; created_at: string }[]).map(async (f) => {
    const { data: signed } = await supabase.storage.from("client-files").createSignedUrl(f.path, 3600);
    return { id: f.id, name: f.name, kind: f.kind, created_at: f.created_at, url: signed?.signedUrl ?? null };
  }));

  const sess = (sessions ?? []) as { seq: number; date: string; hour: number; status: string }[];
  const shared = (consults ?? []) as { kind: string; summary: string | null; created_at: string }[];
  const bp = bpData as { generated: boolean; generated_date: string | null; consolidated: string | null; scores: BpScores | null } | null;
  const blood = bloodData as { submitted: boolean; submitted_date: string | null; requested_at: string | null } | null;

  const done = sess.filter((s) => s.status === "completed").length;
  const upcoming = sess.filter((s) => s.status === "scheduled");

  return (
    <div>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, var(--teal-dark), var(--teal))", color: "#fff", borderRadius: "var(--radius)", padding: "22px 24px", marginBottom: 18 }}>
        <RealtimeRefresh tables={["meal_logs","consultations","blueprints","blood_requests","sessions","measurements","files","invoices"]} />
      <h1 style={{ margin: "0 0 4px", fontSize: 22 }}>Hi {client.name.split(" ")[0]} 👋</h1>
        <div style={{ opacity: 0.92, fontSize: 13 }}>
          {pkg?.name ?? "—"}
          {!pkg?.is_facility && sess.length > 0 ? ` · ${done} of ${sess.length} strength sessions done` : ""}
        </div>
      </div>

      {/* Profile */}
      {card(
        <>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>My profile</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, fontSize: 14 }}>
            <div><div style={{ color: "var(--muted)", fontSize: 11 }}>Client code</div>{client.code ?? "—"}</div>
            <div><div style={{ color: "var(--muted)", fontSize: 11 }}>Height / Weight</div>{client.height ?? "—"} cm · {client.weight ?? "—"} kg</div>
            <div><div style={{ color: "var(--muted)", fontSize: 11 }}>Branch</div>{client.branch ?? "—"}</div>
            <div><div style={{ color: "var(--muted)", fontSize: 11 }}>Goals</div>{(client.goals ?? []).join(", ") || "—"}</div>
            <div><div style={{ color: "var(--muted)", fontSize: 11 }}>Conditions</div>{client.conditions ?? "—"}</div>
            <div><div style={{ color: "var(--muted)", fontSize: 11 }}>Joined</div>{client.joined ?? "—"}</div>
          </div>
        </>
      )}

      {/* Sessions */}
      {!pkg?.is_facility && sess.length > 0 && card(
        <>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>My strength sessions</div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 8 }}>{done} completed · {upcoming.length} upcoming</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {sess.slice(0, 12).map((s) => (
              <div key={s.seq} style={{ display: "flex", gap: 10, fontSize: 13, padding: "6px 0", borderTop: "1px solid var(--border)" }}>
                <span style={{ width: 28, color: "var(--muted)" }}>#{s.seq}</span>
                <span style={{ width: 120 }}>{s.date === TODAY ? "Today" : s.date}</span>
                <span style={{ width: 90 }}>{fmtHour(s.hour)}</span>
                <span style={{ color: s.status === "completed" ? "#166534" : "var(--muted)" }}>{s.status}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Shared summaries */}
      {card(
        <>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Shared consultation summaries</div>
          {shared.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Nothing shared with you yet.</div>
          ) : shared.map((c, i) => (
            <div key={i} style={{ padding: "10px 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
              <span style={{ background: "var(--teal-light)", color: "var(--teal-dark)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{c.kind}</span>
              {c.summary && <div style={{ marginTop: 6, fontSize: 13 }}>{c.summary}</div>}
            </div>
          ))}
        </>
      )}

      {/* Blood + Blueprint */}
      {(blood || bp) && card(
        <>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>BluePrint</div>
          {blood && (
            <div style={{ fontSize: 13, marginBottom: 10 }}>
              🩸 Blood report:{" "}
              {blood.submitted ? (
                <b style={{ color: "#166534" }}>received ✓{blood.submitted_date ? ` (${blood.submitted_date})` : ""}</b>
              ) : (
                <>
                  <b style={{ color: "#92400e" }}>requested — upload your report</b>
                  <div style={{ marginTop: 8 }}>
                    <FileUploadForm variant="portal" kind="blood_report" label="Upload blood report" accept=".pdf,image/*" />
                    <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)" }}>PDF or photo · max 10 MB.</div>
                  </div>
                </>
              )}
            </div>
          )}
          {bp?.generated ? (
            <div style={{ fontSize: 13 }}>
              🧬 <b style={{ color: "#166534" }}>Your Personal Health Blueprint is ready</b>{bp.generated_date ? ` (${bp.generated_date})` : ""}.
              {bp.consolidated && <div style={{ marginTop: 6, color: "var(--muted)" }}>{bp.consolidated}</div>}
              {bp.scores && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  {BP_SCORES.filter((s) => bp.scores && typeof bp.scores[s.key] === "number").map((s) => {
                    const b = band(bp.scores![s.key]);
                    return (
                      <span key={s.key} style={{ background: b.bg, color: b.color, borderRadius: 8, padding: "4px 9px", fontSize: 11, fontWeight: 600 }}>
                        {s.label}: {bp.scores![s.key]} · {b.label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>Your blueprint is being prepared.</div>
          )}
        </>
      )}

      {/* Latest measurement */}
      {m && card(
        <>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>📏 Latest measurement <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}>· {m.date}</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12, fontSize: 14 }}>
            <div><div style={{ color: "var(--muted)", fontSize: 11 }}>Weight</div>{m.weight != null ? `${m.weight} kg` : "—"}</div>
            <div><div style={{ color: "var(--muted)", fontSize: 11 }}>BMI</div>{m.bmi ?? "—"}</div>
            <div><div style={{ color: "var(--muted)", fontSize: 11 }}>Body fat</div>{m.body_fat != null ? `${m.body_fat}%` : "—"}</div>
            <div><div style={{ color: "var(--muted)", fontSize: 11 }}>Muscle</div>{m.muscle_mass != null ? `${m.muscle_mass} kg` : "—"}</div>
            <div><div style={{ color: "var(--muted)", fontSize: 11 }}>Visceral fat</div>{m.visceral_fat ?? "—"}</div>
          </div>
        </>
      )}

      {/* Today's meals */}
      {showMeals && card(
        <>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>🍽️ Today&apos;s meals</div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>Log what you eat and ask your dietitian anything.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {MEALS.map((m) => (
              <MealSelfForm key={m.key} meal={m.key} label={m.label} icon={m.icon} log={mealMap.get(m.key) ?? null} />
            ))}
          </div>
        </>
      )}

      {/* My invoices */}
      {invoices.length > 0 && card(
        <>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>💳 My invoices</div>
          {invoices.map((i) => (
            <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>INV-{String(i.num ?? 0).padStart(3, "0")}</span>
              <span style={{ flex: 1 }}>{i.description}</span>
              <b>₹{Number(i.amount).toLocaleString("en-IN")}</b>
              <span style={{ background: i.status === "Paid" ? "var(--green-bg)" : i.status === "Unpaid" ? "var(--amber-bg)" : "#eef2f1", color: i.status === "Paid" ? "#166534" : i.status === "Unpaid" ? "#92400e" : "var(--muted)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{i.status}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>Pay unpaid invoices at the front desk. Online payment coming soon.</div>
        </>
      )}

      {/* My files & progress photos */}
      {card(
        <>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>My files &amp; progress photos</div>
          <FilesGrid files={files} />
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Add a progress photo</div>
            <FileUploadForm variant="portal" kind="progress_photo" label="Upload photo" accept="image/*" />
          </div>
        </>
      )}

      <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--muted)" }}>
        Cureocity · Your data is private and visible only to you and your care team.
      </div>
    </div>
  );
}
