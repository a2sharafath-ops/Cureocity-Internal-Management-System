import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, canEmr } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { loadClientStatuses, clientStatus, disciplineForRole } from "@/lib/client-status";
import ClientStatusBadge from "@/components/ClientStatusBadge";

export const dynamic = "force-dynamic";

export default async function CareTeamPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/careteam")) redirect("/dashboard");

  const today = todayISO();
  const supabase = createClient();
  // Counts come from a security-definer RPC so they stay whole-team accurate
  // even though each discipline can only read its own slice of the data.
  const { data: countRows } = await supabase.rpc("care_team_counts", { p_today: today });
  const c0 = (Array.isArray(countRows) ? countRows[0] : countRows) as {
    consults_pending: number; sessions_today: number; orders_open: number;
    blood_pending: number; appts_today: number; meals_today: number;
  } | undefined;
  const consultsPend = { count: c0?.consults_pending ?? 0 };
  const sessToday = { count: c0?.sessions_today ?? 0 };
  const ordersOpen = { count: c0?.orders_open ?? 0 };
  const bloodPend = { count: c0?.blood_pending ?? 0 };
  const apptsToday = { count: c0?.appts_today ?? 0 };
  const mealsToday = { count: c0?.meals_today ?? 0 };

  // A clinician's own clients + their current status for this discipline, so the
  // "where is each of my clients" view is the same here as everywhere else.
  const viewerDisc = disciplineForRole(me.role);
  let myClients: { id: string; name: string; status: ReturnType<typeof clientStatus> }[] = [];
  if (viewerDisc && me.staffId) {
    const { data: asg } = await supabase.from("client_assignments").select("client_id").eq("staff_id", me.staffId).eq("discipline", viewerDisc);
    const ids = ((asg ?? []) as { client_id: string }[]).map((r) => r.client_id);
    if (ids.length) {
      const { data: cl } = await supabase.from("clients").select("id, name").in("id", ids);
      const statuses = await loadClientStatuses(supabase, ids, today);
      myClients = ((cl ?? []) as { id: string; name: string }[]).map((c) => ({ id: c.id, name: c.name, status: clientStatus(statuses.get(c.id), viewerDisc) }));
    }
  }

  const card = (icon: string, title: string, sub: string, count: number | null, countLabel: string, href: string, color: string) => (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: color, display: "grid", placeItems: "center", fontSize: 20 }}>{icon}</div>
          <div><div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div><div style={{ color: "var(--muted)", fontSize: 12 }}>{sub}</div></div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: (count ?? 0) > 0 ? "var(--brand-text)" : "var(--muted)" }}>{count ?? 0}</span>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>{countLabel}</span>
          <span style={{ flex: 1 }} />
          <span style={{ color: "var(--brand-text)", fontSize: 13, fontWeight: 600 }}>Open →</span>
        </div>
      </div>
    </Link>
  );

  return (
    <div style={{ maxWidth: 1000 }}>
      <RealtimeRefresh tables={["consultations", "sessions", "orders", "blood_requests", "appointments", "meal_logs"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Care Team Hub</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>Every clinical tool in one place — records, orders, blueprint, telehealth &amp; more.</p>

      {myClients.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "14px 18px", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Your clients · {myClients.length}</div>
          <div style={{ display: "grid", gap: 6 }}>
            {myClients.map((c) => (
              <Link key={c.id} href={`/clients/${c.id}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit", padding: "4px 0" }}>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 160 }}>{c.name}</span>
                <ClientStatusBadge status={c.status} size="sm" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {card("🧠", "Whiteboard", "Daily team meeting", null, "clients on the board", "/whiteboard", "var(--purple-bg)")}
        {card("🩺", "Consultations", "Doctor · Coach · Psychologist", consultsPend.count ?? 0, "to complete", "/pro", "var(--brand-tint)")}
        {canEmr(me.role) && card("📋", "Patient Records", "EMR — problems, meds, vitals", null, "open charts", "/emr", "var(--blue-bg)")}
        {canEmr(me.role) && card("🧪", "Orders & Labs", "Prescriptions & results", ordersOpen.count ?? 0, "open orders", "/orders", "var(--amber-bg)")}
        {card("🍽", "Meal Monitoring", "Dietitian workspace", mealsToday.count ?? 0, "logs today", "/meals", "var(--brand-tint)")}
        {card("🎽", "Session Board", "Session check-ins", sessToday.count ?? 0, "sessions today", "/trainer", "var(--purple-bg)")}
        {card("🧬", "BluePrint", "Blood reports & 9 scores", bloodPend.count ?? 0, "reports pending", "/blueprint", "var(--red-bg)")}
        {card("📅", "Appointment Calendar", "Consultations & assessments", apptsToday.count ?? 0, "today", "/appointments", "var(--blue-bg)")}
        {card("🏃", "Exercise Library", "Templates & assignments", null, "workouts", "/exlib", "var(--brand-tint)")}
        {card("📹", "Telehealth", "Video consultations", null, "video visits", "/telehealth", "var(--purple-bg)")}
      </div>
    </div>
  );
}
