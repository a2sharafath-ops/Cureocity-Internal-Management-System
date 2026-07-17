import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import RealtimeRefresh from "@/components/RealtimeRefresh";

export const dynamic = "force-dynamic";

export default async function CareTeamPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/careteam")) redirect("/dashboard");

  const today = todayISO();
  const supabase = createClient();
  const [consultsPend, sessToday, ordersOpen, bloodPend, apptsToday, mealsToday] = await Promise.all([
    supabase.from("consultations").select("id", { count: "exact", head: true }).neq("status", "completed"),
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "scheduled"),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["ordered", "collected"]),
    supabase.from("blood_requests").select("client_id", { count: "exact", head: true }).eq("submitted", false),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "scheduled"),
    supabase.from("meal_logs").select("id", { count: "exact", head: true }).eq("date", today),
  ]);

  const card = (icon: string, title: string, sub: string, count: number | null, countLabel: string, href: string, color: string) => (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: color, display: "grid", placeItems: "center", fontSize: 20 }}>{icon}</div>
          <div><div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div><div style={{ color: "var(--muted)", fontSize: 12 }}>{sub}</div></div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: (count ?? 0) > 0 ? "var(--teal-dark)" : "var(--muted)" }}>{count ?? 0}</span>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>{countLabel}</span>
          <span style={{ flex: 1 }} />
          <span style={{ color: "var(--teal-dark)", fontSize: 13, fontWeight: 600 }}>Open →</span>
        </div>
      </div>
    </Link>
  );

  return (
    <div style={{ maxWidth: 1000 }}>
      <RealtimeRefresh tables={["consultations", "sessions", "orders", "blood_requests", "appointments", "meal_logs"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Care Team Hub</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>Every clinical workspace in one place — Doctor, Dietitian, Trainer &amp; Coach.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {card("🩺", "Consultations", "Doctor · Coach · Psychologist", consultsPend.count ?? 0, "to complete", "/pro", "#e0f2f1")}
        {card("📋", "Patient Records", "EMR — problems, meds, vitals", null, "open charts", "/emr", "#dbeafe")}
        {card("🧪", "Orders & Labs", "Prescriptions & results", ordersOpen.count ?? 0, "open orders", "/orders", "#fef3c7")}
        {card("🍽", "Meal Monitoring", "Dietitian workspace", mealsToday.count ?? 0, "logs today", "/meals", "#e0f2f1")}
        {card("🎽", "Trainer", "Session board & check-ins", sessToday.count ?? 0, "sessions today", "/trainer", "#ede9fe")}
        {card("🧬", "BluePrint", "Blood reports & 9 scores", bloodPend.count ?? 0, "reports pending", "/blueprint", "#fee2e2")}
        {card("📅", "Appointments", "Consultations & assessments", apptsToday.count ?? 0, "today", "/appointments", "#dbeafe")}
        {card("🏃", "Exercise Library", "Templates & assignments", null, "workouts", "/exlib", "#e0f2f1")}
      </div>
    </div>
  );
}
