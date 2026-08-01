// Care-work exceptions for the dashboard "Needs your attention" queue: the
// Comprehensive / BluePrint deliverables and calendar milestones that are
// outstanding or overdue right now, across every active care client. Computed
// live from bulk reads (not the once-per-gate SLA ledger, which keeps fired
// events even after the work is done).

import { createClient } from "@/lib/supabase/server";
import type { Flag } from "@/components/AttentionPanel";
import { COMPREHENSIVE_CATEGORY, milestoneDates, cyclesFor } from "@/lib/comprehensive";
import { makeCatOf, milestoneBookHref, serviceForMilestone, milestoneSatisfied } from "@/lib/appt-match";
import { buildOwnerResolver, outstandingDeliverables, type AssignRow, type ApptOwnerRow } from "@/lib/obligations";

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

export async function careWorkFlags(today: string): Promise<Flag[]> {
  const sb = createClient();
  const [{ data: cps }, { data: clients }, { data: cons }, { data: charts }, { data: workouts }, { data: blood }, { data: bp }, { data: protos }, { data: appts }] = await Promise.all([
    sb.from("client_packages").select("client_id, category, start_date, end_date, status").eq("status", "active"),
    sb.from("clients").select("id, name"),
    sb.from("consultations").select("client_id, kind, status"),
    sb.from("diet_charts").select("client_id"),
    sb.from("client_workouts").select("client_id"),
    sb.from("blood_requests").select("client_id, panel, submitted"),
    sb.from("blueprints").select("client_id, generated"),
    sb.from("care_protocols").select("client_id, start_date, approved_at").eq("protocol", COMPREHENSIVE_CATEGORY).eq("status", "active"),
    sb.from("appointments").select("client_id, type, date, status, provider_id, staff:provider_id(name, role)").neq("status", "cancelled"),
  ]);

  // Who owns each clinician deliverable, so ops can nudge them from the dashboard.
  // Prefer the formal care-team assignment; fall back to the clinician who
  // actually ran the completed consult (the appointment provider). Shared with
  // the other obligation engines via buildOwnerResolver.
  const { data: asg } = await sb.from("client_assignments").select("client_id, discipline, staff_id, staff:staff_id(name)");
  const ownerFor = buildOwnerResolver(
    (asg ?? []) as unknown as AssignRow[],
    (appts ?? []) as unknown as ApptOwnerRow[],
  );
  // Service catalogue → category resolver + pre-filled Book links.
  const { data: svcData } = await sb.from("services").select("name, category, day_offset");
  const services = (svcData ?? []) as { name: string; category: string; day_offset: number | null }[];
  const catOf = makeCatOf(services);

  const name = new Map(((clients ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const catsBy = new Map<string, { category: string; start_date: string | null; end_date: string | null }[]>();
  for (const c of (cps ?? []) as { client_id: string; category: string; start_date: string | null; end_date: string | null }[]) {
    (catsBy.get(c.client_id) ?? catsBy.set(c.client_id, []).get(c.client_id)!).push(c);
  }
  const doneKinds = new Map<string, Set<string>>();
  for (const c of (cons ?? []) as { client_id: string; kind: string; status: string }[]) {
    if (c.status !== "completed") continue;
    (doneKinds.get(c.client_id) ?? doneKinds.set(c.client_id, new Set()).get(c.client_id)!).add(c.kind);
  }
  const hasChart = new Set(((charts ?? []) as { client_id: string }[]).map((r) => r.client_id));
  const hasWorkout = new Set(((workouts ?? []) as { client_id: string }[]).map((r) => r.client_id));
  const bloodBy = new Map<string, Map<string, boolean>>();
  for (const b of (blood ?? []) as { client_id: string; panel: string | null; submitted: boolean }[]) {
    (bloodBy.get(b.client_id) ?? bloodBy.set(b.client_id, new Map()).get(b.client_id)!).set(b.panel ?? "blueprint", b.submitted);
  }
  const bpGen = new Set(((bp ?? []) as { client_id: string; generated: boolean }[]).filter((r) => r.generated).map((r) => r.client_id));
  const protoBy = new Map(((protos ?? []) as { client_id: string; start_date: string | null; approved_at: string | null }[]).map((r) => [r.client_id, r]));
  const apptsBy = new Map<string, { type: string | null; date: string | null; status: string }[]>();
  for (const a of (appts ?? []) as { client_id: string; type: string | null; date: string | null; status: string }[]) {
    (apptsBy.get(a.client_id) ?? apptsBy.set(a.client_id, []).get(a.client_id)!).push(a);
  }

  const flags: Flag[] = [];
  for (const [clientId, rows] of catsBy) {
    const who = name.get(clientId) ?? "Client";
    const cats = new Set(rows.map((r) => r.category));
    const done = doneKinds.get(clientId) ?? new Set<string>();
    const clientHref = `/clients/${clientId}`;

    if (cats.has("comprehensive")) {
      const comp = rows.find((r) => r.category === "comprehensive");
      // Shared detection — same rules as the client-card package-status engine.
      const deliv = new Set(outstandingDeliverables({
        isComp: true, isPt: cats.has("training"),
        dietConsultDone: done.has("Diet"), trainerConsultDone: done.has("Trainer"),
        hasChart: hasChart.has(clientId), hasWorkout: hasWorkout.has(clientId),
        compBloodSubmitted: bloodBy.get(clientId)?.get("comprehensive") ?? null,
      }));
      if (deliv.has("compblood")) {
        // Chasing the client for the report is the Health Coach's job (they own
        // the client relationship for PT / Comprehensive). Nudge the assigned
        // coach; if none is assigned yet, chase the Health Coach role.
        const o = ownerFor(clientId, "coach");
        flags.push({ sev: "med", title: `${who} — comprehensive blood report pending`, detail: o ? `Follow-up owed by ${o.name}` : "Requested, awaiting the client", href: clientHref, cta: "View",
          dedupeKey: `blood:${clientId}`,
          nudge: o ? { clientId, staffId: o.id, label: "Blood report — awaiting client", who: o.name } : undefined,
          chaseRole: o ? undefined : { roles: ["Health Coach"], who: "Health Coach", label: "Blood report — awaiting client", clientId, href: clientHref } });
      }
      if (deliv.has("dietchart")) {
        const o = ownerFor(clientId, "dietitian");
        flags.push({ sev: "med", title: `${who} — diet chart not drafted`, detail: o ? `Owed by ${o.name}` : "Owed after the diet consult", href: clientHref, cta: "View",
          nudge: o ? { clientId, staffId: o.id, label: "Diet chart — not drafted", who: o.name } : undefined,
          chaseRole: o ? undefined : { roles: ["Dietitian"], who: "the dietitian", label: "Diet chart — not drafted", clientId, href: clientHref } });
      }
      if (deliv.has("workout")) {
        const o = ownerFor(clientId, "trainer");
        flags.push({ sev: "med", title: `${who} — workout plan not created`, detail: o ? `Owed by ${o.name}` : "Owed after the fitness assessment", href: clientHref, cta: "View",
          nudge: o ? { clientId, staffId: o.id, label: "Workout plan — not created", who: o.name } : undefined,
          chaseRole: o ? undefined : { roles: ["Fitness Trainer"], who: "the trainer", label: "Workout plan — not created", clientId, href: clientHref } });
      }
      // Overdue calendar milestones (bookings that never got made).
      const start = protoBy.get(clientId)?.start_date ?? comp?.start_date ?? null;
      if (start) {
        const span = comp?.end_date ? Math.max(28, daysBetween(start, comp.end_date)) : 28;
        for (const m of milestoneDates(start, cyclesFor(span))) {
          if (today <= m.dueDate) continue;
          const svc = serviceForMilestone(m.apptType, m.from, services);
          const satisfied = milestoneSatisfied(apptsBy.get(clientId) ?? [], { category: m.apptType, fromDate: m.fromDate, service: svc, catOf });
          if (!satisfied) {
            const bookHref = milestoneBookHref(clientId, m.apptType, m.from, services);
            flags.push({ sev: "high", title: `${who} — ${m.label.toLowerCase()} overdue`, detail: `Was due ${fmt(m.dueDate)}`, href: bookHref, cta: "Book",
              chaseRole: { roles: ["Front Desk"], who: "Front Desk", label: `Book ${m.label}`, clientId, href: bookHref } });
          }
        }
      }
    }

    if (cats.has("blueprint") && !bpGen.has(clientId)) {
      const bpBlood = bloodBy.get(clientId)?.get("blueprint");
      if (bpBlood) flags.push({ sev: "med", title: `${who} — BluePrint not generated`, detail: "Blood in · awaiting clinician sign-offs", href: "/blueprint", cta: "Review",
        chaseRole: { roles: ["Doctor", "Dietitian", "Fitness Trainer"], who: "clinicians", label: "BluePrint sign-off", clientId, href: "/blueprint" } });
    }
  }
  return flags;
}
