import { IST } from "@/lib/datetime";
// Super Admin ("owner") home — answers "what needs my attention?" rather than
// "what happened". Money first, then an exception queue, then a light ops pulse,
// growth and governance. Day-to-day operations live on the Admin/Manager view.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/today";
import MetricCard from "@/components/MetricCard";
import { monthTrend, prevMonthKey, sumInMonth } from "@/lib/trend";
import AttentionPanel, { type Flag } from "@/components/AttentionPanel";
import { withChaseHistory } from "@/lib/chase-log";
import { packageCategory } from "@/lib/packages";
import { careWorkFlags } from "@/lib/care-attention";
import TodayAgenda from "@/components/TodayAgenda";
import { todayAgenda } from "@/lib/today-agenda";

const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };

function addDays(iso: string, d: number) {
  const x = new Date(iso + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + d);
  return x.toISOString().slice(0, 10);
}

export default async function OwnerDashboard({ name }: { name: string }) {
  const supabase = await createClient();
  const today = todayISO();
  const month = today.slice(0, 7);
  const in30 = addDays(today, 30);
  const agenda = await todayAgenda(today);

  const [
    { data: clientData }, { data: pkgData }, { data: invData }, { data: sessData },
    { data: apptData }, { data: leadData }, { data: bloodData }, { data: bpData },
    { data: subData }, { data: auditData }, { data: attData }, { data: staffData },
    { data: cpData }, { data: caData },
  ] = await Promise.all([
    supabase.from("clients").select("id, code, name, phone, email, package_id, used, joined"),
    supabase.from("packages").select("id, name, price, sessions, validity, is_facility"),
    supabase.from("invoices").select("id, num, client_id, amount, status, issued_date, paid_date, description"),
    supabase.from("sessions").select("client_id, trainer_id, status, date"),
    supabase.from("appointments").select("id, date, status"),
    supabase.from("leads").select("id, stage"),
    supabase.from("blood_requests").select("client_id, panel, submitted"),
    supabase.from("blueprints").select("client_id, generated"),
    supabase.from("subscriptions").select("id, client_id, amount, status, renews_on"),
    supabase.from("audit_log").select("actor_name, actor_role, action, target, created_at").order("created_at", { ascending: false }).limit(6),
    supabase.from("attendance").select("staff_id, status").eq("date", today),
    supabase.from("staff").select("id, name, is_trainer"),
    supabase.from("client_packages").select("client_id, package_name, category, start_date, end_date, status").eq("status", "active"),
    supabase.from("client_assignments").select("client_id, staff_id, staff:staff_id(name)").eq("discipline", "trainer"),
  ]);
  // Assigned trainer per client — the primary owner to chase for a session count drift.
  const trainerBy = new Map<string, { id: string; name: string }>();
  for (const a of (caData ?? []) as unknown as { client_id: string; staff_id: string | null; staff: { name: string } | null }[]) {
    if (a.staff_id) trainerBy.set(a.client_id, { id: a.staff_id, name: a.staff?.name ?? "trainer" });
  }

  const clients = (clientData ?? []) as { id: string; code: string | null; name: string; phone: string | null; email: string | null; package_id: string | null; used: number | null; joined: string | null }[];
  const pkgs = new Map(((pkgData ?? []) as { id: string; name: string; price: number; sessions: number; validity: number; is_facility: boolean }[]).map((p) => [p.id, p]));
  const invoices = (invData ?? []) as { id: string; num: number | null; client_id: string | null; amount: number; status: string; issued_date: string | null; paid_date: string | null; description: string | null }[];
  const sessions = (sessData ?? []) as { client_id: string; trainer_id: string | null; status: string; date: string }[];
  const appts = (apptData ?? []) as { id: string; date: string; status: string }[];
  const leads = (leadData ?? []) as { id: string; stage: string | null }[];
  // Key by client + panel: a client can hold several blood panels (a BluePrint
  // one and a Comprehensive one), and collapsing them by client id alone let the
  // wrong panel's status win — e.g. a submitted BluePrint report showing pending
  // because an unsubmitted Comprehensive panel overwrote it.
  const blood = new Map(((bloodData ?? []) as { client_id: string; panel: string | null; submitted: boolean }[]).map((b) => [`${b.client_id}|${b.panel ?? "blueprint"}`, b]));
  const bps = new Map(((bpData ?? []) as { client_id: string; generated: boolean }[]).map((b) => [b.client_id, b]));
  const subs = (subData ?? []) as { id: string; client_id: string; amount: number; status: string; renews_on: string | null }[];
  const audit = (auditData ?? []) as { actor_name: string | null; actor_role: string | null; action: string; target: string | null; created_at: string }[];
  const attendance = (attData ?? []) as { staff_id: string; status: string }[];
  const staff = (staffData ?? []) as { id: string; name: string; is_trainer: boolean }[];

  // ---- money ----------------------------------------------------------------
  const paid = invoices.filter((i) => i.status === "Paid");
  const revenueMonth = paid.filter((i) => (i.paid_date ?? "").startsWith(month)).reduce((s, i) => s + Number(i.amount), 0);
  const unpaid = invoices.filter((i) => i.status === "Unpaid");
  const outstanding = unpaid.reduce((s, i) => s + Number(i.amount), 0);
  const renewing = subs.filter((s) => s.status === "active" && s.renews_on && s.renews_on <= in30);
  const renewalValue = renewing.reduce((s, x) => s + Number(x.amount), 0);
  const billedTotal = invoices.reduce((s, i) => s + Number(i.amount), 0);
  // invoices is fetched unfiltered with both dates, so last month costs nothing
  const lastMonth = prevMonthKey(month);
  const revenuePrev = sumInMonth(paid, lastMonth, (i) => i.paid_date, (i) => Number(i.amount));
  const outstandingPrev = sumInMonth(unpaid, lastMonth, (i) => i.issued_date, (i) => Number(i.amount));
  const collectRate = billedTotal ? Math.round((paid.reduce((s, i) => s + Number(i.amount), 0) / billedTotal) * 100) : 0;

  // ---- exception queue ------------------------------------------------------
  const flags: Flag[] = [];

  // ---- awaiting the Medical Director's sign-off --------------------------
  // Diet plans, charts and assessment summaries all stop at one approval, and
  // that approval is the Medical Director's alone (canReviewDietChart). The
  // owner cannot clear this queue — so it appears here as oversight, chasing
  // the director rather than offering a Review button that would refuse.
  //
  // If nobody holds the role, the queue cannot move at all. That is a blocking
  // fact about the clinic, not a document-level one, so it is raised once and
  // loudly instead of being repeated per waiting document.
  const REVIEW_HREF = "/workspace?role=diet&tab=charts";
  const [{ data: revPlans }, { data: revAssess }, { data: directors }] = await Promise.all([
    supabase.from("diet_plans").select("id, clients(name)").eq("status", "in_review"),
    supabase.from("diet_assessments").select("id, clients(name)").eq("status", "in_review"),
    supabase.from("profiles").select("id").eq("role", "Medical Director").limit(1),
  ]);
  const reviewQueue: [string, { clients: { name: string } | null }[]][] = [
    ["Diet plan", (revPlans ?? []) as never],
    ["Assessment summary", (revAssess ?? []) as never],
  ];
  const waiting = reviewQueue.reduce((n, [, rows]) => n + rows.length, 0);
  const noDirector = !(directors ?? []).length;

  if (noDirector) {
    flags.push({
      sev: "high",
      title: "No Medical Director assigned",
      detail: waiting
        ? `${waiting} clinical document${waiting === 1 ? "" : "s"} cannot be approved until someone holds the role — nothing reaches those clients meanwhile`
        : "Diet plans, charts and assessment summaries can only be approved by a Medical Director",
      href: "/users", cta: "Assign",
    });
  }

  for (const [label, rows] of reviewQueue) {
    for (const r of rows) {
      flags.push({
        sev: "med",
        title: `${r.clients?.name ?? "A client"} — ${label.toLowerCase()} awaiting approval`,
        detail: "Submitted by the dietitian · nothing reaches the client until the Medical Director publishes it",
        href: REVIEW_HREF, cta: "View",
        ...(noDirector ? {} : {
          chaseRole: {
            roles: ["Medical Director"], who: "Medical Director",
            label: `Approve ${label.toLowerCase()} — ${r.clients?.name ?? "client"}`,
            href: REVIEW_HREF,
          },
        }),
      });
    }
  }

  const invByClient = new Map<string, number>();
  for (const i of invoices) if (i.client_id) invByClient.set(i.client_id, (invByClient.get(i.client_id) ?? 0) + 1);

  // 1. paid package but nothing invoiced = revenue leakage
  let leak = 0;
  for (const c of clients) {
    const p = c.package_id ? pkgs.get(c.package_id) : null;
    if (p && Number(p.price) > 0 && !invByClient.get(c.id)) {
      leak += Number(p.price);
      flags.push({ sev: "high", title: `${c.name} — no invoice raised`, detail: `${p.name} · ${money(Number(p.price))} never billed`, href: `/clients/${c.id}`, cta: "View", raiseInvoiceClientId: c.id });
    }
  }

  // 2. overdue invoices (issued 7+ days ago, still unpaid)
  for (const i of unpaid) {
    if (i.issued_date && i.issued_date <= addDays(today, -7)) {
      const c = clients.find((x) => x.id === i.client_id);
      flags.push({ sev: "high", title: `INV-${String(i.num ?? 0).padStart(3, "0")} overdue`, detail: `${c?.name ?? "—"} · ${money(Number(i.amount))} · issued ${i.issued_date}`, href: "/billing", cta: "View", chaseRole: { roles: ["Front Desk", "Finance"], who: "Front Desk", label: `Chase payment · INV-${String(i.num ?? 0).padStart(3, "0")}`, clientId: i.client_id ?? undefined, href: "/billing" } });
    }
  }

  // 3. stalled onboarding — no package, or missing contact details
  for (const c of clients) {
    if (!c.package_id) flags.push({ sev: "med", title: `${c.name} — no package assigned`, detail: `Joined ${c.joined ?? "—"} · onboarding incomplete`, href: `/clients/${c.id}`, cta: "View", chaseRole: { roles: ["Front Desk"], who: "Front Desk", label: "Complete onboarding — assign a package", clientId: c.id, href: `/clients/${c.id}` } });
    else if (!c.phone && !c.email) flags.push({ sev: "low", title: `${c.name} — no contact details`, detail: "No phone or email on record", href: `/clients/${c.id}`, cta: "View", chaseRole: { roles: ["Front Desk"], who: "Front Desk", label: "Add missing contact details", clientId: c.id, href: `/clients/${c.id}` } });
  }

  // 4. BluePrint clients stuck in the flow
  for (const c of clients.filter((x) => x.package_id === "bp1")) {
    const b = blood.get(`${c.id}|blueprint`);
    const bp = bps.get(c.id);
    if (!b) flags.push({ sev: "med", title: `${c.name} — blood report not requested`, detail: "BluePrint can't start until requested", href: "/blueprint", cta: "View", chaseRole: { roles: ["Front Desk", "Doctor"], who: "Front Desk", label: "Request BluePrint blood", clientId: c.id, href: "/blueprint" } });
    else if (!b.submitted) flags.push({ sev: "med", title: `${c.name} — blood report pending`, detail: "Requested, awaiting the client", href: "/blueprint", cta: "View", chaseRole: { roles: ["Health Coach"], who: "Health Coach", label: "Chase blood report", clientId: c.id, href: "/blueprint" } });
    else if (!bp?.generated) flags.push({ sev: "med", title: `${c.name} — BluePrint not generated`, detail: "Needs the 3-discipline sign-off", href: "/blueprint", cta: "Review", chaseRole: { roles: ["Doctor", "Dietitian", "Fitness Trainer"], who: "Health Professionals", label: "BluePrint sign-off", clientId: c.id, href: "/blueprint" } });
  }

  // 5. churn signals — credits left but nothing on the calendar, or gone quiet
  const quietSince = addDays(today, -21);
  for (const c of clients) {
    const p = c.package_id ? pkgs.get(c.package_id) : null;
    if (!p || p.is_facility || !p.sessions) continue;
    const remaining = p.sessions - (c.used ?? 0);
    if (remaining <= 0) continue;
    const mine = sessions.filter((s) => s.client_id === c.id);
    const upcoming = mine.filter((s) => s.status === "scheduled" && s.date >= today);
    const lastDone = mine.filter((s) => s.status === "completed").map((s) => s.date).sort().pop();
    if (upcoming.length === 0) {
      flags.push({ sev: "med", title: `${c.name} — no upcoming session booked`, detail: `${remaining} credit${remaining === 1 ? "" : "s"} left with nothing scheduled`, href: `/sessions?client=${c.id}`, cta: "Book", chaseRole: { roles: ["Front Desk"], who: "Front Desk", label: "Book next session", clientId: c.id, href: `/sessions?client=${c.id}` } });
    } else if (lastDone && lastDone < quietSince) {
      flags.push({ sev: "med", title: `${c.name} — gone quiet`, detail: `No completed session since ${lastDone}`, href: `/clients/${c.id}`, cta: "View", chaseRole: { roles: ["Fitness Trainer", "Health Coach"], who: "Health Coach", label: "Re-engage — client gone quiet", clientId: c.id, href: `/clients/${c.id}` } });
    }
  }

  // 6. package expiring / expired with no active renewal — read the real
  //    client_packages rows (the source of truth), not the legacy single
  //    clients.package_id, so a removed/void package never nags and the actual
  //    active package is the one that's checked.
  const activeSubClients = new Set(subs.filter((s) => s.status === "active").map((s) => s.client_id));
  const nameById = new Map(clients.map((c) => [c.id, c.name]));
  // BluePrint is a one-time report — never nag to renew it.
  const RENEWABLE_FLAG = new Set(["membership", "training", "comprehensive"]);
  const activeCps = ((cpData ?? []) as { client_id: string; package_name: string | null; category: string; start_date: string | null; end_date: string | null; status: string }[])
    .filter((cp) => RENEWABLE_FLAG.has(cp.category) && cp.end_date);
  const daysApart = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
  for (const cp of activeCps) {
    if (activeSubClients.has(cp.client_id)) continue;
    // If a later-ending package of the same category is already in place, the
    // client has effectively renewed — don't flag the earlier one.
    const laterExists = activeCps.some((o) => o.client_id === cp.client_id && o.category === cp.category && (o.end_date ?? "") > (cp.end_date ?? ""));
    if (laterExists) continue;
    const nm = nameById.get(cp.client_id) ?? "A client";
    const label = cp.package_name ?? cp.category;
    const end = cp.end_date as string;
    if (end < today) {
      flags.push({ sev: "high", title: `${nm} — package expired`, detail: `${label} ended ${end} · no renewal in place`, href: `/clients/${cp.client_id}`, cta: "Renew", chaseRole: { roles: ["Front Desk"], who: "Front Desk", label: "Book renewal — package expired", clientId: cp.client_id, href: `/clients/${cp.client_id}` } });
      continue;
    }
    // "Expiring soon" window is proportional: never wider than the package's own
    // term, so a 4-week package doesn't trip the alert the day it's sold. Warn in
    // the back half of the term, capped at 30 days for long memberships.
    const term = cp.start_date ? Math.max(1, daysApart(cp.start_date, end)) : 30;
    const window = Math.min(30, Math.ceil(term / 2));
    if (daysApart(today, end) <= window) {
      flags.push({ sev: "med", title: `${nm} — package expiring`, detail: `${label} ends ${end} · no renewal booked`, href: `/clients/${cp.client_id}`, cta: "Renew", chaseRole: { roles: ["Front Desk"], who: "Front Desk", label: "Book renewal — package expiring", clientId: cp.client_id, href: `/clients/${cp.client_id}` } });
    }
  }

  // 7. data integrity — session counter vs actual completed rows
  for (const c of clients) {
    const doneRows = sessions.filter((s) => s.client_id === c.id && s.status === "completed").length;
    const used = c.used ?? 0;
    const p = c.package_id ? pkgs.get(c.package_id) : null;
    if (p && !p.is_facility && used !== doneRows) {
      // The trainer marks sessions, so they're the primary owner; fall back to
      // Front Desk (check-ins) then Manager (oversight) when none is assigned.
      const t = trainerBy.get(c.id);
      flags.push({ sev: "low", title: `${c.name} — session count mismatch`, detail: `Counter says ${used}, actual completed rows: ${doneRows}`, href: `/clients/${c.id}`, cta: "Reconcile",
        nudge: t ? { clientId: c.id, staffId: t.id, label: "Reconcile session count", who: t.name } : undefined,
        chaseRole: t ? undefined : { roles: ["Fitness Trainer", "Front Desk", "Manager"], who: "Fitness Trainer", label: "Reconcile session count", clientId: c.id, href: `/clients/${c.id}` } });
    }
  }

  flags.push(...await careWorkFlags(today));
  const order = { high: 0, med: 1, low: 2 };
  flags.sort((a, b) => order[a.sev] - order[b.sev]);

  // ---- ops pulse / growth ---------------------------------------------------
  const sessToday = sessions.filter((s) => s.date === today);
  const sessDone = sessToday.filter((s) => s.status === "completed").length;
  const apptsAll = appts.filter((a) => a.date === today);
  const apptsToday = apptsAll.filter((a) => a.status === "scheduled");
  const withPackage = clients.filter((c) => c.package_id).length;
  const present = attendance.filter((a) => a.status === "present" || a.status === "Present").length;
  const openLeads = leads.filter((l) => !(l.stage ?? "").startsWith("5") && (l.stage ?? "") !== "LOST").length;
  const won = leads.filter((l) => (l.stage ?? "").startsWith("5")).length;
  const convRate = leads.length ? Math.round((won / leads.length) * 100) : 0;

  // staff utilisation — completed this month vs what's still on the calendar
  const util = staff.filter((s) => s.is_trainer).map((t) => {
    const mine = sessions.filter((s) => s.trainer_id === t.id);
    return {
      name: t.name,
      done: mine.filter((s) => s.status === "completed" && s.date.startsWith(month)).length,
      upcoming: mine.filter((s) => s.status === "scheduled" && s.date >= today).length,
    };
  }).sort((a, b) => (b.done + b.upcoming) - (a.done + a.upcoming));
  const idle = util.filter((t) => t.done + t.upcoming === 0).length;

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 21, margin: "0 0 2px" }}>Welcome back, {name.split(" ")[0]}</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>Owner view — money, exceptions and control. Day-to-day operations sit with your Managers.</p>
      </div>

      {/* 1 — MONEY */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".6px", color: "var(--muted)", textTransform: "uppercase", margin: "0 0 8px" }}>Money</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <MetricCard label="Revenue this month" value={money(revenueMonth)} sub={`${paid.length} paid invoice${paid.length === 1 ? "" : "s"}`} trend={monthTrend(revenueMonth, revenuePrev, "revenue_month")} minWidth={180} href="/billing?status=paid" />
        <MetricCard label="Outstanding" value={money(outstanding)} sub={`${unpaid.length} unpaid`} trend={monthTrend(outstanding, outstandingPrev, "outstanding")} color={outstanding ? "var(--red)" : undefined} minWidth={170} href="/billing?tab=dunning" />
        <MetricCard label="Collection rate" value={`${collectRate}%`} sub="of everything billed" minWidth={160} href="/billing" />
        <MetricCard label="Renewals ≤30 days" value={money(renewalValue)} sub={`${renewing.length} subscription${renewing.length === 1 ? "" : "s"}`} minWidth={180} href="/subscriptions" />
        <MetricCard label="Unbilled packages" value={money(leak)} sub="revenue not yet invoiced" color={leak ? "var(--amber-text-soft)" : undefined} minWidth={180} href="/billing?tab=unbilled" />
      </div>

      {/* 2 — NEEDS ATTENTION (collapsed to a health score until clicked) */}
      <AttentionPanel flags={await withChaseHistory(flags)} viewerRole="Super Admin" />

      {/* 3 — TODAY. Full width: this is the second thing an owner looks at. */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".6px", color: "var(--muted)", textTransform: "uppercase", margin: "0 0 8px" }}>Today</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 20 }}>
        <MetricCard value={sessToday.length} label="Sessions" href="/sessions"
          meter={{ of: sessToday.length, filled: sessDone }}
          sub={sessToday.length ? `${sessDone} of ${sessToday.length} completed` : "none scheduled"} />
        <MetricCard value={apptsToday.length} label="Appointments" href="/appointments"
          meter={{ of: apptsAll.length, filled: apptsToday.length }}
          sub={apptsAll.length ? `${apptsToday.length} of ${apptsAll.length} still to run` : "none booked"} />
        {/* No attendance rows for today means nobody has marked it yet, which
            is not the same fact as nobody turning up. Show `—` and say so,
            rather than a 0 that reads as an empty centre. */}
        <MetricCard value={attendance.length ? present : "—"} label="Staff present" href="/hr?tab=attendance"
          meter={{ of: staff.length, filled: attendance.length ? present : 0 }}
          sub={attendance.length ? `of ${staff.length} on the team` : "not marked yet today"} />
        <MetricCard value={clients.length} label="Clients" href="/clients"
          meter={{ of: clients.length, filled: withPackage }}
          sub={`${withPackage} of ${clients.length} on a package`} />
      </div>

      {/* Itemised agenda under the stat cards — every appointment, session,
          follow-up (incl. the Day-2 diet chart explanation) and care deadline
          due today, with Done/Pending and a Mark-done on sessions. */}
      <div style={{ marginBottom: 20 }}>
        <TodayAgenda agenda={agenda} dateLabel={new Date(today + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" })} />
      </div>

      {/* 4 — GROWTH. Also full width, directly under Today. */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".6px", color: "var(--muted)", textTransform: "uppercase", margin: "0 0 8px" }}>Growth</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 20 }}>
        <MetricCard value={leads.length} label="Leads" href="/leads?view=all"
          meter={{ of: leads.length, filled: won }}
          sub={`${won} have converted`} />
        <MetricCard value={openLeads} label="In pipeline" href="/leads?view=open"
          meter={{ of: leads.length, filled: openLeads }}
          sub={openLeads ? `${openLeads} of ${leads.length} still open` : "nothing open"} />
        <MetricCard value={`${convRate}%`} label="Converted" href="/leads?view=won"
          meter={{ of: 100, filled: convRate }}
          sub={`${won} of ${leads.length} leads`} />
      </div>

      {/* 5 — SUPPORTING DETAIL, below the fold. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ ...box, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>Staff utilisation</div>
            <span style={{ flex: 1 }} />
            {idle > 0 && <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>{idle} idle</span>}
          </div>
          {util.length ? util.map((t) => {
            const load = t.done + t.upcoming;
            const pct = Math.min(100, load * 5); // ~20 sessions = a full bar
            return (
              <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 12.5 }}>
                <span style={{ width: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                <div style={{ flex: 1, background: "var(--neutral-bg)", borderRadius: 6, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: load ? "var(--brand-fill)" : "transparent" }} />
                </div>
                <span style={{ color: "var(--muted)", minWidth: 96, textAlign: "right" }}>{t.done} done · {t.upcoming} booked</span>
              </div>
            );
          }) : <div style={{ color: "var(--muted)", fontSize: 13 }}>No trainers on record.</div>}
        </div>

        <div style={{ ...box, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>Control &amp; governance</div>
            <span style={{ flex: 1 }} />
            <Link href="/audit" style={{ color: "var(--brand-text)", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>Full audit log →</Link>
          </div>
          {audit.length ? audit.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "7px 0", borderTop: i ? "1px solid var(--border)" : "none", fontSize: 12.5 }}>
              <span style={{ color: "var(--muted)", minWidth: 92 }}>{new Date(a.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: IST })}</span>
              <span style={{ flex: 1 }}><b>{a.action}</b>{a.target ? ` · ${a.target}` : ""}</span>
              <span style={{ color: "var(--muted)" }}>{a.actor_name ?? a.actor_role ?? "—"}</span>
            </div>
          )) : <div style={{ color: "var(--muted)", fontSize: 13 }}>No audit activity yet.</div>}
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/users" style={qa}>Users &amp; roles</Link>
            <Link href="/packages" style={qa}>Packages</Link>
            <Link href="/services" style={qa}>Services</Link>
            <Link href="/compliance" style={qa}>Governance</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const qa: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, textDecoration: "none", color: "var(--ink)" };
