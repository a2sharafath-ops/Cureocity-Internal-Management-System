import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getViewRole } from "@/lib/auth";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { todayISO } from "@/lib/today";

export const dynamic = "force-dynamic";

const TODAY = todayISO();

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function fmtHour(h: number | null) {
  if (h == null) return "—";
  const am = h < 12; const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${am ? "AM" : "PM"}`;
}
const money = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };

function Kpi({ icon, iconBg, iconColor, label, value, sub, href }: { icon: string; iconBg: string; iconColor: string; label: string; value: number | string; sub: string; href: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit", flex: 1, minWidth: 210 }}>
      <div style={{ ...card, padding: "16px 18px", height: "100%" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, color: iconColor, display: "grid", placeItems: "center", fontSize: 20, marginBottom: 10 }}>{icon}</div>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>{label}</div>
        <div style={{ fontSize: 30, fontWeight: 800, margin: "1px 0 2px" }}>{value}</div>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>{sub} →</div>
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const me = await getProfile();
  const { effective } = await getViewRole();
  const role = effective;
  const isOps = ["Administrator", "Manager", "Front Desk"].includes(role);
  const isPro = role === "Health Professional";

  const supabase = createClient();
  const monthStart = TODAY.slice(0, 7) + "-01";
  const in30 = addDays(TODAY, 30);
  const overdueCut = addDays(TODAY, -14);

  const fullDate = new Date(TODAY + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const monthLabel = new Date(TODAY + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const [clientsC, leadsC, apptRes, sessRes, paidRes, renewC, overdueC, consultsPend, fuOverdueC, fuTodayRes] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("appointments").select("id, type, hour, status, clients(id, name)").eq("date", TODAY).order("hour"),
    supabase.from("sessions").select("id, hour, status, clients(id, name), staff(name)").eq("date", TODAY).order("hour"),
    supabase.from("invoices").select("amount").eq("status", "Paid").gte("paid_date", monthStart),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active").lte("renews_on", in30),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "Unpaid").lte("issued_date", overdueCut),
    supabase.from("consultations").select("id, kind, clients(id, name)").neq("status", "completed").order("created_at", { ascending: false }).limit(8),
    supabase.from("followups").select("id", { count: "exact", head: true }).eq("status", "pending").lt("due_date", TODAY),
    supabase.from("followups").select("id, priority").eq("status", "pending").eq("due_date", TODAY),
  ]);

  const appts = (apptRes.data ?? []) as unknown as { id: string; type: string | null; hour: number; status: string; clients: { id: string; name: string } | null }[];
  const sessions = (sessRes.data ?? []) as unknown as { id: string; hour: number; status: string; clients: { id: string; name: string } | null; staff: { name: string } | null }[];
  const paid = (paidRes.data ?? []) as { amount: number }[];
  const pconsults = (consultsPend.data ?? []) as unknown as { id: string; kind: string; clients: { id: string; name: string } | null }[];

  const scheduledAppts = appts.filter((a) => a.status === "scheduled");
  const assessToday = scheduledAppts.filter((a) => (a.type ?? "").toLowerCase().includes("assess")).length;
  const trainToday = sessions.filter((s) => s.status === "scheduled");
  const revenue = paid.reduce((s, i) => s + Number(i.amount), 0);
  const checkedIn = sessions.filter((s) => s.status === "completed").length;
  const scheduleTotal = scheduledAppts.length + sessions.length;
  const fuOverdue = fuOverdueC.count ?? 0;
  const fuToday = (fuTodayRes.data ?? []) as { id: string; priority: string }[];
  const fuMandatory = fuToday.filter((f) => f.priority === "mandatory").length;

  const pill = (label: string, href: string, active = false) => (
    <Link href={href} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: "none", border: "1px solid var(--border)", background: active ? "var(--teal)" : "#fff", color: active ? "#fff" : "var(--muted)" }}>{label}</Link>
  );
  const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: ".4px", color: "var(--muted)", textTransform: "uppercase", margin: "0 0 8px" };

  // ---- Non-ops focused view (clinicians / others) ----
  if (!isOps) {
    return (
      <div style={{ maxWidth: 1080 }}>
        <RealtimeRefresh tables={["sessions", "consultations", "appointments"]} />
        <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>{fullDate}</div>
        {isPro ? (
          <>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
              <Kpi icon="🗓" iconBg="var(--amber-bg)" iconColor="#b45309" label="Sessions Today" value={trainToday.length} sub="Trainer board" href="/trainer" />
              <Kpi icon="🩺" iconBg="#e0f2f1" iconColor="var(--teal-dark)" label="Consultations to complete" value={pconsults.length} sub="Professional workspace" href="/pro" />
              <Kpi icon="🧬" iconBg="#ede9fe" iconColor="#6d28d9" label="Patients today" value={scheduledAppts.length} sub="Appointment calendar" href="/appointments" />
            </div>
            <div style={{ ...card, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", fontWeight: 700 }}>Consultations to complete</div>
              {pconsults.length ? pconsults.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
                  <span style={{ background: "#e0f2f1", color: "var(--teal-dark)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{c.kind}</span>
                  {c.clients ? <Link href={`/clients/${c.clients.id}`} style={{ fontWeight: 600, fontSize: 14, textDecoration: "none", color: "inherit" }}>{c.clients.name}</Link> : "—"}
                </div>
              )) : <div style={{ padding: 16, color: "var(--muted)", fontSize: 13, borderTop: "1px solid var(--border)" }}>Nothing pending.</div>}
            </div>
          </>
        ) : (
          <div style={{ ...card, padding: "18px 20px", color: "var(--muted)", fontSize: 13 }}>
            Welcome, {me?.name}. Your role ({role}) has a focused view — more tools for your area appear here as they’re enabled.
          </div>
        )}
      </div>
    );
  }

  // ---- Ops view (Admin / Manager / Front Desk) — mirrors the prototype ----
  return (
    <div style={{ maxWidth: 1180 }}>
      <RealtimeRefresh tables={["sessions", "appointments", "leads", "consultations", "invoices", "subscriptions"]} />

      {/* action row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>{fullDate}</div>
        <span style={{ flex: 1 }} />
        <Link href="/messages" title="Communications" style={{ ...card, width: 36, height: 36, display: "grid", placeItems: "center", textDecoration: "none", fontSize: 16 }}>💬</Link>
        <Link href="/appointments" style={{ border: "1px solid var(--border)", background: "#fff", color: "var(--teal-dark)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Book a slot</Link>
        <Link href="/leads" style={{ background: "var(--teal)", color: "#fff", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>+ Add Lead</Link>
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {pill("📊 Overview", "/dashboard", true)}
        {pill("🚪 Access & Check-in", "/access")}
        {pill("🎟️ Passes", "/pos")}
        {pill("🛒 Store", "/pos")}
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        <Kpi icon="👤" iconBg="#e0f2f1" iconColor="var(--teal-dark)" label="Active Clients" value={clientsC.count ?? 0} sub={`${leadsC.count ?? 0} leads in pipeline`} href="/leads" />
        <Kpi icon="🗓" iconBg="#dbeafe" iconColor="#2563eb" label="Sessions Today" value={scheduledAppts.length + trainToday.length} sub={`${scheduledAppts.length} consult${scheduledAppts.length === 1 ? "" : "s"} (${assessToday} assessment${assessToday === 1 ? "" : "s"}) · ${trainToday.length} training`} href="/appointments" />
        <Kpi icon="🧾" iconBg="var(--green-bg)" iconColor="#166534" label={`Revenue — ${monthLabel}`} value={money(revenue)} sub={`this month · from ${paid.length} paid invoice${paid.length === 1 ? "" : "s"}`} href="/billing" />
        <Kpi icon="📦" iconBg="var(--amber-bg)" iconColor="#b45309" label="Client Renewals" value={renewC.count ?? 0} sub="package ending ≤30 days or low credits" href="/subscriptions" />
      </div>

      {/* two-column body */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
        {/* Today's schedule */}
        <div style={{ ...card, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <b style={{ fontSize: 15 }}>Today’s Schedule — {new Date(TODAY + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" })}</b>
            <span style={{ background: "#e0f2f1", color: "var(--teal-dark)", borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 600 }}>{scheduleTotal} total</span>
            <span style={{ flex: 1 }} />
            <Link href="/appointments" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, textDecoration: "none", color: "var(--teal-dark)", fontWeight: 600 }}>Calendar →</Link>
          </div>

          <div style={sectionTitle}>Consultations &amp; Assessments ({scheduledAppts.length})</div>
          {scheduledAppts.length ? scheduledAppts.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
              <span style={{ width: 80, color: "var(--muted)", fontSize: 13 }}>{fmtHour(a.hour)}</span>
              {a.clients ? <Link href={`/clients/${a.clients.id}`} style={{ fontWeight: 600, fontSize: 14, textDecoration: "none", color: "inherit" }}>{a.clients.name}</Link> : "—"}
              <span style={{ flex: 1 }} />
              <span style={{ color: "var(--muted)", fontSize: 12 }}>{a.type ?? "Consultation"}</span>
            </div>
          )) : <div style={{ color: "var(--muted)", fontSize: 13, padding: "10px 0 16px", textAlign: "center" }}>No consultations today</div>}

          <div style={{ ...sectionTitle, marginTop: 16 }}>Strength Sessions Today ({sessions.length})</div>
          {sessions.length ? sessions.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
              <span style={{ width: 80, color: "var(--muted)", fontSize: 13 }}>{fmtHour(s.hour)}</span>
              {s.clients ? <Link href={`/clients/${s.clients.id}`} style={{ fontWeight: 600, fontSize: 14, textDecoration: "none", color: "inherit" }}>{s.clients.name}</Link> : "—"}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: s.status === "completed" ? "#166534" : "var(--muted)" }}>{s.status === "completed" ? "✓ checked in" : s.staff?.name ?? ""}</span>
            </div>
          )) : <div style={{ color: "var(--muted)", fontSize: 13, padding: "10px 0 6px", textAlign: "center" }}>No training sessions today</div>}
        </div>

        {/* right column */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div style={{ ...card, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <b style={{ fontSize: 15 }}>📞 Front Desk Follow-ups</b>
              <span style={{ flex: 1 }} />
              <Link href="/followups" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, textDecoration: "none", color: "var(--teal-dark)", fontWeight: 600 }}>Open queue →</Link>
            </div>
            <div style={sectionTitle}>🔥 Immediate priority — overdue ({fuOverdue})</div>
            {fuOverdue ? (
              <Link href="/followups" style={{ display: "block", color: "var(--red)", fontSize: 13, textDecoration: "none", padding: "2px 0 12px" }}>{fuOverdue} overdue follow-up{fuOverdue === 1 ? "" : "s"} — open the queue →</Link>
            ) : <div style={{ color: "var(--muted)", fontSize: 13, padding: "2px 0 12px" }}>Nothing overdue</div>}
            <div style={sectionTitle}>📌 Today’s mandatory ({fuMandatory})</div>
            {fuToday.length ? (
              <Link href="/followups" style={{ fontSize: 13, textDecoration: "none", color: "inherit" }}>{fuToday.length} due today{fuMandatory ? ` · ${fuMandatory} mandatory` : ""} →</Link>
            ) : <div style={{ color: "var(--muted)", fontSize: 13 }}>None due today</div>}
          </div>

          <div style={{ ...card, padding: "16px 18px" }}>
            <b style={{ fontSize: 15 }}>🏃 Training Attendance</b>
            <div style={{ margin: "10px 0 6px", fontSize: 14 }}>
              Today: <b>{checkedIn} of {sessions.length}</b> training clients checked in
            </div>
            <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12 }}>
              Check-in is run by trainers (PT &amp; Comprehensive clients) on the trainer board.
            </div>
            <Link href="/trainer" style={{ border: "1px solid var(--border)", background: "#fff", color: "var(--teal-dark)", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Open Trainer Workspace →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
