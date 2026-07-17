import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import NpsForm from "@/components/NpsForm";
import ReferralForm from "@/components/ReferralForm";
import ReferralActions from "@/components/ReferralActions";

export const dynamic = "force-dynamic";

function daysBetween(a: string, b: string) {
  return Math.round((new Date(a + "T00:00:00").getTime() - new Date(b + "T00:00:00").getTime()) / 86400000);
}
function money(n: number) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

export default async function RetentionPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/retention")) redirect("/dashboard");

  const supabase = createClient();
  const [clientsR, sessionsR, subsR, invoicesR, npsR, referralsR] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("sessions").select("client_id, date, status"),
    supabase.from("subscriptions").select("client_id, status"),
    supabase.from("invoices").select("client_id, status, issued_date, amount"),
    supabase.from("nps_responses").select("id, client_id, score, comment, channel, created_by, created_at, clients(name)").order("created_at", { ascending: false }),
    supabase.from("referrals").select("id, referred_name, referred_phone, referred_email, status, reward_amount, created_at, clients:referrer_id(name)").order("created_at", { ascending: false }),
  ]);

  const clients = (clientsR.data ?? []) as { id: string; name: string }[];
  const sessions = (sessionsR.data ?? []) as { client_id: string; date: string | null; status: string }[];
  const subs = (subsR.data ?? []) as { client_id: string; status: string }[];
  const invoices = (invoicesR.data ?? []) as { client_id: string | null; status: string; issued_date: string | null; amount: number }[];
  const nps = (npsR.data ?? []) as unknown as { id: string; client_id: string; score: number; comment: string | null; channel: string; created_by: string | null; created_at: string; clients: { name: string } | null }[];
  const referrals = (referralsR.data ?? []) as unknown as { id: string; referred_name: string; referred_phone: string | null; referred_email: string | null; status: string; reward_amount: number; created_at: string; clients: { name: string } | null }[];

  const today = todayISO();

  // ---- at-risk scoring -----------------------------------------------------
  const lastSession = new Map<string, string>();
  for (const s of sessions) {
    if (!s.date) continue;
    const cur = lastSession.get(s.client_id);
    if (!cur || s.date > cur) lastSession.set(s.client_id, s.date);
  }
  const subByClient = new Map<string, string>();
  for (const s of subs) subByClient.set(s.client_id, s.status);
  const overdueByClient = new Map<string, number>();
  for (const inv of invoices) {
    if (!inv.client_id || inv.status !== "Unpaid" || !inv.issued_date) continue;
    if (daysBetween(today, inv.issued_date) >= 14) overdueByClient.set(inv.client_id, (overdueByClient.get(inv.client_id) ?? 0) + Number(inv.amount));
  }
  const latestNps = new Map<string, number>();
  for (const r of nps) if (!latestNps.has(r.client_id)) latestNps.set(r.client_id, r.score); // nps ordered desc

  type Risk = { id: string; name: string; score: number; reasons: string[] };
  const atRisk: Risk[] = [];
  for (const c of clients) {
    const reasons: string[] = [];
    let score = 0;
    const sub = subByClient.get(c.id);
    if (sub === "cancelled") { score += 40; reasons.push("Subscription cancelled"); }
    else if (sub === "paused") { score += 20; reasons.push("Subscription paused"); }
    const last = lastSession.get(c.id);
    if (last) {
      const gap = daysBetween(today, last);
      if (gap >= 30) { score += 30; reasons.push(`No visit in ${gap}d`); }
      else if (gap >= 21) { score += 18; reasons.push(`No visit in ${gap}d`); }
    }
    const overdue = overdueByClient.get(c.id);
    if (overdue) { score += 20; reasons.push(`Overdue ${money(overdue)}`); }
    const n = latestNps.get(c.id);
    if (n !== undefined && n <= 6) { score += 25; reasons.push(`Detractor (NPS ${n})`); }
    if (score > 0) atRisk.push({ id: c.id, name: c.name, score, reasons });
  }
  atRisk.sort((a, b) => b.score - a.score);

  // ---- NPS summary ---------------------------------------------------------
  const total = nps.length;
  const promoters = nps.filter((r) => r.score >= 9).length;
  const passives = nps.filter((r) => r.score >= 7 && r.score <= 8).length;
  const detractors = nps.filter((r) => r.score <= 6).length;
  const npsScore = total ? Math.round(((promoters - detractors) / total) * 100) : 0;

  const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "10px 16px" };
  const riskColor = (s: number) => (s >= 50 ? "var(--red)" : s >= 30 ? "#b45309" : "var(--muted)");

  const statChip = (label: string, value: string, color: string) => (
    <div style={{ ...card, padding: "14px 16px", flex: 1 }}>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1080 }}>
      <RealtimeRefresh tables={["nps_responses", "referrals", "subscriptions", "sessions", "invoices"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Retention</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>Churn risk, satisfaction (NPS) and referrals — one place to keep members engaged.</p>

      {/* ---- KPI row ---- */}
      <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
        {statChip("At-risk members", String(atRisk.length), atRisk.length ? "var(--red)" : "var(--teal-dark)")}
        {statChip("NPS", total ? String(npsScore) : "—", npsScore >= 0 ? "var(--teal-dark)" : "var(--red)")}
        {statChip("Promoters", `${promoters}/${total}`, "var(--teal-dark)")}
        {statChip("Active referrals", String(referrals.filter((r) => r.status !== "rewarded").length), "var(--teal-dark)")}
      </div>

      {/* ---- At-risk ---- */}
      <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>At-risk members</h2>
      <div style={{ ...card, overflow: "hidden", marginBottom: 26 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr><th style={th}>Member</th><th style={th}>Risk</th><th style={th}>Why</th></tr></thead>
          <tbody>
            {atRisk.slice(0, 25).map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={td}><Link href={`/clients/${r.id}`} style={{ color: "var(--teal-dark)", textDecoration: "none", fontWeight: 600 }}>{r.name}</Link></td>
                <td style={{ ...td, fontWeight: 700, color: riskColor(r.score) }}>{r.score}</td>
                <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{r.reasons.join(" · ")}</td>
              </tr>
            ))}
            {atRisk.length === 0 && <tr><td colSpan={3} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No at-risk members detected. 🎉</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ---- NPS ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 8px" }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Feedback / NPS</h2>
        <span style={{ flex: 1 }} />
        <NpsForm clients={clients} />
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 8 }}>
        {total} responses · {promoters} promoters · {passives} passive · {detractors} detractors
      </div>
      <div style={{ ...card, overflow: "hidden", marginBottom: 26 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr><th style={th}>Member</th><th style={th}>Score</th><th style={th}>Comment</th><th style={th}>Channel</th><th style={th}>When</th></tr></thead>
          <tbody>
            {nps.slice(0, 20).map((r) => {
              const chip = r.score >= 9 ? ["var(--green-bg)", "#166534"] : r.score >= 7 ? ["#eef2f1", "var(--muted)"] : ["#fee2e2", "var(--red)"];
              return (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}>{r.clients?.name ?? "—"}</td>
                  <td style={td}><span style={{ background: chip[0], color: chip[1], borderRadius: 999, padding: "2px 10px", fontWeight: 700, fontSize: 13 }}>{r.score}</span></td>
                  <td style={{ ...td, color: "var(--muted)" }}>{r.comment ?? "—"}</td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{r.channel}</td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{r.created_at.slice(0, 10)}</td>
                </tr>
              );
            })}
            {total === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No feedback recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ---- Referrals ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 8px" }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Referrals & loyalty</h2>
        <span style={{ flex: 1 }} />
        <ReferralForm clients={clients} />
      </div>
      <div style={{ ...card, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr><th style={th}>Prospect</th><th style={th}>Referred by</th><th style={th}>Contact</th><th style={th}>Status</th><th style={th}>Reward</th><th style={th} /></tr></thead>
          <tbody>
            {referrals.map((r) => {
              const chip = r.status === "rewarded" ? ["var(--green-bg)", "#166534"] : r.status === "joined" ? ["var(--amber-bg)", "#92400e"] : ["#eef2f1", "var(--muted)"];
              return (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...td, fontWeight: 600 }}>{r.referred_name}</td>
                  <td style={{ ...td, color: "var(--muted)" }}>{r.clients?.name ?? "—"}</td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{r.referred_phone ?? r.referred_email ?? "—"}</td>
                  <td style={td}><span style={{ background: chip[0], color: chip[1], borderRadius: 999, padding: "2px 10px", fontWeight: 600, fontSize: 12 }}>{r.status}</span></td>
                  <td style={td}>{r.reward_amount ? money(r.reward_amount) : "—"}</td>
                  <td style={td}><ReferralActions id={r.id} status={r.status} /></td>
                </tr>
              );
            })}
            {referrals.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No referrals yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
