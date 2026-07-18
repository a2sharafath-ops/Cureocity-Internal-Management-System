import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { AttendanceButtons, LeaveForm, LeaveActions } from "@/components/HrControls";
import { OnboardingForm, OnboardingCard } from "@/components/OnboardingControls";
import {
  addHrUpdate, toggleMonthTask, generatePayslip, addCommission, fileStatutory,
  advanceCandidate, setPurchaseStatus, addOffboarding,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
type Staff = { id: string; name: string; designation: string | null; department: string | null; role: string; leave_balance: number | null };

export default async function HrPage({ searchParams }: { searchParams: { tab?: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/hr")) redirect("/dashboard");
  const tab = ["attendance", "leave", "payroll", "recruit", "boarding"].includes(searchParams.tab ?? "") ? searchParams.tab! : "attendance";

  const today = todayISO();
  const month = today.slice(0, 7);
  const supabase = createClient();
  const [
    { data: staffData }, { data: attData }, { data: leaveData }, { data: payData }, { data: obData },
    { data: updData }, { data: mtData }, { data: comData }, { data: statData }, { data: candData }, { data: docData }, { data: purData },
  ] = await Promise.all([
    supabase.from("staff").select("id, name, designation, department, role, leave_balance").order("name"),
    supabase.from("attendance").select("staff_id, status").eq("date", today),
    supabase.from("leaves").select("id, staff_id, from_date, to_date, type, reason, status, staff(name, department)").order("created_at", { ascending: false }).limit(60),
    supabase.from("payroll").select("staff_id, base, lop_days, pf, net, status, payslip").eq("month", month),
    supabase.from("onboarding").select("id, name, role, joining_date, steps, status, kind").order("created_at", { ascending: false }),
    supabase.from("hr_updates").select("id, author, body, created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("hr_month_tasks").select("id, seq, label, status, detail").eq("month", month).order("seq"),
    supabase.from("hr_commissions").select("id, name, kind, amount, tds").order("created_at", { ascending: false }),
    supabase.from("hr_statutory").select("id, name, period, status, due_note").order("name"),
    supabase.from("hr_candidates").select("id, name, role, source, stage").order("created_at", { ascending: false }),
    supabase.from("hr_documents").select("id, title, kind, person, doc_date, status").order("doc_date", { ascending: false }),
    supabase.from("hr_purchases").select("id, item, requested_by, req_date, status").order("req_date", { ascending: false }),
  ]);

  const staff = (staffData ?? []) as Staff[];
  const att = new Map(((attData ?? []) as { staff_id: string; status: string }[]).map((a) => [a.staff_id, a.status]));
  const leaves = (leaveData ?? []) as unknown as { id: string; from_date: string; to_date: string; type: string; reason: string | null; status: string; staff: { name: string; department: string | null } | null }[];
  const pay = new Map(((payData ?? []) as { staff_id: string; base: number; lop_days: number; pf: number; net: number; status: string; payslip: boolean }[]).map((r) => [r.staff_id, r]));
  const allOb = (obData ?? []) as unknown as { id: string; name: string; role: string | null; joining_date: string | null; steps: { label: string; done: boolean }[]; status: string; kind: string }[];
  const onboarding = allOb.filter((o) => o.kind !== "offboarding");
  const offboarding = allOb.filter((o) => o.kind === "offboarding");
  const updates = (updData ?? []) as { id: string; author: string | null; body: string; created_at: string }[];
  const monthTasks = (mtData ?? []) as { id: string; seq: number; label: string; status: string; detail: string | null }[];
  const commissions = (comData ?? []) as { id: string; name: string; kind: string; amount: number; tds: number }[];
  const statutory = (statData ?? []) as { id: string; name: string; period: string | null; status: string; due_note: string | null }[];
  const candidates = (candData ?? []) as { id: string; name: string; role: string | null; source: string | null; stage: string }[];
  const documents = (docData ?? []) as { id: string; title: string; kind: string | null; person: string | null; doc_date: string | null; status: string }[];
  const purchases = (purData ?? []) as { id: string; item: string; requested_by: string | null; req_date: string | null; status: string }[];

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".3px" };
  const td: React.CSSProperties = { padding: "11px 16px", fontSize: 13 };
  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff" };
  const chip = (bg: string, c: string, t: string) => <span style={{ background: bg, color: c, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{t}</span>;
  const deptChip = (d: string | null) => {
    const m: Record<string, [string, string]> = { Management: ["#ede9fe", "#6d28d9"], Fitness: ["#dbeafe", "#1e40af"], Sales: ["#dbeafe", "#1e40af"], Marketing: ["#dbeafe", "#1e40af"], "Front Desk": ["#dbeafe", "#1e40af"], "Health Professional": ["#dcfce7", "#166534"] };
    const [bg, c] = m[d ?? ""] ?? ["#eef2f1", "#64748b"];
    return chip(bg, c, d ?? "—");
  };
  const tabLink = (key: string, label: string) => (
    <Link href={`/hr?tab=${key}`} style={{ padding: "8px 15px", borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: "none", border: "1px solid var(--border)", background: tab === key ? "var(--teal)" : "#fff", color: tab === key ? "#fff" : "var(--muted)" }}>{label}</Link>
  );
  const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

  return (
    <div style={{ maxWidth: 1220 }}>
      <RealtimeRefresh tables={["attendance", "leaves", "payroll", "hr_updates", "hr_candidates", "hr_purchases", "onboarding"]} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: "0 0 2px" }}>HR</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>Attendance, leave, payroll, recruitment, onboarding — all HR operations</p>
        </div>
        <span style={{ flex: 1 }} />
        <LeaveForm staff={staff.map((s) => ({ id: s.id, name: s.name, role: s.role, department: s.department }))} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {tabLink("attendance", "👥 Team & Attendance")}{tabLink("leave", "🌴 Leave")}{tabLink("payroll", "💰 Payroll & Statutory")}{tabLink("recruit", "📋 Recruitment & Docs")}{tabLink("boarding", "🔄 On / Offboarding")}
      </div>

      {/* ================= TEAM & ATTENDANCE ================= */}
      {tab === "attendance" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ ...box, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "14px 16px" }}><b>Attendance — today</b><span style={{ flex: 1 }} />{chip("#eef2f1", "var(--muted)", "Odoo portal + monthly sheet")}</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Staff</th><th style={th}>Type</th><th style={th}>Today</th></tr></thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...td, fontWeight: 600 }}>{s.name}<div style={{ color: "var(--muted)", fontSize: 11 }}>{s.designation ?? ""}</div></td>
                    <td style={td}>{deptChip(s.department)}</td>
                    <td style={{ ...td, textAlign: "right" }}><AttendanceButtons staffId={s.id} date={today} current={att.get(s.id) ?? null} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ ...box, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}><b>💬 Daily Updates</b><span style={{ flex: 1 }} />{chip("#eef2f1", "var(--muted)", "internal coordination")}</div>
            <form action={addHrUpdate} style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <input name="body" placeholder="Post an update…" required style={{ ...inp, flex: 1 }} />
              <button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Post</button>
            </form>
            {updates.map((u) => (
              <div key={u.id} style={{ padding: "9px 0", borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: 8 }}><b style={{ fontSize: 13 }}>{u.author ?? "—"}</b><span style={{ flex: 1 }} /><span style={{ color: "var(--muted)", fontSize: 11 }}>{timeOf(u.created_at)}</span></div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>{u.body}</div>
              </div>
            ))}
            {updates.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No updates yet.</div>}
          </div>
        </div>
      )}

      {/* ================= LEAVE ================= */}
      {tab === "leave" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ ...box, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}><b>Leave Requests</b><span style={{ flex: 1 }} />{chip("var(--amber-bg)", "#92400e", `${leaves.filter((l) => l.status === "pending").length} pending`)}</div>
            {leaves.map((l) => (
              <div key={l.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 0", borderTop: "1px solid var(--border)", fontSize: 13, flexWrap: "wrap" }}>
                <div style={{ minWidth: 180 }}><b>{l.staff?.name ?? "—"}</b><div style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(l.from_date)}{l.to_date !== l.from_date ? ` – ${fmtDate(l.to_date)}` : ""} · {l.reason ?? l.type}</div></div>
                <span style={{ flex: 1 }} />
                {l.status === "pending"
                  ? <LeaveActions id={l.id} />
                  : chip(l.status === "approved" ? "var(--green-bg)" : "#fee2e2", l.status === "approved" ? "#166534" : "var(--red)", l.status === "approved" ? "Approved" : "Rejected")}
              </div>
            ))}
            {leaves.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No leave requests.</div>}
          </div>
          <div style={{ ...box, padding: "16px 18px" }}>
            <b>Leave Balances</b>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
              <thead><tr><th style={th}>Staff</th><th style={th}>Balance</th><th style={th}>Status</th></tr></thead>
              <tbody>
                {staff.map((s) => { const bal = s.leave_balance ?? 12; return (
                  <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...td, fontWeight: 600 }}>{s.name}</td>
                    <td style={td}>{bal} days</td>
                    <td style={td}>{chip(bal <= 3 ? "var(--amber-bg)" : "var(--green-bg)", bal <= 3 ? "#92400e" : "#166534", bal <= 3 ? "Low" : "OK")}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= PAYROLL & STATUTORY ================= */}
      {tab === "payroll" && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ ...box, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}><b>📝 Month-End Verification</b><span style={{ flex: 1 }} />{chip("#eef2f1", "var(--muted)", "window: 26th onwards")}</div>
            {monthTasks.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border)", fontSize: 13.5 }}>
                <b>{t.label}</b><span style={{ flex: 1 }} />
                {t.status === "done"
                  ? <>{chip("var(--green-bg)", "#166534", t.detail ?? "Done")}<form action={toggleMonthTask}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value={t.status} /><button style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 11, cursor: "pointer" }}>undo</button></form></>
                  : <form action={toggleMonthTask}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value={t.status} /><button style={{ background: "var(--amber-bg)", color: "#92400e", border: "none", borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Pending — mark done</button></form>}
              </div>
            ))}
            {monthTasks.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No verification tasks for this month.</div>}
          </div>

          <div style={{ ...box, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "14px 16px" }}><b>💰 Payroll Processing — {new Date(today + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</b><span style={{ flex: 1 }} />{chip("#eef2f1", "var(--muted)", "salary sheet")}</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Staff</th><th style={th}>Base</th><th style={th}>LOP</th><th style={th}>PF</th><th style={th}>Net pay</th><th style={th}>Payslip</th></tr></thead>
              <tbody>
                {staff.map((s) => { const r = pay.get(s.id); const base = r?.base ?? 0; const lop = r?.lop_days ?? 0; const pf = r?.pf ?? 1800; const net = r?.net ?? Math.max(0, base - lop * (base / 30) - pf);
                  return (
                    <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ ...td, fontWeight: 600 }}>{s.name}<div style={{ color: "var(--muted)", fontSize: 11 }}>{s.designation ?? ""}</div></td>
                      <td style={td}>{base ? money(base) : "—"}</td>
                      <td style={td}>{lop > 0 ? chip("var(--amber-bg)", "#92400e", `${lop} day · −${money(lop * (base / 30))}`) : chip("#eef2f1", "var(--muted)", "0")}</td>
                      <td style={td}>{money(pf)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{base ? money(net) : "—"}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <form action={generatePayslip}>
                          <input type="hidden" name="staff_id" value={s.id} /><input type="hidden" name="month" value={month} />
                          <input type="hidden" name="base" value={base || 85000} /><input type="hidden" name="lop_days" value={lop} /><input type="hidden" name="pf" value={pf} />
                          <button style={{ border: "1px solid var(--border)", background: r?.payslip ? "var(--green-bg)" : "#fff", color: r?.payslip ? "#166534" : "var(--teal-dark)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{r?.payslip ? "✓ Payslip" : "Generate payslip"}</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
            <div style={{ ...box, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}><b>🤝 Commission Tracking</b><span style={{ flex: 1 }} />{chip("#eef2f1", "var(--muted)", "training · sales · TDS")}</div>
              {commissions.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                  <div><b>{c.name}</b><div style={{ color: "var(--muted)", fontSize: 12 }}>{c.kind} · TDS {money(c.tds)}</div></div>
                  <span style={{ flex: 1 }} /><b>{money(c.amount)}</b>
                </div>
              ))}
              <form action={addCommission} style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <input name="name" placeholder="Staff" required style={{ ...inp, flex: 1, minWidth: 90 }} />
                <input name="amount" type="number" placeholder="Amount" style={{ ...inp, width: 90 }} />
                <input name="tds" type="number" placeholder="TDS" style={{ ...inp, width: 70 }} />
                <button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add</button>
              </form>
            </div>
            <div style={{ ...box, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}><b>🏛 Statutory Records</b><span style={{ flex: 1 }} />{chip("#eef2f1", "var(--muted)", "ESI & PF · due 3rd–4th")}</div>
              {statutory.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                  <div><b>{s.name}</b><div style={{ color: "var(--muted)", fontSize: 12 }}>{s.due_note ?? ""}</div></div>
                  <span style={{ flex: 1 }} />
                  {chip(s.status === "filed" ? "var(--green-bg)" : s.status === "prepared" ? "#dbeafe" : "var(--amber-bg)", s.status === "filed" ? "#166534" : s.status === "prepared" ? "#1e40af" : "#92400e", s.status === "in_progress" ? "In progress" : s.status[0].toUpperCase() + s.status.slice(1))}
                  {s.status !== "filed" && <form action={fileStatutory}><input type="hidden" name="id" value={s.id} /><button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Mark filed</button></form>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= RECRUITMENT & DOCS ================= */}
      {tab === "recruit" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ ...box, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}><b>🔍 Recruitment</b><span style={{ flex: 1 }} />{chip("#eef2f1", "var(--muted)", "Indeed · Referrals · LinkedIn")}</div>
            {candidates.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                <div><b>{c.name}</b><div style={{ color: "var(--muted)", fontSize: 12 }}>{c.role ?? ""}{c.source ? ` · via ${c.source}` : ""}</div></div>
                <span style={{ flex: 1 }} />
                {chip(c.stage === "Hired" ? "var(--green-bg)" : c.stage === "Offer sent" ? "#dbeafe" : "var(--amber-bg)", c.stage === "Hired" ? "#166534" : c.stage === "Offer sent" ? "#1e40af" : "#92400e", c.stage)}
                {c.stage !== "Hired" && <form action={advanceCandidate}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="stage" value={c.stage} /><button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--teal-dark)" }}>Advance →</button></form>}
              </div>
            ))}
            {candidates.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No open roles.</div>}
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ ...box, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}><b>📄 HR Documents</b><span style={{ flex: 1 }} />{chip("#eef2f1", "var(--muted)", "offer · experience · contracts")}</div>
              {documents.map((d) => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                  <div style={{ fontSize: 18 }}>📄</div>
                  <div style={{ flex: 1 }}><b>{d.title}</b><div style={{ color: "var(--muted)", fontSize: 12 }}>{d.kind ?? ""}{d.doc_date ? ` · ${fmtDate(d.doc_date)}` : " · —"}</div></div>
                  <span style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Open</span>
                </div>
              ))}
            </div>
            <div style={{ ...box, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}><b>🛒 Purchase List</b><span style={{ flex: 1 }} />{chip("#eef2f1", "var(--muted)", "office & HR purchases")}</div>
              {purchases.map((pu) => (
                <div key={pu.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                  <div style={{ flex: 1 }}><b>{pu.item}</b><div style={{ color: "var(--muted)", fontSize: 12 }}>{pu.requested_by ?? ""}{pu.req_date ? ` · ${fmtDate(pu.req_date)}` : ""}</div></div>
                  {chip(pu.status === "delivered" ? "var(--green-bg)" : pu.status === "ordered" ? "#dbeafe" : "var(--amber-bg)", pu.status === "delivered" ? "#166534" : pu.status === "ordered" ? "#1e40af" : "#92400e", pu.status[0].toUpperCase() + pu.status.slice(1))}
                  {pu.status === "requested" && <form action={setPurchaseStatus}><input type="hidden" name="id" value={pu.id} /><input type="hidden" name="status" value="ordered" /><button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>Order</button></form>}
                  {pu.status === "ordered" && <form action={setPurchaseStatus}><input type="hidden" name="id" value={pu.id} /><input type="hidden" name="status" value="delivered" /><button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>Mark delivered</button></form>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= ON / OFFBOARDING ================= */}
      {tab === "boarding" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><b style={{ color: "#16a34a" }}>🟢 Employee Onboarding</b><span style={{ flex: 1 }} /><OnboardingForm /></div>
            <div style={{ display: "grid", gap: 14 }}>
              {onboarding.map((o) => <OnboardingCard key={o.id} id={o.id} name={o.name} role={o.role} joining={o.joining_date} steps={o.steps ?? []} status={o.status} />)}
              {onboarding.length === 0 && <div style={{ ...box, padding: "20px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No one onboarding.</div>}
            </div>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><b style={{ color: "#dc2626" }}>🔴 Employee Offboarding</b><span style={{ flex: 1 }} /></div>
            <form action={addOffboarding} style={{ ...box, padding: 12, marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input name="name" placeholder="Name" required style={{ ...inp, flex: 1, minWidth: 90 }} />
              <input name="role" placeholder="Role" style={{ ...inp, width: 110 }} />
              <input name="joining_date" type="date" title="Last working day" style={inp} />
              <button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Offboard</button>
            </form>
            <div style={{ display: "grid", gap: 14 }}>
              {offboarding.map((o) => <OnboardingCard key={o.id} id={o.id} name={o.name} role={o.role} joining={o.joining_date} steps={o.steps ?? []} status={o.status} />)}
              {offboarding.length === 0 && <div style={{ ...box, padding: "20px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No active offboarding.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
