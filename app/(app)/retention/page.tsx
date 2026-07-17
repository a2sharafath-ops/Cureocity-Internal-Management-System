import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, canRetention } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import RetentionHub, { type RiskRow, type NpsRow, type RefRow, type LoyRow } from "@/components/RetentionHub";

export const dynamic = "force-dynamic";

function daysBetween(a: string, b: string) { return Math.round((new Date(a + "T00:00:00").getTime() - new Date(b + "T00:00:00").getTime()) / 86400000); }
function loyaltyTier(p: number) { return p >= 2000 ? "Platinum" : p >= 1000 ? "Gold" : "Silver"; }

export default async function RetentionPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/retention")) redirect("/dashboard");
  const canAct = canRetention(me.role);
  const today = todayISO();
  const supabase = createClient();

  const [clientsR, sessionsR, subsR, invoicesR, npsR, referralsR, loyaltyR] = await Promise.all([
    supabase.from("clients").select("id, name, package_id, packages(name, price, is_facility)").order("name"),
    supabase.from("sessions").select("client_id, date"),
    supabase.from("subscriptions").select("client_id, status"),
    supabase.from("invoices").select("client_id, status, issued_date, amount"),
    supabase.from("nps_responses").select("id, client_id, score, comment, channel, created_at, clients(name)").order("created_at", { ascending: false }),
    supabase.from("referrals").select("id, referred_name, referred_phone, referred_email, status, reward_amount, clients:referrer_id(name)").order("created_at", { ascending: false }),
    supabase.from("loyalty").select("client_id, points, clients(name)").order("points", { ascending: false }),
  ]);

  const clients = ((clientsR.data ?? []) as unknown as { id: string; name: string; package_id: string | null; packages: { name: string; price: number; is_facility: boolean } | null }[]);
  const sessions = (sessionsR.data ?? []) as { client_id: string; date: string | null }[];
  const subs = (subsR.data ?? []) as { client_id: string; status: string }[];
  const invoices = (invoicesR.data ?? []) as { client_id: string | null; status: string; issued_date: string | null; amount: number }[];
  const nps = (npsR.data ?? []) as unknown as { id: string; client_id: string; score: number; comment: string | null; channel: string; created_at: string; clients: { name: string } | null }[];
  const referrals = (referralsR.data ?? []) as unknown as { id: string; referred_name: string; referred_phone: string | null; referred_email: string | null; status: string; reward_amount: number; clients: { name: string } | null }[];

  const lastSession = new Map<string, string>();
  for (const s of sessions) { if (!s.date) continue; const cur = lastSession.get(s.client_id); if (!cur || s.date > cur) lastSession.set(s.client_id, s.date); }
  const subByClient = new Map(subs.map((s) => [s.client_id, s.status]));
  const overdueByClient = new Map<string, number>();
  for (const inv of invoices) { if (!inv.client_id || inv.status !== "Unpaid" || !inv.issued_date) continue; if (daysBetween(today, inv.issued_date) >= 14) overdueByClient.set(inv.client_id, (overdueByClient.get(inv.client_id) ?? 0) + Number(inv.amount)); }
  const latestNps = new Map<string, number>();
  for (const r of nps) if (!latestNps.has(r.client_id)) latestNps.set(r.client_id, r.score);

  const risk: RiskRow[] = [];
  let revenueAtRisk = 0, high = 0, medium = 0;
  for (const c of clients) {
    const reasons: string[] = []; let score = 0;
    const sub = subByClient.get(c.id);
    if (sub === "cancelled") { score += 40; reasons.push("Subscription cancelled"); }
    else if (sub === "paused") { score += 20; reasons.push("Subscription paused"); }
    const last = lastSession.get(c.id);
    if (last) { const gap = daysBetween(today, last); if (gap >= 30) { score += 30; reasons.push(`No visit in ${gap}d`); } else if (gap >= 21) { score += 18; reasons.push(`No visit in ${gap}d`); } }
    const overdue = overdueByClient.get(c.id);
    if (overdue) { score += 20; reasons.push(`Overdue ₹${overdue.toLocaleString("en-IN")}`); }
    const n = latestNps.get(c.id);
    if (n !== undefined && n <= 6) { score += 25; reasons.push(`Detractor (NPS ${n})`); }
    if (score > 0) {
      const tier = score >= 50 ? "High" : score >= 30 ? "Medium" : "Low";
      if (tier === "High") high++; else if (tier === "Medium") medium++;
      if (tier !== "Low") revenueAtRisk += Number(c.packages?.price ?? 0);
      risk.push({ id: c.id, name: c.name, packageName: c.packages?.name ?? null, score, tier, reasons });
    }
  }
  risk.sort((a, b) => b.score - a.score);
  const atRiskCount = risk.filter((r) => r.tier !== "Low").length;
  const kpis = { high, medium, healthy: clients.length - atRiskCount, total: clients.length, revenueAtRisk };

  const total = nps.length;
  const promoters = nps.filter((r) => r.score >= 9).length;
  const passives = nps.filter((r) => r.score >= 7 && r.score <= 8).length;
  const detractors = nps.filter((r) => r.score <= 6).length;
  const npsStats = { total, promoters, passives, detractors, nps: total ? Math.round(((promoters - detractors) / total) * 100) : 0 };
  const npsList: NpsRow[] = nps.map((r) => ({ id: r.id, clientId: r.client_id, clientName: r.clients?.name ?? null, score: r.score, comment: r.comment, channel: r.channel, date: r.created_at.slice(0, 10) }));

  const refRows: RefRow[] = referrals.map((r) => ({ id: r.id, referredName: r.referred_name, referrerName: r.clients?.name ?? null, contact: r.referred_phone ?? r.referred_email ?? null, status: r.status, reward: Number(r.reward_amount) }));
  const loyalty: LoyRow[] = ((loyaltyR.data ?? []) as unknown as { client_id: string; points: number; clients: { name: string } | null }[]).map((l) => ({ clientId: l.client_id, name: l.clients?.name ?? "—", points: l.points, tier: loyaltyTier(l.points) }));

  return (
    <div style={{ maxWidth: 1120 }}>
      <RealtimeRefresh tables={["nps_responses", "referrals", "loyalty", "subscriptions", "sessions", "invoices"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 2px" }}>Retention</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>Churn risk · satisfaction (NPS) · referrals &amp; loyalty — keep members engaged.</p>

      <RetentionHub risk={risk} kpis={kpis} npsList={npsList} npsStats={npsStats} referrals={refRows} loyalty={loyalty} clients={clients.map((c) => ({ id: c.id, name: c.name }))} canAct={canAct} />
    </div>
  );
}
