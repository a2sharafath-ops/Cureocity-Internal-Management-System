"use client";

import { useState } from "react";
import Link from "next/link";
import NpsForm from "@/components/NpsForm";
import ReferralForm from "@/components/ReferralForm";
import ReferralActions from "@/components/ReferralActions";
import SegTabs from "@/components/SegTabs";
import StatCard from "@/components/StatCard";
import Chip from "@/components/Chip";
import { winbackOffer, sendNpsSurvey, awardLoyalty, redeemLoyalty } from "@/lib/actions";

export type RiskRow = { id: string; name: string; packageName: string | null; score: number; tier: string; reasons: string[] };
export type NpsRow = { id: string; clientId: string; clientName: string | null; score: number; comment: string | null; channel: string; date: string };
export type RefRow = { id: string; referredName: string; referrerName: string | null; contact: string | null; status: string; reward: number };
export type LoyRow = { clientId: string; name: string; points: number; tier: string };

function money(n: number) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

export default function RetentionHub({
  risk, kpis, npsList, npsStats, referrals, loyalty, clients, canAct,
}: {
  risk: RiskRow[];
  kpis: { high: number; medium: number; healthy: number; total: number; revenueAtRisk: number };
  npsList: NpsRow[];
  npsStats: { total: number; promoters: number; passives: number; detractors: number; nps: number };
  referrals: RefRow[];
  loyalty: LoyRow[];
  clients: { id: string; name: string }[];
  canAct: boolean;
}) {
  const [tab, setTab] = useState<"risk" | "nps" | "referrals">("risk");
  const [award, setAward] = useState(false);

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "10px 14px", textAlign: "left", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".3px" };
  const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };
  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff" };
  const kpi = (label: string, value: string, sub: string, bg: string, color: string) => (
    <StatCard label={label} value={value} sub={sub} badge={{ bg, color }} />
  );
  const chip = (bg: string, c: string, t: string, extra?: React.CSSProperties) => <Chip bg={bg} color={c} style={extra}>{t}</Chip>;
  const tierChip = (t: string) => chip(t === "High" ? "var(--red-bg)" : t === "Medium" ? "var(--amber-bg)" : "var(--green-bg)", t === "High" ? "#991b1b" : t === "Medium" ? "#92400e" : "#166534", t);
  const riskBar = (s: number) => { const col = s >= 60 ? "var(--red)" : s >= 30 ? "#d97706" : "#16a34a"; return <div style={{ background: "#eef2f1", borderRadius: 6, height: 8, width: 90, overflow: "hidden" }}><div style={{ width: `${Math.min(100, s)}%`, height: "100%", background: col }} /></div>; };
  const loyTierChip = (t: string) => chip(t === "Platinum" ? "#ede9fe" : t === "Gold" ? "var(--amber-bg)" : "#eef2f1", t === "Platinum" ? "#6d28d9" : t === "Gold" ? "#92400e" : "#64748b", t);
  const pct = (n: number) => npsStats.total ? Math.round(n / npsStats.total * 100) : 0;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <SegTabs active={tab} onSelect={(k) => setTab(k as typeof tab)} items={[
          { key: "risk", label: "⚠️ At-Risk", count: kpis.high || undefined },
          { key: "nps", label: "📊 NPS & Feedback" },
          { key: "referrals", label: "🎁 Referrals & Loyalty" },
        ]} />
      </div>

      {/* ============ AT-RISK ============ */}
      {tab === "risk" && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            {kpi("High risk", String(kpis.high), "need attention now", "var(--red-bg)", "#991b1b")}
            {kpi("Medium risk", String(kpis.medium), "watch list", "var(--amber-bg)", "#92400e")}
            {kpi("Healthy", `${kpis.healthy}/${kpis.total}`, `${kpis.total ? Math.round(kpis.healthy / kpis.total * 100) : 0}% retained`, "var(--green-bg)", "#166534")}
            {kpi("Revenue at risk", money(kpis.revenueAtRisk), "at-risk package value", "#dbeafe", "#1e40af")}
          </div>
          <div style={{ ...box, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead><tr><th style={th}>Client</th><th style={th}>Risk</th><th style={th}>Tier</th><th style={th}>Signals</th><th style={th} /></tr></thead>
              <tbody>
                {risk.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={td}><Link href={`/clients/${r.id}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 700 }}>{r.name}</Link><div style={{ fontSize: 11, color: "var(--muted)" }}>{r.packageName ?? "—"}</div></td>
                    <td style={td}><div style={{ display: "flex", alignItems: "center", gap: 8 }}>{riskBar(r.score)}<span style={{ fontSize: 11, color: "var(--muted)" }}>{r.score}/100</span></div></td>
                    <td style={td}>{tierChip(r.tier)}</td>
                    <td style={td}>{r.reasons.length ? r.reasons.map((x, i) => <span key={i} style={{ display: "inline-block", margin: "1px 2px 0 0" }}>{chip("#eef2f1", "var(--muted)", x, { fontSize: 10 })}</span>) : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {canAct && <div style={{ display: "flex", gap: 6 }}>
                        <Link href="/messages" style={{ background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>Reach out</Link>
                        <form action={winbackOffer}><input type="hidden" name="client_id" value={r.id} /><button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, cursor: "pointer", color: "var(--brand-text)" }}>Win-back offer</button></form>
                      </div>}
                    </td>
                  </tr>
                ))}
                {risk.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 14px" }}>No at-risk members detected. 🎉</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ============ NPS ============ */}
      {tab === "nps" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {canAct && <form action={sendNpsSurvey} style={{ display: "flex", gap: 6 }}>
              <select name="audience" defaultValue="all" style={inp}><option value="all">All active clients</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <select name="channel" defaultValue="WhatsApp" style={inp}><option>WhatsApp</option><option>Email</option><option>SMS</option></select>
              <button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Send NPS survey</button>
            </form>}
            {canAct && <NpsForm clients={clients} />}
          </div>

          <div style={{ ...box, padding: "16px 18px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}><b>Net Promoter Score</b><span style={{ flex: 1 }} /><span style={{ color: "var(--muted)", fontSize: 12 }}>{npsStats.total} responses</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
              <div style={{ fontSize: 46, fontWeight: 800, color: npsStats.nps >= 50 ? "#16a34a" : npsStats.nps >= 0 ? "#d97706" : "var(--red)" }}>{npsStats.total ? npsStats.nps : "—"}</div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", background: "#eef2f1" }}>
                  <div style={{ width: `${pct(npsStats.promoters)}%`, background: "#16a34a" }} />
                  <div style={{ width: `${pct(npsStats.passives)}%`, background: "#d97706" }} />
                  <div style={{ width: `${pct(npsStats.detractors)}%`, background: "var(--red)" }} />
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 12, flexWrap: "wrap" }}>
                  <span><b style={{ color: "#16a34a" }}>{npsStats.promoters}</b> Promoters ({pct(npsStats.promoters)}%)</span>
                  <span><b style={{ color: "#92400e" }}>{npsStats.passives}</b> Passives ({pct(npsStats.passives)}%)</span>
                  <span><b style={{ color: "var(--red)" }}>{npsStats.detractors}</b> Detractors ({pct(npsStats.detractors)}%)</span>
                </div>
              </div>
            </div>
          </div>

          {npsList.filter((f) => f.score <= 6).length > 0 && (
            <div style={{ ...box, padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><b>🚨 Detractors to follow up</b>{chip("var(--red-bg)", "#991b1b", String(npsList.filter((f) => f.score <= 6).length))}</div>
              {npsList.filter((f) => f.score <= 6).map((f) => (
                <div key={f.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                  <b>{f.clientName ?? "—"}</b><span style={{ color: "var(--muted)" }}>{f.comment ?? "—"}</span><span style={{ flex: 1 }} />
                  {canAct && <Link href="/messages" style={{ background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>Reach out</Link>}
                </div>
              ))}
            </div>
          )}

          <div style={{ ...box, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead><tr><th style={th}>Member</th><th style={th}>Score</th><th style={th}>Comment</th><th style={th}>Channel</th><th style={th}>When</th></tr></thead>
              <tbody>
                {npsList.map((f) => { const s = f.score >= 9 ? ["var(--green-bg)", "#166534"] : f.score <= 6 ? ["var(--red-bg)", "#991b1b"] : ["var(--amber-bg)", "#92400e"];
                  return <tr key={f.id} style={{ borderTop: "1px solid var(--border)" }}><td style={{ ...td, fontWeight: 600 }}>{f.clientName ?? "—"}</td><td style={td}>{chip(s[0], s[1], `${f.score}/10`)}</td><td style={{ ...td, color: "var(--muted)" }}>{f.comment ?? "—"}</td><td style={{ ...td, color: "var(--muted)" }}>{f.channel}</td><td style={{ ...td, color: "var(--muted)" }}>{f.date}</td></tr>;
                })}
                {npsList.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 14px" }}>No feedback yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ============ REFERRALS & LOYALTY ============ */}
      {tab === "referrals" && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            {kpi("Successful referrals", String(referrals.filter((r) => r.status === "rewarded" || r.status === "joined").length), `of ${referrals.length} logged`, "var(--green-bg)", "#166534")}
            {kpi("Loyalty points live", loyalty.reduce((s, l) => s + l.points, 0).toLocaleString("en-IN"), `across ${loyalty.length} clients`, "#dbeafe", "#1e40af")}
            {kpi("Tiers", `${loyalty.filter((l) => l.tier === "Platinum").length} Plat · ${loyalty.filter((l) => l.tier === "Gold").length} Gold · ${loyalty.filter((l) => l.tier === "Silver").length} Silver`, "member mix", "#ede9fe", "#6d28d9")}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 8px" }}><b>Referrals</b><span style={{ flex: 1 }} />{canAct && <ReferralForm clients={clients} />}</div>
          <div style={{ ...box, overflow: "auto", marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
              <thead><tr><th style={th}>Referee</th><th style={th}>Referrer</th><th style={th}>Contact</th><th style={th}>Status</th><th style={th}>Reward</th><th style={th} /></tr></thead>
              <tbody>
                {referrals.map((r) => { const s = r.status === "rewarded" ? ["var(--green-bg)", "#166534"] : r.status === "joined" ? ["#dbeafe", "#1e40af"] : ["var(--amber-bg)", "#92400e"];
                  return <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}><td style={{ ...td, fontWeight: 600 }}>{r.referredName}</td><td style={{ ...td, color: "var(--muted)" }}>{r.referrerName ?? "—"}</td><td style={{ ...td, color: "var(--muted)" }}>{r.contact ?? "—"}</td><td style={td}>{chip(s[0], s[1], r.status)}</td><td style={td}>{r.reward ? money(r.reward) : "—"}</td><td style={{ ...td, textAlign: "right" }}><ReferralActions id={r.id} status={r.status} /></td></tr>;
                })}
                {referrals.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "20px 14px" }}>No referrals yet.</td></tr>}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 8px" }}>
            <b>Loyalty members</b><span style={{ color: "var(--muted)", fontSize: 12 }}>100 pts = ₹100 credit</span><span style={{ flex: 1 }} />
            {canAct && <button type="button" onClick={() => setAward((v) => !v)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>{award ? "Cancel" : "★ Award points"}</button>}
          </div>
          {award && (
            <form action={awardLoyalty} onSubmit={() => setTimeout(() => setAward(false), 50)} style={{ ...box, padding: 12, marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
              <select name="client_id" required defaultValue="" style={inp}><option value="" disabled>Client…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <input name="points" type="number" defaultValue={100} style={{ ...inp, width: 110 }} />
              <button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Award</button>
            </form>
          )}
          <div style={{ ...box, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
              <thead><tr><th style={th}>Client</th><th style={th}>Points</th><th style={th}>Tier</th><th style={th} /></tr></thead>
              <tbody>
                {loyalty.map((l) => (
                  <tr key={l.clientId} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...td, fontWeight: 600 }}>{l.name}</td>
                    <td style={td}><b>{l.points.toLocaleString("en-IN")}</b> pts</td>
                    <td style={td}>{loyTierChip(l.tier)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{canAct && l.points >= 100 && <form action={redeemLoyalty}><input type="hidden" name="client_id" value={l.clientId} /><button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, cursor: "pointer" }}>Redeem</button></form>}</td>
                  </tr>
                ))}
                {loyalty.length === 0 && <tr><td colSpan={4} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "20px 14px" }}>No loyalty members yet — award points to get started.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
