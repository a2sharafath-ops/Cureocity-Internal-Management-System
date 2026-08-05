// Front-desk exceptions for the ops dashboard "Needs your attention" queue:
// the things front desk actually owns — money to raise/chase, blood reports to
// chase from clients, new intakes to complete, and overdue follow-ups.

import { createClient } from "@/lib/supabase/server";
import type { Flag } from "@/components/AttentionPanel";
import { dueOn, waitingSince, fmtDay, daysBetweenISO } from "@/lib/due";

const shift = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** Payment terms: 7 days from issue. */
const fmtISOPlus = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export async function frontDeskFlags(today: string): Promise<Flag[]> {
  const sb = createClient();
  const cut7 = shift(today, -7);
  const [{ data: cps }, { data: inv }, { data: clients }, { data: blood }, { data: tablet }, { data: fu }] = await Promise.all([
    sb.from("client_packages").select("client_id, package_name, price, status, start_date").eq("status", "active"),
    sb.from("invoices").select("client_id, num, amount, status, issued_date"),
    sb.from("clients").select("id, name"),
    sb.from("blood_requests").select("client_id, panel, submitted, requested_at"),
    sb.from("tablet_submissions").select("id, first_name, last_name, created_at").eq("status", "pending"),
    sb.from("followups").select("id, due_date, status, day, label").eq("status", "pending"),
  ]);

  const nameOf = (id: string | null) => (id && ((clients ?? []) as { id: string; name: string }[]).find((c) => c.id === id)?.name) || "Client";
  const hasInvoice = new Set(((inv ?? []) as { client_id: string | null }[]).map((i) => i.client_id).filter(Boolean) as string[]);

  // The client's assigned Health Coach — so a blood-report chase names the same
  // person the care-work queue does, instead of a generic "Health Coach".
  const { data: asg } = await sb.from("client_assignments").select("client_id, staff_id, staff:staff_id(name)").eq("discipline", "coach");
  const coachBy = new Map<string, { id: string; name: string }>();
  for (const a of (asg ?? []) as unknown as { client_id: string; staff_id: string | null; staff: { name: string } | null }[]) {
    if (a.staff_id) coachBy.set(a.client_id, { id: a.staff_id, name: a.staff?.name ?? "Health Coach" });
  }

  const flags: Flag[] = [];

  // ---- unbilled active packages (front desk raises the invoice) -------------
  const billed = new Set<string>();
  for (const cp of (cps ?? []) as { client_id: string; package_name: string | null; price: number | null; start_date: string | null }[]) {
    if (!cp.client_id || hasInvoice.has(cp.client_id) || billed.has(cp.client_id)) continue;
    billed.add(cp.client_id);
    flags.push({ sev: "high", title: `${nameOf(cp.client_id)} — no invoice raised`, detail: `${cp.package_name ?? "Package"} · ${money(Number(cp.price))}`, href: `/clients/${cp.client_id}`, cta: "View", raiseInvoiceClientId: cp.client_id,
      // A package sold a fortnight ago with no invoice is a different problem
      // from one sold this morning; the flag looked identical either way.
      ...waitingSince(cp.start_date, today, 3) });
  }

  // ---- overdue unpaid invoices ---------------------------------------------
  for (const i of (inv ?? []) as { client_id: string | null; num: number | null; amount: number; status: string; issued_date: string | null }[]) {
    if (i.status === "Paid") continue;
    if ((i.issued_date ?? "9999-12-31") <= cut7) flags.push({ sev: "high", title: `INV-${String(i.num ?? 0).padStart(3, "0")} unpaid`, detail: `${nameOf(i.client_id)} · ${money(Number(i.amount))}`, href: "/billing", cta: "View",
      // Payment terms are 7 days from issue, so that is the due date.
      ...dueOn(i.issued_date ? fmtISOPlus(i.issued_date, 7) : null, today), chaseRole: { roles: ["Finance", "Manager"], who: "Finance", label: `Chase payment · INV-${String(i.num ?? 0).padStart(3, "0")}`, clientId: i.client_id ?? undefined, href: "/billing" } });
  }

  // ---- blood report awaited from the client --------------------------------
  for (const b of (blood ?? []) as { client_id: string | null; panel: string | null; submitted: boolean; requested_at: string | null }[]) {
    if (b.submitted || !b.client_id) continue;
    const coach = coachBy.get(b.client_id);
    flags.push({
      sev: "med", title: `${nameOf(b.client_id)} — blood report awaited`,
      detail: `${b.panel === "comprehensive" ? "Comprehensive" : "BluePrint"} panel · ${coach ? `follow-up owed by ${coach.name}` : "chase the client"}`,
      href: `/clients/${b.client_id}`, cta: "View",
      ...waitingSince(b.requested_at, today),
      dedupeKey: `blood:${b.client_id}`,
      // Name the assigned coach when there is one; otherwise chase the role.
      nudge: coach ? { clientId: b.client_id, staffId: coach.id, label: "Blood report — awaiting client", who: coach.name } : undefined,
      chaseRole: coach ? undefined : { roles: ["Health Coach"], who: "Health Coach", label: "Blood report — awaiting client", clientId: b.client_id, href: `/clients/${b.client_id}` },
    });
  }

  // ---- new tablet intakes to complete --------------------------------------
  for (const t of (tablet ?? []) as { first_name: string; last_name: string | null; created_at: string | null }[]) {
    flags.push({ sev: "med", title: `New tablet intake — ${t.first_name} ${t.last_name ?? ""}`.trim(), detail: "Complete registration at front desk", href: "/intake", cta: "Complete",
      // Someone filled this in at the desk and walked away; a day is a lot.
      ...waitingSince(t.created_at?.slice(0, 10), today, 1) });
  }

  // ---- overdue follow-ups (one summary line) -------------------------------
  // The Day-2 diet chart explanation is the Health Coach's to schedule now, not
  // front desk's — exclude it so it isn't double-counted against ops.
  const isCoachOwned = (f: { day: number | null; label: string | null }) => f.day === 2 && /explanation/i.test(f.label ?? "");
  const late = ((fu ?? []) as { due_date: string; day: number | null; label: string | null }[])
    .filter((f) => f.due_date < today && !isCoachOwned(f));
  if (late.length) {
    // The oldest one is the honest headline: "12 overdue" hides whether that
    // is a busy Monday or a queue nobody has touched in three weeks.
    const oldest = late.reduce((a, b) => (a.due_date < b.due_date ? a : b)).due_date;
    flags.push({ sev: "high", title: `${late.length} overdue follow-up${late.length === 1 ? "" : "s"}`,
      detail: "Calls / bookings past due", href: "/followups", cta: "Open queue",
      dueLabel: `oldest ${fmtDay(oldest)} · ${daysBetweenISO(oldest, today)} days overdue`, overdue: true });
  }

  const order = { high: 0, med: 1, low: 2 };
  return flags.sort((a, b) => order[a.sev] - order[b.sev]);
}
