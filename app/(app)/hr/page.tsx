import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, canApproveLeaveType } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { AttendanceButtons, LeaveForm, LeaveActions } from "@/components/HrControls";
import { OnboardingForm, OnboardingCard } from "@/components/OnboardingControls";
import SegTabs from "@/components/SegTabs";
import Chip from "@/components/Chip";
import {
  addHrUpdate, toggleMonthTask, generatePayslip, addCommission, fileStatutory,
  advanceCandidate, setPurchaseStatus, addOffboarding,
  saveLeaveType, decideLeaveType, addHoliday, deleteHoliday, saveSalaryStructure, deleteEmployeeDoc, updateStaffEmployment,
} from "@/lib/actions";
import EmployeeDocUpload from "@/components/EmployeeDocUpload";

export const dynamic = "force-dynamic";

const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
type Staff = { id: string; name: string; designation: string | null; department: string | null; role: string; leave_balance: number | null; date_of_joining: string | null; gender: string | null; created_at: string | null };

export default async function HrPage({ searchParams }: { searchParams: { tab?: string; month?: string; emp?: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/hr")) redirect("/dashboard");
  const tab = ["attendance", "leave", "holidays", "payroll", "employees", "recruit", "boarding"].includes(searchParams.tab ?? "") ? searchParams.tab! : "attendance";

  const today = todayISO();
  // The monthly attendance sheet works on a chosen month (defaults to current).
  const sheetMonth = /^\d{4}-\d{2}$/.test(searchParams.month ?? "") ? searchParams.month! : today.slice(0, 7);
  const monthStart = `${sheetMonth}-01`;
  const monthEnd = `${sheetMonth}-31`;
  const year = today.slice(0, 4);
  const month = today.slice(0, 7);
  const supabase = createClient();
  const [
    { data: staffData }, { data: attData }, { data: leaveData }, { data: payData }, { data: obData },
    { data: updData }, { data: mtData }, { data: comData }, { data: statData }, { data: candData }, { data: docData }, { data: purData },
    { data: ltData }, { data: holData }, { data: monthAttData }, { data: yearLeaveData }, { data: empDocData }, { data: salData },
  ] = await Promise.all([
    supabase.from("staff").select("id, name, designation, department, role, leave_balance, date_of_joining, gender, created_at").order("name"),
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
    supabase.from("leave_types").select("code, name, annual_days, paid, active, seq, color, note, gender, min_tenure_months, accrual, pending_days, pending_by").order("seq"),
    supabase.from("holidays").select("id, date, name, kind").gte("date", `${year}-01-01`).lte("date", `${year}-12-31`).order("date"),
    supabase.from("attendance").select("staff_id, date, status").gte("date", monthStart).lte("date", monthEnd),
    supabase.from("leaves").select("staff_id, type, from_date, to_date, status").eq("status", "approved").gte("from_date", `${year}-01-01`).lte("from_date", `${year}-12-31`),
    supabase.from("employee_documents").select("id, staff_id, title, kind, name, created_at").order("created_at", { ascending: false }),
    supabase.from("salary_structures").select("staff_id, basic, hra, allowances, pf, esi, pt, tds, effective_from"),
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

  // ---- HR expansion derived data --------------------------------------------
  const leaveTypes = (ltData ?? []) as { code: string; name: string; annual_days: number; paid: boolean; active: boolean; seq: number; color: string | null; note: string | null; gender: string; min_tenure_months: number; accrual: string; pending_days: number | null; pending_by: string | null }[];
  const activeTypes = leaveTypes.filter((t) => t.active);
  const canApproveLeave = canApproveLeaveType(me.role);

  // Entitlement for one staff member under a type's eligibility rules.
  // Returns null when the type doesn't apply (e.g. ML for a male staff member),
  // else the (possibly pro-rated / tenure-gated) number of days.
  const monthsBetween = (fromISO: string, toISO: string) => {
    const a = new Date(fromISO), b = new Date(toISO);
    return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) - (b.getUTCDate() < a.getUTCDate() ? 1 : 0);
  };
  const entitledFor = (s: Staff, t: { annual_days: number; gender: string; min_tenure_months: number; accrual: string }): number | null => {
    if (t.gender !== "any" && s.gender && s.gender.toLowerCase() !== t.gender) return null;
    const joined = (s.date_of_joining ?? (s.created_at ? s.created_at.slice(0, 10) : today));
    const tenure = monthsBetween(joined, today);
    if (t.min_tenure_months > 0 && tenure < t.min_tenure_months) return 0;
    if (t.accrual === "monthly") {
      // 1 day per completed month this calendar year, from the later of Jan 1 / join.
      const start = joined > `${year}-01-01` ? joined : `${year}-01-01`;
      const completed = Math.max(0, monthsBetween(start, today));
      return Math.min(t.annual_days, completed);
    }
    return t.annual_days;
  };
  const holidays = (holData ?? []) as { id: string; date: string; name: string; kind: string }[];
  const empDocs = (empDocData ?? []) as { id: string; staff_id: string; title: string; kind: string; name: string | null; created_at: string }[];
  const salaries = new Map(((salData ?? []) as { staff_id: string; basic: number; hra: number; allowances: number; pf: number; esi: number; pt: number; tds: number; effective_from: string | null }[]).map((s) => [s.staff_id, s]));

  // Monthly attendance sheet: staff_id → (day-of-month → status).
  const daysInMonth = new Date(Number(sheetMonth.slice(0, 4)), Number(sheetMonth.slice(5, 7)), 0).getDate();
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthAtt = new Map<string, Map<number, string>>();
  for (const a of (monthAttData ?? []) as { staff_id: string; date: string; status: string }[]) {
    const d = Number(a.date.slice(8, 10));
    (monthAtt.get(a.staff_id) ?? monthAtt.set(a.staff_id, new Map()).get(a.staff_id)!).set(d, a.status);
  }
  const monthLabel = new Date(`${sheetMonth}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const prevMonth = (() => { const d = new Date(`${sheetMonth}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
  const nextMonth = (() => { const d = new Date(`${sheetMonth}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 7); })();

  // Leave taken this year per staff per type (inclusive day count of approved leaves).
  const dayCount = (a: string, b: string) => Math.max(1, Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1);
  const leaveUsed = new Map<string, Map<string, number>>();
  for (const l of (yearLeaveData ?? []) as { staff_id: string; type: string; from_date: string; to_date: string }[]) {
    const m = leaveUsed.get(l.staff_id) ?? leaveUsed.set(l.staff_id, new Map()).get(l.staff_id)!;
    m.set(l.type, (m.get(l.type) ?? 0) + dayCount(l.from_date, l.to_date ?? l.from_date));
  }
  const selectedEmp = staff.find((s) => s.id === searchParams.emp) ?? null;

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".3px" };
  const td: React.CSSProperties = { padding: "11px 16px", fontSize: 13 };
  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff" };
  const chip = (bg: string, c: string, t: string) => <Chip bg={bg} color={c}>{t}</Chip>;
  const deptChip = (d: string | null) => {
    const m: Record<string, [string, string]> = { Management: ["var(--purple-bg)", "var(--purple-text)"], Fitness: ["var(--blue-bg)", "var(--blue-text)"], Sales: ["var(--blue-bg)", "var(--blue-text)"], Marketing: ["var(--blue-bg)", "var(--blue-text)"], "Front Desk": ["var(--blue-bg)", "var(--blue-text)"], Clinical: ["var(--green-bg)", "var(--green-text)"] };
    const [bg, c] = m[d ?? ""] ?? ["var(--neutral-bg)", "#64748b"];
    return chip(bg, c, d ?? "—");
  };
  const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

  return (
    <div style={{ maxWidth: 1220 }}>
      <RealtimeRefresh tables={["attendance", "leaves", "payroll", "hr_updates", "hr_candidates", "hr_purchases", "onboarding", "leave_types", "holidays", "employee_documents", "salary_structures"]} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: "0 0 2px" }}>HR</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>Attendance, leave, payroll, recruitment, onboarding — all HR operations</p>
        </div>
        <span style={{ flex: 1 }} />
        <LeaveForm staff={staff.map((s) => ({ id: s.id, name: s.name, role: s.role, department: s.department }))} types={activeTypes.map((t) => ({ code: t.code, name: t.name }))} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <SegTabs active={tab} items={[
          { key: "attendance", label: "Team & Attendance", href: "/hr?tab=attendance" },
          { key: "leave", label: "Leave", href: "/hr?tab=leave" },
          { key: "holidays", label: "Holidays", href: "/hr?tab=holidays" },
          { key: "payroll", label: "Payroll & Statutory", href: "/hr?tab=payroll" },
          { key: "employees", label: "Employees", href: "/hr?tab=employees" },
          { key: "recruit", label: "Recruitment & Docs", href: "/hr?tab=recruit" },
          { key: "boarding", label: "On / Offboarding", href: "/hr?tab=boarding" },
        ]} />
      </div>

      {/* ================= TEAM & ATTENDANCE ================= */}
      {tab === "attendance" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ ...box, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "14px 16px" }}><b>Attendance — today</b><span style={{ flex: 1 }} />{chip("var(--neutral-bg)", "var(--muted)", "Odoo portal + monthly sheet")}</div>
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
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}><b>Daily Updates</b><span style={{ flex: 1 }} />{chip("var(--neutral-bg)", "var(--muted)", "internal coordination")}</div>
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

          {/* ---- Monthly attendance sheet (spans full width under the two cols) ---- */}
          <div style={{ ...box, overflow: "hidden", gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px" }}>
              <b>Monthly attendance — {monthLabel}</b>
              <span style={{ flex: 1 }} />
              <a href={`/hr?tab=attendance&month=${prevMonth}`} style={{ ...inp, textDecoration: "none", color: "var(--brand-text)" }}>← Prev</a>
              <a href={`/hr?tab=attendance&month=${nextMonth}`} style={{ ...inp, textDecoration: "none", color: "var(--brand-text)" }}>Next →</a>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 11, minWidth: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, position: "sticky", left: 0, background: "var(--card)", minWidth: 150 }}>Staff</th>
                    {monthDays.map((d) => <th key={d} style={{ padding: "6px 4px", textAlign: "center", color: "var(--muted)", fontSize: 10 }}>{d}</th>)}
                    <th style={{ padding: "6px 8px", textAlign: "center", color: "var(--muted)", fontSize: 10 }}>P</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => {
                    const row = monthAtt.get(s.id);
                    const present = row ? Array.from(row.values()).filter((v) => v === "present" || v === "half").length : 0;
                    const cell = (st: string | undefined) => {
                      if (!st) return { t: "·", bg: "transparent", c: "var(--border)" };
                      if (st === "present") return { t: "P", bg: "var(--green-bg)", c: "var(--green-text)" };
                      if (st === "absent") return { t: "A", bg: "var(--red-bg)", c: "var(--red-text)" };
                      if (st === "leave") return { t: "L", bg: "var(--amber-bg)", c: "var(--amber-text)" };
                      if (st === "half") return { t: "½", bg: "var(--blue-bg)", c: "var(--blue-text)" };
                      return { t: "·", bg: "transparent", c: "var(--muted)" };
                    };
                    return (
                      <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 10px", fontWeight: 600, fontSize: 12, position: "sticky", left: 0, background: "var(--card)" }}>{s.name}</td>
                        {monthDays.map((d) => { const c = cell(row?.get(d)); return <td key={d} style={{ textAlign: "center", padding: "3px 0" }}><span style={{ display: "inline-block", minWidth: 16, borderRadius: 4, background: c.bg, color: c.c, fontWeight: 700 }}>{c.t}</span></td>; })}
                        <td style={{ textAlign: "center", fontWeight: 700 }}>{present}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "8px 16px", color: "var(--muted)", fontSize: 11 }}>P present · A absent · L leave · ½ half-day · mark daily status on the Team panel above.</div>
          </div>
        </div>
      )}

      {/* ================= LEAVE ================= */}
      {tab === "leave" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ ...box, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}><b>Leave Requests</b><span style={{ flex: 1 }} />{chip("var(--amber-bg)", "var(--amber-text)", `${leaves.filter((l) => l.status === "pending").length} pending`)}</div>
            {leaves.map((l) => (
              <div key={l.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 0", borderTop: "1px solid var(--border)", fontSize: 13, flexWrap: "wrap" }}>
                <div style={{ minWidth: 180 }}><b>{l.staff?.name ?? "—"}</b><div style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(l.from_date)}{l.to_date !== l.from_date ? ` – ${fmtDate(l.to_date)}` : ""} · {l.reason ?? l.type}</div></div>
                <span style={{ flex: 1 }} />
                {l.status === "pending"
                  ? <LeaveActions id={l.id} />
                  : chip(l.status === "approved" ? "var(--green-bg)" : "var(--red-bg)", l.status === "approved" ? "var(--green-text)" : "var(--red)", l.status === "approved" ? "Approved" : "Rejected")}
              </div>
            ))}
            {leaves.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No leave requests.</div>}
          </div>
          <div style={{ ...box, padding: "16px 18px" }}>
            <b>Leave types</b>
            <div style={{ color: "var(--muted)", fontSize: 12, margin: "4px 0 8px" }}>Yearly entitlement per type. {canApproveLeave ? "Changes apply immediately." : "HR proposes a change; a Manager/Admin approves it."}</div>
            {leaveTypes.map((t) => (
              <div key={t.code} style={{ padding: "6px 0", borderTop: "1px solid var(--border)" }}>
                <form action={saveLeaveType} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="hidden" name="code" value={t.code} />
                  <span style={{ minWidth: 40, fontWeight: 700, color: t.color ?? "var(--ink)" }}>{t.code}</span>
                  <span style={{ flex: 1, fontSize: 12.5 }}>{t.name}{t.note ? <span style={{ display: "block", color: "var(--muted)", fontSize: 11 }}>{t.note}</span> : null}</span>
                  <input name="annual_days" type="number" min={0} defaultValue={t.annual_days} style={{ ...inp, width: 68 }} />
                  <button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>{canApproveLeave ? "Save" : "Request"}</button>
                </form>
                {t.pending_days !== null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 8, padding: "5px 9px", fontSize: 12 }}>
                    <span>Proposed → <b>{t.pending_days} days</b>{t.pending_by ? ` · by ${t.pending_by}` : ""}</span>
                    <span style={{ flex: 1 }} />
                    {canApproveLeave ? (
                      <>
                        <form action={decideLeaveType}><input type="hidden" name="code" value={t.code} /><input type="hidden" name="decision" value="approve" /><button style={{ background: "var(--green)", color: "#fff", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Approve</button></form>
                        <form action={decideLeaveType}><input type="hidden" name="code" value={t.code} /><input type="hidden" name="decision" value="reject" /><button style={{ background: "#fff", color: "var(--red-text)", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Reject</button></form>
                      </>
                    ) : <span style={{ fontSize: 11 }}>awaiting manager approval</span>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Leave balances per type per employee (spans both columns) */}
          <div style={{ ...box, overflow: "hidden", gridColumn: "1 / -1" }}>
            <div style={{ padding: "14px 16px" }}><b>Leave balances — {year}</b> <span style={{ color: "var(--muted)", fontSize: 12 }}>· remaining / entitled (used = approved days this year)</span></div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead><tr><th style={th}>Staff</th>{activeTypes.map((t) => <th key={t.code} style={{ ...th, textAlign: "center" }}>{t.code}</th>)}</tr></thead>
                <tbody>
                  {staff.map((s) => {
                    const used = leaveUsed.get(s.id);
                    return (
                      <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ ...td, fontWeight: 600 }}>{s.name}</td>
                        {activeTypes.map((t) => {
                          const ent = entitledFor(s, t);
                          if (ent === null) return <td key={t.code} style={{ ...td, textAlign: "center", color: "var(--muted)" }}>—</td>;
                          const u = used?.get(t.code) ?? 0;
                          const rem = ent - u;
                          return <td key={t.code} style={{ ...td, textAlign: "center" }}><b style={{ color: rem <= 0 ? "var(--red-text)" : rem <= 2 ? "var(--amber-text)" : "var(--ink)" }}>{rem}</b><span style={{ color: "var(--muted)" }}> / {ent}</span></td>;
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= HOLIDAYS ================= */}
      {tab === "holidays" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr", gap: 16, alignItems: "start" }}>
          <div style={{ ...box, padding: "16px 18px" }}>
            <b>Add holiday</b>
            <form action={addHoliday} style={{ display: "grid", gap: 8, marginTop: 10 }}>
              <input name="date" type="date" required style={inp} />
              <input name="name" placeholder="Holiday name" required style={inp} />
              <select name="kind" defaultValue="Public" style={inp}><option>Public</option><option>Restricted</option><option>Optional</option></select>
              <button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add holiday</button>
            </form>
          </div>
          <div style={{ ...box, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px" }}><b>Holiday calendar — {year}</b> <span style={{ color: "var(--muted)", fontSize: 12 }}>· {holidays.length} holidays</span></div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Date</th><th style={th}>Holiday</th><th style={th}>Type</th><th style={th} /></tr></thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...td, fontWeight: 600 }}>{new Date(h.date + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" })}</td>
                    <td style={td}>{h.name}</td>
                    <td style={td}>{chip("var(--blue-bg)", "var(--blue-text)", h.kind)}</td>
                    <td style={{ ...td, textAlign: "right" }}><form action={deleteHoliday}><input type="hidden" name="id" value={h.id} /><button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 9px", fontSize: 12, cursor: "pointer", color: "var(--muted)" }}>✕</button></form></td>
                  </tr>
                ))}
                {holidays.length === 0 && <tr><td colSpan={4} style={{ ...td, color: "var(--muted)" }}>No holidays added yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= EMPLOYEES ================= */}
      {tab === "employees" && (
        <div style={{ display: "grid", gridTemplateColumns: "0.8fr 2fr", gap: 16, alignItems: "start" }}>
          <div style={{ ...box, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px" }}><b>Employees</b></div>
            {staff.map((s) => (
              <a key={s.id} href={`/hr?tab=employees&emp=${s.id}`} style={{ display: "block", padding: "10px 16px", borderTop: "1px solid var(--border)", textDecoration: "none", color: "inherit", background: selectedEmp?.id === s.id ? "var(--brand-tint)" : "transparent" }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                <div style={{ color: "var(--muted)", fontSize: 11 }}>{s.designation ?? s.role} · {s.department ?? "—"}</div>
              </a>
            ))}
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            {!selectedEmp ? (
              <div style={{ ...box, padding: "24px", color: "var(--muted)", fontSize: 13 }}>Select an employee to manage documents and salary breakup.</div>
            ) : (() => {
              const sal = salaries.get(selectedEmp.id);
              const salRec = (sal ?? {}) as Record<string, number>;
              const docs = empDocs.filter((d) => d.staff_id === selectedEmp.id);
              const gross = (sal?.basic ?? 0) + (sal?.hra ?? 0) + (sal?.allowances ?? 0);
              const ded = (sal?.pf ?? 0) + (sal?.esi ?? 0) + (sal?.pt ?? 0) + (sal?.tds ?? 0);
              return (<>
                <div style={{ ...box, padding: "16px 18px" }}>
                  <b style={{ fontSize: 15 }}>{selectedEmp.name}</b> <span style={{ color: "var(--muted)", fontSize: 12 }}>· {selectedEmp.designation ?? selectedEmp.role} · {selectedEmp.department ?? "—"}</span>
                  <form action={updateStaffEmployment} style={{ display: "flex", gap: 10, alignItems: "end", marginTop: 12, flexWrap: "wrap" }}>
                    <input type="hidden" name="staff_id" value={selectedEmp.id} />
                    <label style={{ fontSize: 12, color: "var(--muted)" }}>Date of joining<br /><input name="date_of_joining" type="date" defaultValue={selectedEmp.date_of_joining ?? ""} style={{ ...inp, marginTop: 4 }} /></label>
                    <label style={{ fontSize: 12, color: "var(--muted)" }}>Gender<br /><select name="gender" defaultValue={selectedEmp.gender ?? ""} style={{ ...inp, marginTop: 4 }}><option value="">—</option><option value="female">Female</option><option value="male">Male</option></select></label>
                    <button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>Drives EL (after 1 yr) &amp; ML (female) eligibility.</span>
                  </form>
                </div>
                <div style={{ ...box, padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}><b>Documents</b><span style={{ flex: 1 }} />{chip("var(--neutral-bg)", "var(--muted)", "onboarding forms · certificates · IDs")}</div>
                  <EmployeeDocUpload staffId={selectedEmp.id} />
                  <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
                    <tbody>
                      {docs.map((d) => (
                        <tr key={d.id} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={td}>{chip("var(--blue-bg)", "var(--blue-text)", d.kind)}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{d.title}<div style={{ color: "var(--muted)", fontSize: 11 }}>{d.name}</div></td>
                          <td style={{ ...td, color: "var(--muted)" }}>{new Date(d.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td>
                          <td style={{ ...td, textAlign: "right" }}><form action={deleteEmployeeDoc}><input type="hidden" name="id" value={d.id} /><button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 9px", fontSize: 12, cursor: "pointer", color: "var(--muted)" }}>✕</button></form></td>
                        </tr>
                      ))}
                      {docs.length === 0 && <tr><td colSpan={4} style={{ ...td, color: "var(--muted)" }}>No documents uploaded.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div style={{ ...box, padding: "16px 18px" }}>
                  <b>Salary breakup</b>
                  <form action={saveSalaryStructure} style={{ marginTop: 10 }}>
                    <input type="hidden" name="staff_id" value={selectedEmp.id} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>Earnings</div>
                        {([["basic", "Basic"], ["hra", "HRA"], ["allowances", "Allowances"]] as const).map(([k, l]) => (
                          <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 13 }}><span style={{ flex: 1 }}>{l}</span><input name={k} type="number" min={0} defaultValue={salRec[k] ?? 0} style={{ ...inp, width: 120 }} /></label>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>Deductions</div>
                        {([["pf", "PF"], ["esi", "ESI"], ["pt", "Professional Tax"], ["tds", "TDS"]] as const).map(([k, l]) => (
                          <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 13 }}><span style={{ flex: 1 }}>{l}</span><input name={k} type="number" min={0} defaultValue={salRec[k] ?? 0} style={{ ...inp, width: 120 }} /></label>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13 }}>Gross <b>{money(gross)}</b></span>
                      <span style={{ fontSize: 13 }}>Deductions <b>{money(ded)}</b></span>
                      <span style={{ fontSize: 13 }}>Net <b style={{ color: "var(--green-text)" }}>{money(gross - ded)}</b></span>
                      <span style={{ flex: 1 }} />
                      <label style={{ fontSize: 12, color: "var(--muted)" }}>Effective <input name="effective_from" type="date" defaultValue={sal?.effective_from ?? ""} style={inp} /></label>
                      <button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
                    </div>
                  </form>
                </div>
              </>);
            })()}
          </div>
        </div>
      )}

      {/* ================= PAYROLL & STATUTORY ================= */}
      {tab === "payroll" && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ ...box, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}><b>Month-End Verification</b><span style={{ flex: 1 }} />{chip("var(--neutral-bg)", "var(--muted)", "window: 26th onwards")}</div>
            {monthTasks.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border)", fontSize: 13.5 }}>
                <b>{t.label}</b><span style={{ flex: 1 }} />
                {t.status === "done"
                  ? <>{chip("var(--green-bg)", "var(--green-text)", t.detail ?? "Done")}<form action={toggleMonthTask}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value={t.status} /><button style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 11, cursor: "pointer" }}>undo</button></form></>
                  : <form action={toggleMonthTask}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value={t.status} /><button style={{ background: "var(--amber-bg)", color: "var(--amber-text)", border: "none", borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Pending — mark done</button></form>}
              </div>
            ))}
            {monthTasks.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No verification tasks for this month.</div>}
          </div>

          <div style={{ ...box, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "14px 16px" }}><b>Payroll Processing — {new Date(today + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</b><span style={{ flex: 1 }} />{chip("var(--neutral-bg)", "var(--muted)", "salary sheet")}</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Staff</th><th style={th}>Base</th><th style={th}>LOP</th><th style={th}>PF</th><th style={th}>Net pay</th><th style={th}>Payslip</th></tr></thead>
              <tbody>
                {staff.map((s) => {
                  const r = pay.get(s.id);
                  // The Salary breakup is the source of truth: base = gross,
                  // deductions = PF + ESI + PT + TDS, net = gross − deductions − LOP.
                  const sal = salaries.get(s.id);
                  const gross = sal ? (sal.basic ?? 0) + (sal.hra ?? 0) + (sal.allowances ?? 0) : 0;
                  const ded = sal ? (sal.pf ?? 0) + (sal.esi ?? 0) + (sal.pt ?? 0) + (sal.tds ?? 0) : (r?.pf ?? 0);
                  const base = gross || r?.base || 0;
                  const lop = r?.lop_days ?? 0;
                  const pf = sal?.pf ?? r?.pf ?? 0;
                  const net = base ? Math.max(0, base - ded - lop * (base / 30)) : 0;
                  return (
                    <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ ...td, fontWeight: 600 }}>{s.name}<div style={{ color: "var(--muted)", fontSize: 11 }}>{s.designation ?? ""}</div></td>
                      <td style={td}>{base ? money(base) : "—"}</td>
                      <td style={td}>{lop > 0 ? chip("var(--amber-bg)", "var(--amber-text)", `${lop} day · −${money(lop * (base / 30))}`) : chip("var(--neutral-bg)", "var(--muted)", "0")}</td>
                      <td style={td}>{money(pf)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{base ? money(net) : "—"}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        {base ? (
                          <form action={generatePayslip}>
                            <input type="hidden" name="staff_id" value={s.id} /><input type="hidden" name="month" value={month} />
                            <input type="hidden" name="base" value={base} /><input type="hidden" name="lop_days" value={lop} /><input type="hidden" name="pf" value={pf} /><input type="hidden" name="deductions" value={ded} />
                            <button style={{ border: "1px solid var(--border)", background: r?.payslip ? "var(--green-bg)" : "#fff", color: r?.payslip ? "var(--green-text)" : "var(--brand-text)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{r?.payslip ? "✓ Payslip" : "Generate payslip"}</button>
                          </form>
                        ) : (
                          <span style={{ fontSize: 11.5, color: "var(--muted)" }} title="Set this employee's Salary breakup first (Employees tab)">Set salary first</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
            <div style={{ ...box, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}><b>Commission Tracking</b><span style={{ flex: 1 }} />{chip("var(--neutral-bg)", "var(--muted)", "training · sales · TDS")}</div>
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
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}><b>Statutory Records</b><span style={{ flex: 1 }} />{chip("var(--neutral-bg)", "var(--muted)", "ESI & PF · due 3rd–4th")}</div>
              {statutory.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                  <div><b>{s.name}</b><div style={{ color: "var(--muted)", fontSize: 12 }}>{s.due_note ?? ""}</div></div>
                  <span style={{ flex: 1 }} />
                  {chip(s.status === "filed" ? "var(--green-bg)" : s.status === "prepared" ? "var(--blue-bg)" : "var(--amber-bg)", s.status === "filed" ? "var(--green-text)" : s.status === "prepared" ? "var(--blue-text)" : "var(--amber-text)", s.status === "in_progress" ? "In progress" : s.status[0].toUpperCase() + s.status.slice(1))}
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
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}><b>Recruitment</b><span style={{ flex: 1 }} />{chip("var(--neutral-bg)", "var(--muted)", "Indeed · Referrals · LinkedIn")}</div>
            {candidates.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                <div><b>{c.name}</b><div style={{ color: "var(--muted)", fontSize: 12 }}>{c.role ?? ""}{c.source ? ` · via ${c.source}` : ""}</div></div>
                <span style={{ flex: 1 }} />
                {chip(c.stage === "Hired" ? "var(--green-bg)" : c.stage === "Offer sent" ? "var(--blue-bg)" : "var(--amber-bg)", c.stage === "Hired" ? "var(--green-text)" : c.stage === "Offer sent" ? "var(--blue-text)" : "var(--amber-text)", c.stage)}
                {c.stage !== "Hired" && <form action={advanceCandidate}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="stage" value={c.stage} /><button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--brand-text)" }}>Advance →</button></form>}
              </div>
            ))}
            {candidates.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No open roles.</div>}
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ ...box, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}><b>HR Documents</b><span style={{ flex: 1 }} />{chip("var(--neutral-bg)", "var(--muted)", "offer · experience · contracts")}</div>
              {documents.map((d) => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                  <div style={{ flex: 1 }}><b>{d.title}</b><div style={{ color: "var(--muted)", fontSize: 12 }}>{d.kind ?? ""}{d.doc_date ? ` · ${fmtDate(d.doc_date)}` : " · —"}</div></div>
                  <span style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Open</span>
                </div>
              ))}
            </div>
            <div style={{ ...box, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}><b>Purchase List</b><span style={{ flex: 1 }} />{chip("var(--neutral-bg)", "var(--muted)", "office & HR purchases")}</div>
              {purchases.map((pu) => (
                <div key={pu.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                  <div style={{ flex: 1 }}><b>{pu.item}</b><div style={{ color: "var(--muted)", fontSize: 12 }}>{pu.requested_by ?? ""}{pu.req_date ? ` · ${fmtDate(pu.req_date)}` : ""}</div></div>
                  {chip(pu.status === "delivered" ? "var(--green-bg)" : pu.status === "ordered" ? "var(--blue-bg)" : "var(--amber-bg)", pu.status === "delivered" ? "var(--green-text)" : pu.status === "ordered" ? "var(--blue-text)" : "var(--amber-text)", pu.status[0].toUpperCase() + pu.status.slice(1))}
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><b style={{ color: "var(--green)" }}>Employee Onboarding</b><span style={{ flex: 1 }} /><OnboardingForm /></div>
            <div style={{ display: "grid", gap: 14 }}>
              {onboarding.map((o) => <OnboardingCard key={o.id} id={o.id} name={o.name} role={o.role} joining={o.joining_date} steps={o.steps ?? []} status={o.status} />)}
              {onboarding.length === 0 && <div style={{ ...box, padding: "20px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No one onboarding.</div>}
            </div>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><b style={{ color: "#dc2626" }}>Employee Offboarding</b><span style={{ flex: 1 }} /></div>
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
