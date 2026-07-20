// Manager home — same shape as the owner view (money, exception queue, then
// Today and Growth up front, supporting detail below), but pointed at the floor
// rather than the business: who's in today, what's slipping, who's idle.
// Governance and control sit with the owner, so that panel is replaced by the
// day's actual schedule.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/today";
import StatCard from "@/components/StatCard";
import MetricCard from "@/components/MetricCard";
import AttentionPanel, { type Flag } from "@/components/AttentionPanel";

const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: ".6px", color: "var(--muted)", textTransform: "uppercase", margin: "0 0 8px" };

function addDays(iso: string, d: number) {
  const x = new Date(iso + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + d);
  return x.toISOString().slice(0, 10);
}
function fmtHour(h: number | null) {
  if (h == null) return "—";
  const am = h < 12, hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${am ? "AM" : "PM"}`;
}

export default async function ManagerDashboard({ name }: { name: string }) {
  const supabase = createClient();
  const today = todayISO();
  const month = today.slice(0, 7);
  const monthStart = month + "-01";
  const overdueCut = addDays(today, -7);

  const [
    { data: clientData }, { data: sessData }, { data: apptData }, { data: leadData },
    { data: invData }, { data: staffData }, { data: attData }, { data: fuData },
    { data: consultData }, { data: assignData },
  ] = await Promise.all([
    supabase.from("clients").select("id, code, name, package_id, used, joined"),
    supabase.from("sessions").select("id, client_id, trainer_id, status, date, hour, clients(id, name), staff(name)"),
    supabase.from("appointments").select("id, client_id, provider_id, type, date, hour, status, clients(id, name), staff(name)"),
    supabase.from("leads").select("id, stage"),
    supabase.from("invoices").select("id, num, client_id, amount, status, issued_date, paid_date"),
    supabase.from("staff").select("id, name, role, is_trainer"),
    supabase.from("attendance").select("staff_id, status").eq("date", today),
    supabase.from("followups").select("id, client_id, status, due_date, priority, clients(id, name)").eq("status", "pending"),
    supabase.from("consultations").select("id, kind, status, client_id, clients(id, name)").neq("status", "completed"),
    supabase.from("client_assignments").select("client_id, discipline, staff_id"),
  ]);

  const clients = (clientData ?? []) as { id: string; code: string | null; name: string; package_id: string | null; used: number | null; joined: string | null }[];
  const sessions = (sessData ?? []) as unknown as { id: string; client_id: string; trainer_id: string | null; status: string; date: string; hour: number | null; clients: { id: string; name: string } | null; staff: { name: string } | null }[];
  const appts = (apptData ?? []) as unknown as { id: string; client_id: string; provider_id: string | null; type: string | null; date: string; hour: number | null; status: string; clients: { id: string; name: string } | null; staff: { name: string } | null }[];
  const leads = (leadData ?? []) as { id: string; stage: string | null }[];
  const invoices = (invData ?? []) as { id: string; num: number | null; client_id: string | null; amount: number; status: string; issued_date: string | null; paid_date: string | null }[];
  const staff = (staffData ?? []) as { id: string; name: string; role: string; is_trainer: boolean }[];
  const attendance = (attData ?? []) as { staff_id: string; status: string }[];
  const followups = (fuData ?? []) as unknown as { id: string; client_id: string; status: string; due_date: string; priority: string | null; clients: { id: string; name: string } | null }[];
  const consults = (consultData ?? []) as unknown as { id: string; kind: string; status: string; client_id: string; clients: { id: string; name: string } | null }[];
  const assigns = (assignData ?? []) as { client_id: string; discipline: string; staff_id: string | null }[];

  // ---- money (collections are a manager's job; strategy isn't) --------------
  const paid = invoices.filter((i) => i.status === "Paid");
  const unpaid = invoices.filter((i) => i.status !== "Paid");
  const revenueMonth = paid.filter((i) => (i.paid_date ?? "").startsWith(month)).reduce((s, i) => s + Number(i.amount), 0);
  const outstanding = unpaid.reduce((s, i) => s + Number(i.amount), 0);

  // ---- exception queue -----------------------------------------------------
  const flags: Flag[] = [];
  const nameOf = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";

  for (const f of followups.filter((f) => f.due_date < today)) {
    flags.push({
      sev: f.priority === "mandatory" ? "high" : "med",
      title: `${f.clients?.name ?? nameOf(f.client_id)} — follow-up overdue`,
      detail: `Due ${f.due_date}${f.priority === "mandatory" ? " · mandatory" : ""}`,
      href: "/followups", cta: "Call",
    });
  }
  for (const i of invoices.filter((i) => i.status !== "Paid" && (i.issued_date ?? "") <= overdueCut)) {
    flags.push({
      sev: "high",
      title: `INV-${String(i.num ?? 0).padStart(3, "0")} unpaid`,
      detail: `${i.client_id ? nameOf(i.client_id) : "—"} · ${money(Number(i.amount))} · issued ${i.issued_date}`,
      href: "/billing", cta: "Chase",
    });
  }
  for (const c of consults) {
    flags.push({
      sev: "med",
      title: `${c.clients?.name ?? nameOf(c.client_id)} — ${c.kind} consultation open`,
      detail: "Started but not completed",
      href: "/pro", cta: "Review",
    });
  }
  // clients with credits left but nothing on the calendar
  for (const c of clients) {
    const upcoming = sessions.filter((s) => s.client_id === c.id && s.status === "scheduled" && s.date >= today).length;
    const mine = sessions.filter((s) => s.client_id === c.id).length;
    if (mine > 0 && upcoming === 0) {
      flags.push({
        sev: "med", title: `${c.name} — nothing booked`,
        detail: "No upcoming session on the calendar", href: `/clients/${c.id}`, cta: "Book",
      });
    }
  }
  // care team gaps — a client with no trainer or no coach assigned
  for (const c of clients) {
    const mine = assigns.filter((a) => a.client_id === c.id && a.staff_id);
    const missing = ["trainer", "coach"].filter((d) => !mine.some((a) => a.discipline === d));
    if (missing.length) {
      flags.push({
        sev: "low", title: `${c.name} — no ${missing.join(" or ")} assigned`,
        detail: "Care team incomplete", href: `/clients/${c.id}`, cta: "Assign",
      });
    }
  }
  const order = { high: 0, med: 1, low: 2 };
  flags.sort((a, b) => order[a.sev] - order[b.sev]);

  // ---- today ---------------------------------------------------------------
  const sessToday = sessions.filter((s) => s.date === today);
  const sessDone = sessToday.filter((s) => s.status === "completed").length;
  const apptsAll = appts.filter((a) => a.date === today);
  const apptsOpen = apptsAll.filter((a) => a.status === "scheduled");
  const present = attendance.filter((a) => (a.status ?? "").toLowerCase() === "present").length;
  const fuToday = followups.filter((f) => f.due_date <= today);
  const fuDone = followups.filter((f) => f.due_date === today).length;

  // ---- growth --------------------------------------------------------------
  const won = leads.filter((l) => (l.stage ?? "").startsWith("5")).length;
  const openLeads = leads.filter((l) => !(l.stage ?? "").startsWith("5") && (l.stage ?? "") !== "LOST").length;
  const convRate = leads.length ? Math.round((won / leads.length) * 100) : 0;

  // ---- staff utilisation ---------------------------------------------------
  const util = staff.filter((s) => s.is_trainer).map((t) => ({
    name: t.name,
    done: sessions.filter((s) => s.trainer_id === t.id && s.status === "completed" && s.date.startsWith(month)).length,
    upcoming: sessions.filter((s) => s.trainer_id === t.id && s.status === "scheduled" && s.date >= today).length,
  })).sort((a, b) => (b.done + b.upcoming) - (a.done + a.upcoming));
  const idle = util.filter((t) => t.done + t.upcoming === 0).length;

  // ---- the day's actual schedule ------------------------------------------
  const schedule = [
    ...apptsAll.map((a) => ({ kind: a.type ?? "Appointment", hour: a.hour, who: a.clients?.name ?? "—", clientId: a.clients?.id, with: a.staff?.name ?? "—", status: a.status })),
    ...sessToday.map((s) => ({ kind: "Training", hour: s.hour, who: s.clients?.name ?? "—", clientId: s.clients?.id, with: s.staff?.name ?? "—", status: s.status })),
  ].sort((a, b) => (a.hour ?? 0) - (b.hour ?? 0));

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 21, margin: "0 0 2px" }}>Welcome back, {name.split(" ")[0]}</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
          Manager view — the floor today, what&apos;s slipping and who&apos;s free. Strategy and governance sit with the owner.
        </p>
      </div>

      {/* 1 — MONEY (collections only) */}
      <div style={sectionTitle}>Money</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Revenue this month" value={money(revenueMonth)} sub={`${paid.length} paid invoice${paid.length === 1 ? "" : "s"}`} minWidth={180} />
        <StatCard label="Outstanding" value={money(outstanding)} sub={`${unpaid.length} unpaid`} color={outstanding ? "var(--red)" : undefined} minWidth={170} />
        <StatCard label="Follow-ups pending" value={String(followups.length)} sub={`${followups.filter((f) => f.due_date < today).length} overdue`} color={followups.some((f) => f.due_date < today) ? "#b45309" : undefined} minWidth={170} />
      </div>

      {/* 2 — NEEDS ATTENTION */}
      <AttentionPanel flags={flags} />

      {/* 3 — TODAY */}
      <div style={sectionTitle}>Today</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 20 }}>
        <MetricCard value={sessToday.length} label="Sessions" href="/sessions"
          meter={{ of: sessToday.length, filled: sessDone }}
          sub={sessToday.length ? `${sessDone} of ${sessToday.length} completed` : "none scheduled"} />
        <MetricCard value={apptsOpen.length} label="Appointments" href="/appointments"
          meter={{ of: apptsAll.length, filled: apptsOpen.length }}
          sub={apptsAll.length ? `${apptsOpen.length} of ${apptsAll.length} still to run` : "none booked"} />
        <MetricCard value={present} label="Staff present" href="/hr?tab=attendance"
          meter={{ of: staff.length, filled: present }}
          sub={`of ${staff.length} on the team`} />
        <MetricCard value={fuToday.length} label="Follow-ups due" href="/followups"
          meter={{ of: fuToday.length || 1, filled: fuDone }}
          sub={fuToday.length ? `${fuToday.length - fuDone} overdue` : "all clear"} />
      </div>

      {/* 4 — GROWTH */}
      <div style={sectionTitle}>Growth</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 20 }}>
        <MetricCard value={leads.length} label="Leads" href="/leads?view=all"
          meter={{ of: leads.length, filled: won }} sub={`${won} have converted`} />
        <MetricCard value={openLeads} label="In pipeline" href="/leads?view=open"
          meter={{ of: leads.length, filled: openLeads }}
          sub={openLeads ? `${openLeads} of ${leads.length} still open` : "nothing open"} />
        <MetricCard value={`${convRate}%`} label="Converted" href="/leads?view=won"
          meter={{ of: 100, filled: convRate }} sub={`${won} of ${leads.length} leads`} />
      </div>

      {/* 5 — SUPPORTING DETAIL */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ ...box, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>Staff utilisation</div>
            <span style={{ flex: 1 }} />
            {idle > 0 && <span style={{ background: "var(--amber-bg)", color: "#92400e", borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>{idle} idle</span>}
          </div>
          {util.length ? util.map((t) => {
            const load = t.done + t.upcoming;
            const pct = Math.min(100, load * 5);
            return (
              <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 12.5 }}>
                <span style={{ width: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                <div style={{ flex: 1, background: "#eef2f1", borderRadius: 6, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: load ? "var(--brand-fill)" : "transparent" }} />
                </div>
                <span style={{ color: "var(--muted)", minWidth: 96, textAlign: "right" }}>{t.done} done · {t.upcoming} booked</span>
              </div>
            );
          }) : <div style={{ color: "var(--muted)", fontSize: 13 }}>No trainers on record.</div>}
        </div>

        <div style={{ ...box, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>Today&apos;s schedule</div>
            <span style={{ flex: 1 }} />
            <Link href="/appointments" style={{ color: "var(--brand-text)", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>Calendar →</Link>
          </div>
          {schedule.length ? schedule.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderTop: i ? "1px solid var(--border)" : "none", fontSize: 12.5 }}>
              <span style={{ color: "var(--muted)", minWidth: 62 }}>{fmtHour(s.hour)}</span>
              <span style={{ background: "#eef2f1", color: "var(--muted)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 600 }}>{s.kind}</span>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {s.clientId ? <Link href={`/clients/${s.clientId}`} style={{ color: "inherit", textDecoration: "none", fontWeight: 600 }}>{s.who}</Link> : s.who}
              </span>
              <span style={{ color: "var(--muted)" }}>{s.with}</span>
            </div>
          )) : <div style={{ color: "var(--muted)", fontSize: 13 }}>Nothing on the calendar today.</div>}
        </div>
      </div>
    </div>
  );
}
