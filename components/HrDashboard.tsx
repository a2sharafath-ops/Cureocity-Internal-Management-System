// HR home — the people desk. Same shape as the other role dashboards, but the
// "money" row is headcount and the exception queue is about people: unmarked
// attendance, leave waiting on a decision, payroll not run, onboarding stalled.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/today";
import StatCard from "@/components/StatCard";
import MetricCard from "@/components/MetricCard";
import AttentionPanel, { type Flag } from "@/components/AttentionPanel";

const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: ".6px", color: "var(--muted)", textTransform: "uppercase", margin: "0 0 8px" };
const qa: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, textDecoration: "none", color: "var(--ink)" };

export default async function HrDashboard({ name }: { name: string }) {
  const supabase = createClient();
  const today = todayISO();
  const month = today.slice(0, 7);

  const [
    { data: staffData }, { data: attData }, { data: leaveData },
    { data: payData }, { data: onbData }, { data: candData }, { data: profileData },
  ] = await Promise.all([
    supabase.from("staff").select("id, name, role, department, is_trainer, branch, leave_balance, created_at"),
    supabase.from("attendance").select("staff_id, status, date").eq("date", today),
    supabase.from("leaves").select("id, staff_id, from_date, to_date, type, status, staff(name)"),
    supabase.from("payroll").select("id, staff_id, month, net, status, payslip"),
    supabase.from("onboarding").select("id, name, role, joining_date, steps, status, kind"),
    supabase.from("hr_candidates").select("id, name, role, stage"),
    supabase.from("profiles").select("id, name, staff_id, role").neq("role", "Client"),
  ]);

  const staff = (staffData ?? []) as { id: string; name: string; role: string; department: string | null; is_trainer: boolean; branch: string | null; leave_balance: number | null; created_at: string }[];
  const attendance = (attData ?? []) as { staff_id: string; status: string; date: string }[];
  const leaves = (leaveData ?? []) as unknown as { id: string; staff_id: string; from_date: string; to_date: string; type: string | null; status: string; staff: { name: string } | null }[];
  const payroll = (payData ?? []) as { id: string; staff_id: string; month: string; net: number; status: string; payslip: boolean }[];
  const onboarding = (onbData ?? []) as { id: string; name: string; role: string | null; joining_date: string | null; steps: { label: string; done: boolean }[] | null; status: string; kind: string }[];
  const candidates = (candData ?? []) as { id: string; name: string; role: string | null; stage: string | null }[];
  const profiles = (profileData ?? []) as { id: string; name: string | null; staff_id: string | null; role: string }[];

  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? "—";

  // ---- headcount -----------------------------------------------------------
  const present = attendance.filter((a) => (a.status ?? "").toLowerCase() === "present").length;
  const onLeave = attendance.filter((a) => (a.status ?? "").toLowerCase() === "leave").length;
  const marked = attendance.length;
  const unmarked = staff.filter((s) => !attendance.some((a) => a.staff_id === s.id));

  const payThisMonth = payroll.filter((p) => p.month === month);
  const payPaid = payThisMonth.filter((p) => p.status === "paid");
  const payrollValue = payThisMonth.reduce((s, p) => s + Number(p.net), 0);

  const pendingLeave = leaves.filter((l) => l.status === "pending");
  const openOnboarding = onboarding.filter((o) => o.status !== "complete");

  // ---- exception queue -----------------------------------------------------
  const flags: Flag[] = [];

  if (unmarked.length) {
    flags.push({
      sev: unmarked.length === staff.length ? "high" : "med",
      title: `${unmarked.length} of ${staff.length} not marked today`,
      detail: unmarked.slice(0, 4).map((s) => s.name).join(", ") + (unmarked.length > 4 ? "…" : ""),
      href: "/hr?tab=attendance", cta: "Mark",
    });
  }
  for (const l of pendingLeave) {
    const starting = l.from_date <= today;
    flags.push({
      sev: starting ? "high" : "med",
      title: `${l.staff?.name ?? nameOf(l.staff_id)} — leave awaiting decision`,
      detail: `${l.type ?? "Leave"} · ${l.from_date} → ${l.to_date}${starting ? " · already started" : ""}`,
      href: "/hr?tab=leave", cta: "Decide",
    });
  }
  if (staff.length && !payThisMonth.length) {
    flags.push({ sev: "high", title: `Payroll not run for ${month}`, detail: `${staff.length} staff with nothing recorded`, href: "/hr?tab=payroll", cta: "Run" });
  } else {
    for (const p of payThisMonth.filter((p) => p.status !== "paid")) {
      flags.push({ sev: "med", title: `${nameOf(p.staff_id)} — salary unpaid`, detail: `${p.month} · ${money(Number(p.net))}`, href: "/hr?tab=payroll", cta: "Pay" });
    }
    for (const p of payThisMonth.filter((p) => p.status === "paid" && !p.payslip)) {
      flags.push({ sev: "low", title: `${nameOf(p.staff_id)} — payslip not issued`, detail: `Paid, but no payslip on record`, href: "/hr?tab=payroll", cta: "Issue" });
    }
  }
  for (const o of openOnboarding) {
    const steps = o.steps ?? [];
    const done = steps.filter((s) => s.done).length;
    flags.push({
      sev: o.joining_date && o.joining_date < today ? "high" : "med",
      title: `${o.name} — ${o.kind === "offboarding" ? "offboarding" : "onboarding"} incomplete`,
      detail: `${done} of ${steps.length} steps done${o.joining_date ? ` · joins ${o.joining_date}` : ""}`,
      href: "/hr?tab=boarding", cta: "Continue",
    });
  }
  // staff directory rows with nobody able to log in
  for (const s of staff.filter((s) => !profiles.some((p) => p.staff_id === s.id))) {
    flags.push({ sev: "low", title: `${s.name} — no login`, detail: `In the directory but can't sign in`, href: "/users", cta: "Create" });
  }
  const order = { high: 0, med: 1, low: 2 };
  flags.sort((a, b) => order[a.sev] - order[b.sev]);

  // ---- department split ----------------------------------------------------
  const depts = [...new Set(staff.map((s) => s.department ?? "Unassigned"))]
    .map((d) => ({ name: d, count: staff.filter((s) => (s.department ?? "Unassigned") === d).length }))
    .sort((a, b) => b.count - a.count);

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 21, margin: "0 0 2px" }}>Welcome back, {name.split(" ")[0]}</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
          HR view — who&apos;s in, who&apos;s off, what&apos;s owed and who&apos;s joining.
        </p>
      </div>

      {/* 1 — HEADCOUNT */}
      <div style={sectionTitle}>Headcount</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="On the team" value={String(staff.length)} sub={`${depts.length} department${depts.length === 1 ? "" : "s"}`} minWidth={170} />
        <StatCard label="Payroll this month" value={money(payrollValue)} sub={`${payPaid.length} of ${payThisMonth.length} paid`} minWidth={180} color={payThisMonth.length && payPaid.length < payThisMonth.length ? "var(--amber-text-soft)" : undefined} />
        <StatCard label="Leave requests" value={String(pendingLeave.length)} sub="awaiting a decision" color={pendingLeave.length ? "var(--amber-text-soft)" : undefined} minWidth={170} />
        <StatCard label="Joining / leaving" value={String(openOnboarding.length)} sub="in progress" minWidth={165} />
        <StatCard label="Open roles" value={String(candidates.length)} sub="candidates in play" minWidth={165} />
      </div>

      {/* 2 — NEEDS ATTENTION */}
      <AttentionPanel flags={flags} />

      {/* 3 — TODAY */}
      <div style={sectionTitle}>Today</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 20 }}>
        <MetricCard value={present} label="Present" href="/hr?tab=attendance"
          meter={{ of: staff.length || 1, filled: present }} sub={`of ${staff.length} on the team`} />
        <MetricCard value={marked} label="Attendance marked" href="/hr?tab=attendance"
          meter={{ of: staff.length || 1, filled: marked }}
          sub={unmarked.length ? `${unmarked.length} still to mark` : "everyone accounted for"} />
        <MetricCard value={onLeave} label="On leave" href="/hr?tab=leave"
          meter={{ of: staff.length || 1, filled: onLeave }}
          sub={pendingLeave.length ? `${pendingLeave.length} request${pendingLeave.length === 1 ? "" : "s"} pending` : "no pending requests"} />
        <MetricCard value={payThisMonth.length ? `${Math.round((payPaid.length / payThisMonth.length) * 100)}%` : "—"} label="Payroll run" href="/hr?tab=payroll"
          meter={{ of: payThisMonth.length || 1, filled: payPaid.length }}
          sub={payThisMonth.length ? `${payPaid.length} of ${payThisMonth.length} paid` : "not started"} />
      </div>

      {/* 4 — SUPPORTING DETAIL */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ ...box, padding: "14px 16px" }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>By department</div>
          {depts.length ? depts.map((d, i) => {
            const pct = staff.length ? Math.round((d.count / staff.length) * 100) : 0;
            return (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 12.5, borderTop: i ? "1px solid var(--border)" : "none" }}>
                <span style={{ width: 110, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
                <div style={{ flex: 1, background: "var(--neutral-bg)", borderRadius: 6, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "var(--brand-fill)" }} />
                </div>
                <span style={{ color: "var(--muted)", minWidth: 30, textAlign: "right" }}>{d.count}</span>
              </div>
            );
          }) : <div style={{ color: "var(--muted)", fontSize: 13 }}>Nobody in the directory yet.</div>}
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/hr" style={qa}>HR</Link>
            <Link href="/users" style={qa}>Users &amp; Roles</Link>
            <Link href="/kb" style={qa}>SOP&apos;s</Link>
            <Link href="/tasks" style={qa}>Tasks</Link>
          </div>
        </div>

        <div style={{ ...box, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>Joining &amp; leaving</div>
            <span style={{ flex: 1 }} />
            <Link href="/hr?tab=boarding" style={{ color: "var(--brand-text)", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>All →</Link>
          </div>
          {openOnboarding.length ? openOnboarding.map((o, i) => {
            const steps = o.steps ?? [];
            const done = steps.filter((s) => s.done).length;
            const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
            return (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", fontSize: 12.5, borderTop: i ? "1px solid var(--border)" : "none" }}>
                <span style={{ width: 110, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 600 }}>{o.name}</span>
                <span style={{ background: o.kind === "offboarding" ? "var(--amber-bg)" : "var(--brand-tint)", color: o.kind === "offboarding" ? "var(--amber-text)" : "var(--brand-text)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>
                  {o.kind === "offboarding" ? "Leaving" : "Joining"}
                </span>
                <div style={{ flex: 1, background: "var(--neutral-bg)", borderRadius: 6, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "var(--brand-fill)" }} />
                </div>
                <span style={{ color: "var(--muted)", minWidth: 44, textAlign: "right" }}>{done}/{steps.length}</span>
              </div>
            );
          }) : <div style={{ color: "var(--muted)", fontSize: 13 }}>Nobody joining or leaving right now.</div>}

          {candidates.length > 0 && (
            <>
              <div style={{ fontWeight: 700, margin: "14px 0 8px", fontSize: 13 }}>Recruitment</div>
              {candidates.slice(0, 5).map((c, i) => (
                <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", fontSize: 12.5, borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                  <span style={{ color: "var(--muted)" }}>{c.role ?? "—"}</span>
                  <span style={{ background: "var(--neutral-bg)", color: "var(--muted)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 600 }}>{c.stage ?? "applied"}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
