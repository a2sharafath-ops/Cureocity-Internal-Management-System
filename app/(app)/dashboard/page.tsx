import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getViewRole } from "@/lib/auth";
import { moduleScope } from "@/lib/deployment";
import { isClinician } from "@/lib/roles";
import { disciplineLabel } from "@/lib/disciplines";
import OwnerDashboard from "@/components/OwnerDashboard";
import ManagerDashboard from "@/components/ManagerDashboard";
import FinanceDashboard from "@/components/FinanceDashboard";
import HrDashboard from "@/components/HrDashboard";
import AttentionPanel from "@/components/AttentionPanel";
import OpsTabs from "@/components/OpsTabs";
import { frontDeskFlags } from "@/lib/frontdesk-attention";
import { careWorkFlags } from "@/lib/care-attention";
import TodayAgenda from "@/components/TodayAgenda";
import { todayAgenda } from "@/lib/today-agenda";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { RingMeter } from "@/components/Meters";
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

// Icon props are accepted but no longer rendered — the cards read cleaner
// without them. Kept optional so existing call sites don't need editing.
function Kpi({ label, value, sub, href }: { icon?: string; iconBg?: string; iconColor?: string; label: string; value: number | string; sub: string; href: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit", flex: 1, minWidth: 210 }}>
      <div style={{ ...card, padding: "18px 20px", height: "100%" }}>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>{label}</div>
        <div style={{ fontSize: 30, fontWeight: 800, margin: "4px 0 2px" }}>{value}</div>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>{sub} →</div>
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const me = await getProfile();
  const { effective } = await getViewRole();

  // A module-scoped deployment has no dashboard — send them to the module.
  const scope = moduleScope();
  if (scope) redirect(scope.home);

  // Super Admin gets the owner view — money, exceptions, control. (Previewing
  // another role drops them into that role's dashboard instead.)
  if (effective === "Super Admin") return <OwnerDashboard name={me?.name ?? "there"} />;

  // Manager gets the same shape pointed at the floor: money, exceptions, then
  // Today and Growth first, with utilisation and the schedule below.
  if (effective === "Manager") return <ManagerDashboard name={me?.name ?? "there"} />;
  if (effective === "Finance") return <FinanceDashboard name={me?.name ?? "there"} />;
  if (effective === "HR") return <HrDashboard name={me?.name ?? "there"} role={effective} />;

  const role = effective;
  const isOps = ["Administrator", "Manager", "Front Desk"].includes(role);
  const isPro = isClinician(role);

  // Clinicians' home is their discipline workspace — no separate dashboard.
  if (isPro) redirect("/workspace");

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
    supabase.from("followups").select("id, day, label").eq("status", "pending").lt("due_date", TODAY),
    supabase.from("followups").select("id, priority, day, label").eq("status", "pending").eq("due_date", TODAY),
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
  // The Day-2 diet chart explanation is the Health Coach's to schedule now, so
  // it's excluded from the front desk's follow-up counts.
  const isCoachOwnedFu = (f: { day: number | null; label: string | null }) => f.day === 2 && /explanation/i.test(f.label ?? "");
  const fuOverdue = ((fuOverdueC.data ?? []) as { id: string; day: number | null; label: string | null }[]).filter((f) => !isCoachOwnedFu(f)).length;
  const fuToday = ((fuTodayRes.data ?? []) as { id: string; priority: string; day: number | null; label: string | null }[]).filter((f) => !isCoachOwnedFu(f));
  const fuMandatory = fuToday.filter((f) => f.priority === "mandatory").length;

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
              <Kpi icon="🗓" iconBg="var(--amber-bg)" iconColor="var(--amber-text-soft)" label="Sessions today" value={trainToday.length} sub="Fitness Trainer board" href="/trainer" />
              <Kpi icon="🩺" iconBg="var(--brand-tint)" iconColor="var(--brand-text)" label="Consultations to complete" value={pconsults.length} sub="Professional workspace" href="/pro" />
              <Kpi icon="🧬" iconBg="var(--purple-bg)" iconColor="var(--purple-text)" label="Clients today" value={scheduledAppts.length} sub="Appointment calendar" href="/appointments" />
            </div>
            <div style={{ ...card, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", fontWeight: 700 }}>Consultations to complete</div>
              {pconsults.length ? pconsults.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
                  <span style={{ background: "var(--brand-tint)", color: "var(--brand-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{disciplineLabel(c.kind)}</span>
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

  // ---- Ops view (Admin / Front Desk) — mirrors the prototype ----
  // Front desk sees BOTH their own exceptions (billing, blood, intakes) and the
  // clinician-deliverable flags (diet chart / workout plan not done) — the same
  // "Remind {clinician}" action the Owner/Manager dashboards and the client
  // Package-status panel already offer. One capability, one behaviour everywhere.
  const [fdFlags, careFlags, agenda] = await Promise.all([frontDeskFlags(TODAY), careWorkFlags(TODAY), todayAgenda(TODAY)]);
  const sevRank = { high: 0, med: 1, low: 2 } as const;
  // Dedupe tasks raised by both queues (e.g. a blood report appears in both the
  // front-desk and care-work lists). Care flags go first so the named-owner
  // version wins over the generic one.
  const seenKey = new Set<string>();
  const opsFlags = [...careFlags, ...fdFlags]
    .filter((f) => { if (!f.dedupeKey) return true; if (seenKey.has(f.dedupeKey)) return false; seenKey.add(f.dedupeKey); return true; })
    .sort((a, b) => sevRank[a.sev] - sevRank[b.sev]);
  const agendaDate = new Date(TODAY + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
  return (
    <div style={{ maxWidth: 1180 }}>
      <RealtimeRefresh tables={["sessions", "appointments", "leads", "consultations", "invoices", "subscriptions"]} />

      <AttentionPanel flags={opsFlags} />

      {/* controls: tabs (left) + quick actions (right) */}
      <OpsTabs active="overview" right={
        <>
          <span style={{ color: "var(--muted)", fontSize: 13, marginRight: 4 }}>{fullDate}</span>
          <Link href="/appointments" style={{ border: "1px solid var(--border)", background: "#fff", color: "var(--brand-text)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Book a slot</Link>
          <Link href="/leads" style={{ background: "var(--ink)", color: "#fff", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>+ Add lead</Link>
        </>
      } />

      {/* KPIs */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        <Kpi icon="👤" iconBg="var(--brand-tint)" iconColor="var(--brand-text)" label="Clients" value={clientsC.count ?? 0} sub={`${leadsC.count ?? 0} leads in pipeline`} href="/leads" />
        <Kpi icon="🗓" iconBg="var(--blue-bg)" iconColor="var(--blue)" label="Sessions today" value={scheduledAppts.length + trainToday.length} sub={`${scheduledAppts.length} consult${scheduledAppts.length === 1 ? "" : "s"} (${assessToday} assessment${assessToday === 1 ? "" : "s"}) · ${trainToday.length} training`} href="/appointments" />
        <Kpi icon="🧾" iconBg="var(--green-bg)" iconColor="var(--green-text)" label={`Revenue — ${monthLabel}`} value={money(revenue)} sub={`this month · from ${paid.length} paid invoice${paid.length === 1 ? "" : "s"}`} href="/billing" />
        <Kpi icon="📦" iconBg="var(--amber-bg)" iconColor="var(--amber-text-soft)" label="Client renewals" value={renewC.count ?? 0} sub="package ending ≤30 days or low credits" href="/subscriptions" />
        {sessions.length > 0 && (
          <div style={{ ...card, display: "flex", alignItems: "center", gap: 16, padding: "12px 18px", minWidth: 230 }}>
            <RingMeter value={Math.round((checkedIn / sessions.length) * 100)} size={72} stroke={9} label="Check-in rate" />
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}><b style={{ color: "var(--ink)", fontSize: 15 }}>{checkedIn}/{sessions.length}</b><div>training clients<br />checked in today</div></div>
          </div>
        )}
      </div>

      {/* two-column body */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
        {/* Today's agenda — appointments, sessions, follow-ups & care deadlines */}
        <TodayAgenda agenda={agenda} dateLabel={agendaDate} />

        {/* right column */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div style={{ ...card, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <b style={{ fontSize: 15 }}>Front Desk follow-ups</b>
              <span style={{ flex: 1 }} />
              <Link href="/followups" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, textDecoration: "none", color: "var(--brand-text)", fontWeight: 600 }}>Open queue →</Link>
            </div>
            <div style={sectionTitle}>Immediate priority — overdue ({fuOverdue})</div>
            {fuOverdue ? (
              <Link href="/followups" style={{ display: "block", color: "var(--red)", fontSize: 13, textDecoration: "none", padding: "2px 0 12px" }}>{fuOverdue} overdue follow-up{fuOverdue === 1 ? "" : "s"} — open the queue →</Link>
            ) : <div style={{ color: "var(--muted)", fontSize: 13, padding: "2px 0 12px" }}>Nothing overdue</div>}
            <div style={sectionTitle}>Today’s mandatory ({fuMandatory})</div>
            {fuToday.length ? (
              <Link href="/followups" style={{ fontSize: 13, textDecoration: "none", color: "inherit" }}>{fuToday.length} due today{fuMandatory ? ` · ${fuMandatory} mandatory` : ""} →</Link>
            ) : <div style={{ color: "var(--muted)", fontSize: 13 }}>None due today</div>}
          </div>

          <div style={{ ...card, padding: "16px 18px" }}>
            <b style={{ fontSize: 15 }}>Training attendance</b>
            <div style={{ margin: "10px 0 6px", fontSize: 14 }}>
              Today: <b>{checkedIn} of {sessions.length}</b> training clients checked in
            </div>
            <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12 }}>
              Check-in is run by Fitness Trainers (PT &amp; Comprehensive clients) on their own board.
            </div>
            <Link href="/trainer" style={{ border: "1px solid var(--border)", background: "#fff", color: "var(--brand-text)", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Open Fitness Trainer workspace →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
