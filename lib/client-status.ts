// One source of truth for "where is this client right now, and what's the next
// action" — so the same status shows wherever a client appears. Role-aware: a
// clinician sees their own discipline's state for the client; ops roles see the
// overall onboarding / membership state.

import { onboardingRow, type ClientInput } from "@/lib/onboarding";
import { packageCategory } from "@/lib/packages";
import { disciplineLabel } from "@/lib/disciplines";
import { BOOKING_DUE_DAYS } from "@/lib/comprehensive";
import { addDaysISO } from "@/lib/pt";

export type StatusTone = "neutral" | "info" | "warn" | "good" | "action";
export type ClientStatus = { label: string; tone: StatusTone; href?: string };

type DiscState = {
  booked: boolean;
  completed: boolean;
  /** "Fri 11am" — for display. */
  when: string | null;
  /** The booking's calendar date, so "booked" can become "missed". */
  date: string | null;
  /** When the protocol says this consult should have happened by. */
  dueDate: string | null;
};
export type StatusInput = {
  category: string;                 // blueprint | comprehensive | training | membership | other
  membershipActive: boolean;
  frozen: boolean;
  onboardComplete: boolean;
  onboardNext: string | null;
  bloodRequested: boolean;
  bloodSubmitted: boolean;
  consults: Record<string, DiscState>;  // keys: doctor | dietitian | trainer | coach | psychologist
  journeySteps: { label: string; done: boolean }[];  // package-aware onboarding ladder
  /** Today, IST — so a badge can tell "booked" from "missed" without a clock. */
  today: string;
};

const ROLE_DISC: Record<string, string> = {
  Doctor: "doctor", Dietitian: "dietitian", "Fitness Trainer": "trainer",
  "Health Coach": "coach", Psychologist: "psychologist",
};
/** The discipline a staff role works in, or null for non-clinical (ops) roles. */
export function disciplineForRole(role: string | null | undefined): string | null {
  return role ? (ROLE_DISC[role] ?? null) : null;
}


/** The single status to show for a client, from the viewer's perspective. */
export function clientStatus(i: StatusInput | undefined, viewerDiscipline: string | null): ClientStatus {
  if (!i) return { label: "—", tone: "neutral" };

  // Clinician: this client's state for the viewer's own discipline.
  //
  // Six states, not three. The badge used to say "Ready to start · Fri 11am"
  // for any booking at all — which was wrong twice over. It read as "go now"
  // when the appointment was a fortnight away, and it went on saying it for
  // ever once the day passed and nobody held the consult. A no-show looked
  // identical to an upcoming appointment.
  //
  // "Ready to start" now means what it says: it is today.
  if (viewerDiscipline) {
    const c = i.consults[viewerDiscipline];
    if (!c) return { label: "—", tone: "neutral" };
    const label = disciplineLabel(viewerDiscipline);

    if (c.completed) return { label: `${label} consult done`, tone: "good" };

    if (c.booked) {
      // Undated booking (a consultation row with no appointment): all we can
      // honestly say is that it is booked.
      if (!c.date) return { label: "Booked", tone: "info", href: "/pro" };
      if (c.date === i.today) {
        return { label: c.when ? `Ready to start · ${c.when.split(" ").slice(1).join(" ")}` : "Ready to start", tone: "action", href: "/pro" };
      }
      if (c.date < i.today) {
        // Booked, the day came and went, still not completed.
        return { label: `Missed · was ${fmtDay(c.date)}`, tone: "warn", href: "/pro" };
      }
      return { label: `Booked · ${fmtDay(c.date)}${c.when ? `, ${c.when.split(" ").slice(1).join(" ")}` : ""}`, tone: "info", href: "/pro" };
    }

    // Nothing booked. Say whether that is already late.
    if (c.dueDate && c.dueDate < i.today) {
      return { label: `Overdue · due ${fmtDay(c.dueDate)}`, tone: "warn", href: "/pro" };
    }
    if ((viewerDiscipline === "doctor" || viewerDiscipline === "dietitian") && i.bloodRequested && !i.bloodSubmitted)
      return { label: "Awaiting blood report", tone: "warn" };
    return { label: c.dueDate ? `Awaiting booking · due ${fmtDay(c.dueDate)}` : "Awaiting booking", tone: "neutral" };
  }

  // Ops: overall onboarding / membership state.
  if (i.category === "membership") {
    if (i.frozen) return { label: "Paused", tone: "warn" };
    return i.membershipActive ? { label: "Membership active", tone: "good" } : { label: "Membership lapsed", tone: "warn" };
  }
  if (i.category === "other") return { label: i.frozen ? "Paused" : "—", tone: i.frozen ? "warn" : "neutral" };
  if (i.onboardComplete) return { label: "Onboarded", tone: "good" };
  return { label: i.onboardNext ?? "In progress", tone: "action", href: "/onboarding" };
}

// ---- bulk data loader ------------------------------------------------------

type Sb = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
const KIND_OF_DISC: Record<string, string> = { doctor: "Doctor", dietitian: "Diet", trainer: "Trainer", coach: "Coach", psychologist: "Psychologist" };
const ROLE_OF_DISC: Record<string, string> = { doctor: "Doctor", dietitian: "Dietitian", trainer: "Fitness Trainer", coach: "Health Coach", psychologist: "Psychologist" };
const PRIORITY = ["blueprint", "comprehensive", "training", "membership"];
const DISCS = ["doctor", "dietitian", "trainer", "coach", "psychologist"];

/** "8 Aug" — short, unambiguous, and never a bare weekday. "Fri" alone was the
 *  original sin here: it could mean tomorrow or three weeks out. */
function fmtDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    : iso;
}

function whenLabel(date: string, hour: number): string {
  const d = new Date(date + "T00:00:00Z");
  const day = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  const am = hour < 12, hr = hour % 12 === 0 ? 12 : hour % 12;
  return `${day} ${hr}${am ? "am" : "pm"}`;
}

/** Load status inputs for a set of clients in bulk (one query per table). */
export async function loadClientStatuses(supabase: Sb, clientIds: string[], todayISO: string): Promise<Map<string, StatusInput>> {
  const out = new Map<string, StatusInput>();
  const ids = Array.from(new Set(clientIds.filter(Boolean)));
  if (!ids.length) return out;

  const [{ data: clientsD }, { data: pkgsD }, { data: cpsD }, { data: invD }, { data: bloodD }, { data: bpD }, { data: consultD }, { data: sessD }, { data: apptD }, { data: staffD }] = await Promise.all([
    supabase.from("clients").select("id, name, package_id, frozen").in("id", ids),
    supabase.from("packages").select("id, name, is_facility"),
    supabase.from("client_packages").select("client_id, category, package_name, status, start_date").in("client_id", ids).eq("status", "active"),
    supabase.from("invoices").select("client_id").in("client_id", ids),
    supabase.from("blood_requests").select("client_id, panel, submitted").in("client_id", ids),
    supabase.from("blueprints").select("client_id, generated").in("client_id", ids),
    supabase.from("consultations").select("client_id, kind, status").in("client_id", ids),
    supabase.from("sessions").select("client_id, status").in("client_id", ids).eq("status", "scheduled"),
    supabase.from("appointments").select("client_id, provider_id, status, date, hour").in("client_id", ids).neq("status", "cancelled"),
    supabase.from("staff").select("id, role"),
  ]);

  const pkgById = new Map(((pkgsD ?? []) as { id: string; name: string; is_facility: boolean }[]).map((p) => [p.id, p]));
  const staffRole = new Map(((staffD ?? []) as { id: string; role: string }[]).map((s) => [s.id, s.role]));
  const hasInvoice = new Set(((invD ?? []) as { client_id: string | null }[]).map((r) => r.client_id).filter(Boolean) as string[]);
  // Blood panels, kept apart by PANEL.
  //
  // This ignored the panel column and let the last row win, so a client holding
  // both a BluePrint and a Comprehensive request had "report received" flip
  // depending on the order Postgres returned them. That answer feeds the client
  // card, the Onboarding page and two attention engines. The other engines
  // filter by panel; this was the one that didn't.
  const bloodByPanel = new Map<string, Map<string, boolean>>();
  const bloodReq = new Set<string>();
  for (const b of (bloodD ?? []) as { client_id: string; panel: string | null; submitted: boolean }[]) {
    bloodReq.add(b.client_id);
    const per = bloodByPanel.get(b.client_id) ?? new Map<string, boolean>();
    per.set((b.panel ?? "blueprint").toLowerCase(), Boolean(b.submitted));
    bloodByPanel.set(b.client_id, per);
  }
  const bpGen = new Set(((bpD ?? []) as { client_id: string; generated: boolean }[]).filter((b) => b.generated).map((b) => b.client_id));
  const sessSched = new Set(((sessD ?? []) as { client_id: string | null }[]).map((s) => s.client_id).filter(Boolean) as string[]);

  const catsByClient = new Map<string, string[]>();
  const cpName = new Map<string, string>();
  // Earliest active package start — the anchor the initial-consult deadline
  // counts from, matching what the attention queues chase.
  const pkgStart = new Map<string, string>();
  for (const cp of (cpsD ?? []) as { client_id: string; category: string; package_name: string | null; start_date: string | null }[]) {
    (catsByClient.get(cp.client_id) ?? catsByClient.set(cp.client_id, []).get(cp.client_id)!).push(cp.category);
    if (cp.package_name) cpName.set(`${cp.client_id}|${cp.category}`, cp.package_name);
    const prev = pkgStart.get(cp.client_id);
    if (cp.start_date && (!prev || cp.start_date < prev)) pkgStart.set(cp.client_id, cp.start_date);
  }

  // consultation completion per client per kind
  const consultDone = new Map<string, Set<string>>();       // client -> set of completed kinds
  const consultBooked = new Map<string, Set<string>>();     // client -> set of scheduled kinds
  for (const c of (consultD ?? []) as { client_id: string; kind: string; status: string }[]) {
    if (c.status === "completed") (consultDone.get(c.client_id) ?? consultDone.set(c.client_id, new Set()).get(c.client_id)!).add(c.kind);
    else (consultBooked.get(c.client_id) ?? consultBooked.set(c.client_id, new Set()).get(c.client_id)!).add(c.kind);
  }
  // non-cancelled appointments per client, by discipline (from provider role)
  const apptByClient = new Map<string, { disc: string; when: string; date: string; status: string }[]>();
  for (const a of (apptD ?? []) as { client_id: string; provider_id: string | null; date: string; hour: number; status: string }[]) {
    const role = a.provider_id ? staffRole.get(a.provider_id) : null;
    const disc = Object.entries(ROLE_OF_DISC).find(([, r]) => r === role)?.[0] ?? null;
    if (!disc) continue;
    (apptByClient.get(a.client_id) ?? apptByClient.set(a.client_id, []).get(a.client_id)!).push({ disc, when: whenLabel(a.date, a.hour), date: a.date, status: a.status });
  }

  for (const c of (clientsD ?? []) as { id: string; name: string; package_id: string | null; frozen: string | null }[]) {
    const cats = catsByClient.get(c.id) ?? [];
    const legacy = c.package_id ? packageCategory(c.package_id, pkgById.get(c.package_id)?.is_facility ?? false) : "other";
    const category = PRIORITY.find((p) => cats.includes(p)) ?? (PRIORITY.includes(legacy) ? legacy : cats[0] ?? legacy);
    const membershipActive = category === "membership" || cats.includes("membership") || (pkgById.get(c.package_id ?? "")?.is_facility ?? false);
    // Which panel THIS client's care actually depends on: a Comprehensive
    // client is waiting on the comprehensive panel, whatever else is on file.
    const panels = bloodByPanel.get(c.id);
    const wantPanel = category === "comprehensive" ? "comprehensive" : "blueprint";
    const submitted = panels?.get(wantPanel)
      // No row for the panel we care about — fall back to any panel rather than
      // claiming a report is missing when the client has one on file.
      ?? (panels ? Array.from(panels.values()).some(Boolean) : false);
    const requested = bloodReq.has(c.id);

    const done = consultDone.get(c.id) ?? new Set<string>();
    const booked = consultBooked.get(c.id) ?? new Set<string>();
    const appts = apptByClient.get(c.id) ?? [];
    const consults: Record<string, DiscState> = {};
    for (const d of DISCS) {
      const kind = KIND_OF_DISC[d];
      const mine = appts.filter((a) => a.disc === d);
      const completedAppt = mine.find((a) => a.status === "completed") ?? null;
      const scheduledAppt = mine.find((a) => a.status === "scheduled") ?? null;
      const appt = scheduledAppt ?? completedAppt;
      consults[d] = {
        // A completed appointment counts as the consult done, even without a
        // matching `consultations` row.
        completed: done.has(kind) || Boolean(completedAppt),
        booked: booked.has(kind) || Boolean(scheduledAppt),
        when: appt?.when ?? null,
        date: appt?.date ?? null,
        // The initial consults are expected within BOOKING_DUE_DAYS of the
        // package starting — the same deadline the attention queues chase.
        dueDate: pkgStart.get(c.id) ? addDaysISO(pkgStart.get(c.id)!, BOOKING_DUE_DAYS) : null,
      };
    }

    // Overall onboarding state via the shared engine (ops view). Computed for
    // every client so the package-aware journey ladder is always available; the
    // complete/next summary is only meaningful for the four tracked journeys.
    const input: ClientInput = {
      clientId: c.id, clientName: c.name, category,
      packageName: cpName.get(`${c.id}|${category}`) ?? pkgById.get(c.package_id ?? "")?.name ?? "—",
      ownerName: null, hasInvoice: hasInvoice.has(c.id),
      bloodRequested: requested, bloodSubmitted: submitted,
      doctor: { scheduled: consults.doctor.booked, completed: consults.doctor.completed },
      diet: { scheduled: consults.dietitian.booked, completed: consults.dietitian.completed },
      trainer: { scheduled: consults.trainer.booked, completed: consults.trainer.completed },
      psych: { scheduled: consults.psychologist.booked, completed: consults.psychologist.completed },
      blueprintGenerated: bpGen.has(c.id),
      sessionScheduled: sessSched.has(c.id),
    };
    const row = onboardingRow(input);
    const tracked = ["blueprint", "comprehensive", "training", "membership"].includes(category);

    out.set(c.id, {
      category, membershipActive, frozen: Boolean(c.frozen),
      onboardComplete: tracked ? row.complete : false,
      onboardNext: tracked ? row.nextLabel : null,
      bloodRequested: requested, bloodSubmitted: submitted, consults,
      journeySteps: row.steps.map((s) => ({ label: s.label, done: s.done })),
      today: todayISO,
    });
  }
  return out;
}
