import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TODAY = "2026-07-02";

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

  const [{ data: sessions }, { data: consults }, { data: bpData }, { data: bloodData }] = await Promise.all([
    supabase.from("sessions").select("seq, date, hour, status").eq("client_id", client.id).order("seq"),
    supabase.from("consultations").select("kind, summary, created_at").eq("client_id", client.id).eq("shared", true).order("created_at", { ascending: false }),
    supabase.from("blueprints").select("generated, generated_date, consolidated").eq("client_id", client.id).eq("generated", true).maybeSingle(),
    supabase.from("blood_requests").select("submitted, submitted_date, requested_at").eq("client_id", client.id).maybeSingle(),
  ]);

  const sess = (sessions ?? []) as { seq: number; date: string; hour: number; status: string }[];
  const shared = (consults ?? []) as { kind: string; summary: string | null; created_at: string }[];
  const bp = bpData as { generated: boolean; generated_date: string | null; consolidated: string | null } | null;
  const blood = bloodData as { submitted: boolean; submitted_date: string | null; requested_at: string | null } | null;

  const done = sess.filter((s) => s.status === "completed").length;
  const upcoming = sess.filter((s) => s.status === "scheduled");

  return (
    <div>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, var(--teal-dark), var(--teal))", color: "#fff", borderRadius: "var(--radius)", padding: "22px 24px", marginBottom: 18 }}>
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
            <div style={{ fontSize: 13, marginBottom: 6 }}>
              🩸 Blood report: {blood.submitted ? <b style={{ color: "#166534" }}>received ✓</b> : <b style={{ color: "#92400e" }}>requested — please submit</b>}
            </div>
          )}
          {bp?.generated ? (
            <div style={{ fontSize: 13 }}>
              🧬 <b style={{ color: "#166534" }}>Your Personal Health Blueprint is ready</b>{bp.generated_date ? ` (${bp.generated_date})` : ""}.
              {bp.consolidated && <div style={{ marginTop: 6, color: "var(--muted)" }}>{bp.consolidated}</div>}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>Your blueprint is being prepared.</div>
          )}
        </>
      )}

      <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--muted)" }}>
        Cureocity · Your data is private and visible only to you and your care team.
      </div>
    </div>
  );
}
