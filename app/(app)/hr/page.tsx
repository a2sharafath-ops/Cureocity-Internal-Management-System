import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { AttendanceButtons, LeaveForm, LeaveActions, PayrollRow } from "@/components/HrControls";
import { OnboardingForm, OnboardingCard } from "@/components/OnboardingControls";

export const dynamic = "force-dynamic";

const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
type Staff = { id: string; name: string; role: string; department: string | null };

export default async function HrPage({ searchParams }: { searchParams: { tab?: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/hr")) redirect("/dashboard");
  const tab = ["attendance", "leave", "payroll", "onboarding"].includes(searchParams.tab ?? "") ? searchParams.tab! : "attendance";

  const today = todayISO();
  const month = today.slice(0, 7);
  const monthLabel = new Date(today + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const supabase = createClient();
  const [{ data: staffData }, { data: attData }, { data: leaveData }, { data: payData }, { data: obData }] = await Promise.all([
    supabase.from("staff").select("id, name, role, department").order("name"),
    supabase.from("attendance").select("staff_id, status").eq("date", today),
    supabase.from("leaves").select("id, staff_id, from_date, to_date, type, reason, status, staff(name)").order("created_at", { ascending: false }).limit(60),
    supabase.from("payroll").select("id, staff_id, base, lop_days, net, status").eq("month", month),
    supabase.from("onboarding").select("id, name, role, joining_date, steps, status").order("created_at", { ascending: false }),
  ]);
  const onboarding = (obData ?? []) as unknown as { id: string; name: string; role: string | null; joining_date: string | null; steps: { label: string; done: boolean }[]; status: string }[];
  const staff = (staffData ?? []) as Staff[];
  const att = new Map(((attData ?? []) as { staff_id: string; status: string }[]).map((a) => [a.staff_id, a.status]));
  const leaves = (leaveData ?? []) as unknown as { id: string; staff_id: string; from_date: string; to_date: string; type: string; reason: string | null; status: string; staff: { name: string } | null }[];
  const pay = new Map(((payData ?? []) as { id: string; staff_id: string; base: number; lop_days: number; net: number; status: string }[]).map((r) => [r.staff_id, r]));

  const presentToday = [...att.values()].filter((s) => s === "present").length;
  const pendingLeaves = leaves.filter((l) => l.status === "pending").length;
  const payrollTotal = [...pay.values()].reduce((s, r) => s + Number(r.net), 0);

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };
  const stat = (label: string, value: string) => (
    <div style={{ ...box, padding: "14px 16px", flex: 1, minWidth: 150 }}><div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div><div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div></div>
  );
  const tabLink = (key: string, label: string) => (
    <Link href={`/hr?tab=${key}`} style={{ padding: "7px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: "none", border: "1px solid var(--border)", background: tab === key ? "var(--teal)" : "#fff", color: tab === key ? "#fff" : "var(--muted)" }}>{label}</Link>
  );
  const leaveChip = (s: string) => {
    const m: Record<string, [string, string]> = { approved: ["var(--green-bg)", "#166534"], rejected: ["#fee2e2", "var(--red)"], pending: ["var(--amber-bg)", "#b45309"] };
    const [bg, c] = m[s] ?? ["#eef2f1", "var(--muted)"];
    return <span style={{ background: bg, color: c, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{s}</span>;
  };

  return (
    <div style={{ maxWidth: 1080 }}>
      <RealtimeRefresh tables={["attendance", "leaves", "payroll"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>HR</h1>
        <span style={{ flex: 1 }} />
        {tab === "leave" && <LeaveForm staff={staff} />}
        {tab === "onboarding" && <OnboardingForm />}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>Attendance, leave &amp; payroll — all people operations.</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {stat("Present today", `${presentToday}/${staff.length}`)}
        {stat("Pending leave", String(pendingLeaves))}
        {stat(`Payroll — ${monthLabel}`, money(payrollTotal))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {tabLink("attendance", "Attendance")}{tabLink("leave", "Leave")}{tabLink("payroll", "Payroll")}{tabLink("onboarding", "Onboarding")}
      </div>

      {tab === "attendance" && (
        <div style={{ ...box, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Staff</th><th style={th}>Role</th><th style={th}>Today</th></tr></thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...td, fontWeight: 600 }}>{s.name}<div style={{ color: "var(--muted)", fontSize: 11 }}>{s.department ?? ""}</div></td>
                  <td style={{ ...td, color: "var(--muted)" }}>{s.role}</td>
                  <td style={{ ...td, textAlign: "right" }}><AttendanceButtons staffId={s.id} date={today} current={att.get(s.id) ?? null} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "leave" && (
        <div style={{ ...box, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Staff</th><th style={th}>Dates</th><th style={th}>Type</th><th style={th}>Status</th><th style={th} /></tr></thead>
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...td, fontWeight: 600 }}>{l.staff?.name ?? "—"}{l.reason && <div style={{ color: "var(--muted)", fontSize: 11 }}>{l.reason}</div>}</td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{l.from_date}{l.to_date !== l.from_date ? ` → ${l.to_date}` : ""}</td>
                  <td style={{ ...td, color: "var(--muted)" }}>{l.type}</td>
                  <td style={td}>{leaveChip(l.status)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{l.status === "pending" && <LeaveActions id={l.id} />}</td>
                </tr>
              ))}
              {leaves.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No leave requests.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "onboarding" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
          {onboarding.map((o) => <OnboardingCard key={o.id} id={o.id} name={o.name} role={o.role} joining={o.joining_date} steps={o.steps ?? []} status={o.status} />)}
          {onboarding.length === 0 && <div style={{ ...box, padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13, gridColumn: "1 / -1" }}>No one onboarding. Click “+ New hire” to start a checklist.</div>}
        </div>
      )}

      {tab === "payroll" && (
        <div style={{ ...box, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Staff</th><th style={th}>Net</th><th style={th}>Status</th><th style={th}>Base · LOP · pay</th></tr></thead>
            <tbody>
              {staff.map((s) => {
                const r = pay.get(s.id);
                return (
                  <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...td, fontWeight: 600 }}>{s.name}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{r ? money(r.net) : "—"}</td>
                    <td style={td}>{r ? (r.status === "paid" ? <span style={{ background: "var(--green-bg)", color: "#166534", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>paid</span> : <span style={{ background: "var(--amber-bg)", color: "#b45309", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>pending</span>) : <span style={{ color: "var(--muted)", fontSize: 12 }}>not set</span>}</td>
                    <td style={{ ...td, textAlign: "right" }}><PayrollRow staffId={s.id} month={month} base={r?.base ?? 0} lopDays={r?.lop_days ?? 0} id={r?.id ?? null} status={r?.status ?? null} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
