// Super Admin ("owner") home — answers "what needs my attention?" rather than
// "what happened". Money first, then an exception queue, then a light ops pulse,
// growth and governance. Day-to-day operations live on the Admin/Manager view.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/today";
import StatCard from "@/components/StatCard";
import AttentionPanel, { type Flag } from "@/components/AttentionPanel";

const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };

function addDays(iso: string, d: number) {
  const x = new Date(iso + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + d);
  return x.toISOString().slice(0, 10);
}

export default async function OwnerDashboard({ name }: { name: string }) {
  const supabase = createClient();
  const today = todayISO();
  const month = today.slice(0, 7);
  const in30 = addDays(today, 30);

  const [
    { data: clientData }, { data: pkgData }, { data: invData }, { data: sessData },
    { data: apptData }, { data: leadData }, { data: bloodData }, { data: bpData },
    { data: subData }, { data: auditData }, { data: attData }, { data: staffData },
  ] = await Promise.all([
    supabase.from("clients").select("id, code, name, phone, email, package_id, used, joined"),
    supabase.from("packages").select("id, name, price, sessions, validity, is_facility"),
    supabase.from("invoices").select("id, num, client_id, amount, status, issued_date, paid_date, description"),
    supabase.from("sessions").select("client_id, trainer_id, status, date"),
    supabase.from("appointments").select("id, date, status"),
    supabase.from("leads").select("id, stage"),
    supabase.from("blood_requests").select("client_id, submitted"),
    supabase.from("blueprints").select("client_id, generated"),
    supabase.from("subscriptions").select("id, client_id, amount, status, renews_on"),
    supabase.from("audit_log").select("actor_name, actor_role, action, target, created_at").order("created_at", { ascending: false }).limit(6),
    supabase.from("attendance").select("staff_id, status").eq("date", today),
    supabase.from("staff").select("id, name, is_trainer"),
  ]);

  const clients = (clientData ?? []) as { id: string; code: string | null; name: string; phone: string | null; email: string | null; package_id: string | null; used: number | null; joined: string | null }[];
  const pkgs = new Map(((pkgData ?? []) as { id: string; name: string; price: number; sessions: number; validity: number; is_facility: boolean }[]).map((p) => [p.id, p]));
  const invoices = (invData ?? []) as { id: string; num: number | null; client_id: string | null; amount: number; status: string; issued_date: string | null; paid_date: string | null; description: string | null }[];
  const sessions = (sessData ?? []) as { client_id: string; trainer_id: string | null; status: string; date: string }[];
  const appts = (apptData ?? []) as { id: string; date: string; status: string }[];
  const leads = (leadData ?? []) as { id: string; stage: string | null }[];
  const blood = new Map(((bloodData ?? []) as { client_id: string; submitted: boolean }[]).map((b) => [b.client_id, b]));
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
  const collectRate = billedTotal ? Math.round((paid.reduce((s, i) => s + Number(i.amount), 0) / billedTotal) * 100) : 0;

  // ---- exception queue ------------------------------------------------------
  const flags: Flag[] = [];
  const invByClient = new Map<string, number>();
  for (const i of invoices) if (i.client_id) invByClient.set(i.client_id, (invByClient.get(i.client_id) ?? 0) + 1);

  // 1. paid package but nothing invoiced = revenue leakage
  let leak = 0;
  for (const c of clients) {
    const p = c.package_id ? pkgs.get(c.package_id) : null;
    if (p && Number(p.price) > 0 && !invByClient.get(c.id)) {
      leak += Number(p.price);
      flags.push({ sev: "high", title: `${c.name} — no invoice raised`, detail: `${p.name} · ${money(Number(p.price))} never billed`, href: `/clients/${c.id}`, cta: "Raise invoice" });
    }
  }

  // 2. overdue invoices (issued 7+ days ago, still unpaid)
  for (const i of unpaid) {
    if (i.issued_date && i.issued_date <= addDays(today, -7)) {
      const c = clients.find((x) => x.id === i.client_id);
      flags.push({ sev: "high", title: `INV-${String(i.num ?? 0).padStart(3, "0")} overdue`, detail: `${c?.name ?? "—"} · ${money(Number(i.amount))} · issued ${i.issued_date}`, href: "/billing", cta: "Chase" });
    }
  }

  // 3. stalled onboarding — no package, or missing contact details
  for (const c of clients) {
    if (!c.package_id) flags.push({ sev: "med", title: `${c.name} — no package assigned`, detail: `Joined ${c.joined ?? "—"} · onboarding incomplete`, href: `/clients/${c.id}`, cta: "Complete" });
    else if (!c.phone && !c.email) flags.push({ sev: "low", title: `${c.name} — no contact details`, detail: "No phone or email on record", href: `/clients/${c.id}`, cta: "Add" });
  }

  // 4. BluePrint clients stuck in the flow
  for (const c of clients.filter((x) => x.package_id === "bp1")) {
    const b = blood.get(c.id);
    const bp = bps.get(c.id);
    if (!b) flags.push({ sev: "med", title: `${c.name} — blood report not requested`, detail: "BluePrint can't start until requested", href: "/blueprint", cta: "Request" });
    else if (!b.submitted) flags.push({ sev: "med", title: `${c.name} — blood report pending`, detail: "Requested, awaiting the client", href: "/blueprint", cta: "Follow up" });
    else if (!bp?.generated) flags.push({ sev: "med", title: `${c.name} — BluePrint not generated`, detail: "Needs the 3-discipline sign-off", href: "/blueprint", cta: "Review" });
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
      flags.push({ sev: "med", title: `${c.name} — no upcoming session booked`, detail: `${remaining} credit${remaining === 1 ? "" : "s"} left with nothing scheduled`, href: `/clients/${c.id}`, cta: "Book" });
    } else if (lastDone && lastDone < quietSince) {
      flags.push({ sev: "med", title: `${c.name} — gone quiet`, detail: `No completed session since ${lastDone}`, href: `/clients/${c.id}`, cta: "Reach out" });
    }
  }

  // 6. package expiring / expired with no active renewal
  const activeSubClients = new Set(subs.filter((s) => s.status === "active").map((s) => s.client_id));
  for (const c of clients) {
    const p = c.package_id ? pkgs.get(c.package_id) : null;
    if (!p || !p.validity || !c.joined || activeSubClients.has(c.id)) continue;
    const expires = addDays(c.joined, p.validity);
    if (expires < today) {
      flags.push({ sev: "high", title: `${c.name} — package expired`, detail: `${p.name} ended ${expires} · no renewal in place`, href: `/subscriptions`, cta: "Renew" });
    } else if (expires <= in30) {
      flags.push({ sev: "med", title: `${c.name} — package expiring`, detail: `${p.name} ends ${expires} · no renewal booked`, href: `/subscriptions`, cta: "Renew" });
    }
  }

  // 7. data integrity — session counter vs actual completed rows
  for (const c of clients) {
    const doneRows = sessions.filter((s) => s.client_id === c.id && s.status === "completed").length;
    const used = c.used ?? 0;
    const p = c.package_id ? pkgs.get(c.package_id) : null;
    if (p && !p.is_facility && used !== doneRows) {
      flags.push({ sev: "low", title: `${c.name} — session count mismatch`, detail: `Counter says ${used}, actual completed rows: ${doneRows}`, href: `/clients/${c.id}`, cta: "Reconcile" });
    }
  }

  const order = { high: 0, med: 1, low: 2 };
  flags.sort((a, b) => order[a.sev] - order[b.sev]);

  // ---- ops pulse / growth ---------------------------------------------------
  const sessToday = sessions.filter((s) => s.date === today);
  const apptsToday = appts.filter((a) => a.date === today && a.status === "scheduled");
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
        <StatCard label="Revenue this month" value={money(revenueMonth)} sub={`${paid.length} paid invoice${paid.length === 1 ? "" : "s"}`} minWidth={180} />
        <StatCard label="Outstanding" value={money(outstanding)} sub={`${unpaid.length} unpaid`} color={outstanding ? "var(--red)" : undefined} minWidth={170} />
        <StatCard label="Collection rate" value={`${collectRate}%`} sub="of everything billed" minWidth={160} />
        <StatCard label="Renewals ≤30 days" value={money(renewalValue)} sub={`${renewing.length} subscription${renewing.length === 1 ? "" : "s"}`} minWidth={180} />
        <StatCard label="Unbilled packages" value={money(leak)} sub="revenue not yet invoiced" color={leak ? "#b45309" : undefined} minWidth={180} />
      </div>

      {/* 2 — NEEDS ATTENTION (collapsed to a health score until clicked) */}
      <AttentionPanel flags={flags} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* 3 — OPS PULSE + GROWTH */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...box, padding: "14px 16px" }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>📊 Today</div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <div><div style={{ fontSize: 20, fontWeight: 800 }}>{sessToday.length}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>sessions</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 800 }}>{apptsToday.length}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>appointments</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 800 }}>{present}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>staff present</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 800 }}>{clients.length}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>clients</div></div>
            </div>
          </div>
          <div style={{ ...box, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>🏋 Staff utilisation</div>
              <span style={{ flex: 1 }} />
              {idle > 0 && <span style={{ background: "var(--amber-bg)", color: "#92400e", borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>{idle} idle</span>}
            </div>
            {util.length ? util.map((t) => {
              const load = t.done + t.upcoming;
              const pct = Math.min(100, load * 5); // ~20 sessions = a full bar
              return (
                <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 12.5 }}>
                  <span style={{ width: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                  <div style={{ flex: 1, background: "#eef2f1", borderRadius: 6, height: 8, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: load ? "var(--teal)" : "transparent" }} />
                  </div>
                  <span style={{ color: "var(--muted)", minWidth: 96, textAlign: "right" }}>{t.done} done · {t.upcoming} booked</span>
                </div>
              );
            }) : <div style={{ color: "var(--muted)", fontSize: 13 }}>No trainers on record.</div>}
          </div>

          <div style={{ ...box, padding: "14px 16px" }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>📈 Growth</div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <div><div style={{ fontSize: 20, fontWeight: 800 }}>{leads.length}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>leads</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 800 }}>{openLeads}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>in pipeline</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 800 }}>{convRate}%</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>converted</div></div>
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/leads" style={qa}>CRM & Leads</Link>
              <Link href="/targets" style={qa}>Sales Targets</Link>
              <Link href="/reports" style={qa}>Reports</Link>
            </div>
          </div>
        </div>

        {/* 5 — GOVERNANCE */}
        <div style={{ ...box, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>🛡 Control &amp; governance</div>
            <span style={{ flex: 1 }} />
            <Link href="/audit" style={{ color: "var(--teal-dark)", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>Full audit log →</Link>
          </div>
          {audit.length ? audit.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "7px 0", borderTop: i ? "1px solid var(--border)" : "none", fontSize: 12.5 }}>
              <span style={{ color: "var(--muted)", minWidth: 92 }}>{new Date(a.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
              <span style={{ flex: 1 }}><b>{a.action}</b>{a.target ? ` · ${a.target}` : ""}</span>
              <span style={{ color: "var(--muted)" }}>{a.actor_name ?? a.actor_role ?? "—"}</span>
            </div>
          )) : <div style={{ color: "var(--muted)", fontSize: 13 }}>No audit activity yet.</div>}
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/users" style={qa}>Users &amp; Roles</Link>
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
