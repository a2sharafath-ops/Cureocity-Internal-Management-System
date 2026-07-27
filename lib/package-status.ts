// "Package status — open & upcoming" for one client. Rolls every wired package
// obligation — payments, blood report, consults, clinician deliverables,
// strength sessions and calendar milestones — into two plain lists so front
// desk sees the whole picture in one place, without depending on the
// care_protocols row the Comprehensive board needs.

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import { COMPREHENSIVE_CATEGORY, milestoneDates, cyclesFor } from "@/lib/comprehensive";
import { loadClientStatuses } from "@/lib/client-status";
import { onboardingRow, type ClientInput } from "@/lib/onboarding";

export type StatusItem = { label: string; detail?: string; href?: string; tone: "warn" | "info" | "neutral"; ownerStaffId?: string; ownerName?: string };
export type PackageStatus = { openNow: StatusItem[]; upcoming: StatusItem[] };

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

export async function getPackageStatus(clientId: string): Promise<PackageStatus | null> {
  const p = await getProfile();
  if (!p || !canSee(p.role, "/clients")) return null;
  const sb = createClient();
  const today = todayISO();

  const [{ data: cps }, { data: inv }, { data: blood }, { data: cons }, { data: appts }, { data: sess }, { data: charts }, { data: workouts }, { data: bp }, { data: proto }] = await Promise.all([
    sb.from("client_packages").select("package_id, package_name, category, status, start_date, end_date").eq("client_id", clientId),
    sb.from("invoices").select("num, description, amount, status").eq("client_id", clientId),
    sb.from("blood_requests").select("panel, submitted").eq("client_id", clientId),
    sb.from("consultations").select("kind, status").eq("client_id", clientId),
    sb.from("appointments").select("type, date, status").eq("client_id", clientId).neq("status", "cancelled"),
    sb.from("sessions").select("status, date").eq("client_id", clientId).neq("status", "cancelled"),
    sb.from("diet_charts").select("id").eq("client_id", clientId).limit(1),
    sb.from("client_workouts").select("id").eq("client_id", clientId).limit(1),
    sb.from("blueprints").select("generated").eq("client_id", clientId).maybeSingle(),
    sb.from("care_protocols").select("start_date, approved_at").eq("client_id", clientId).eq("protocol", COMPREHENSIVE_CATEGORY).eq("status", "active").maybeSingle(),
  ]);

  // Who owns each clinician deliverable — so ops roles can nudge the right
  // person rather than being sent to a workspace they can't act in.
  const { data: asg } = await sb.from("client_assignments").select("discipline, staff_id, staff:staff_id(name)").eq("client_id", clientId);
  const ownerBy = new Map<string, { id: string; name: string }>();
  for (const a of (asg ?? []) as unknown as { discipline: string; staff_id: string | null; staff: { name: string } | null }[]) {
    if (a.staff_id) ownerBy.set(a.discipline, { id: a.staff_id, name: a.staff?.name ?? "clinician" });
  }

  const active = ((cps ?? []) as { package_id: string | null; package_name: string | null; category: string; status: string; start_date: string | null; end_date: string | null }[]).filter((c) => c.status === "active");
  if (!active.length && !(bp && !bp.generated)) return { openNow: [], upcoming: [] };
  const cats = new Set(active.map((c) => c.category));
  const isComp = cats.has("comprehensive"), isPt = cats.has("training");
  const clientHref = `/clients/${clientId}`;
  const openNow: StatusItem[] = [];
  const upcoming: StatusItem[] = [];

  // ---- payments -----------------------------------------------------------
  for (const i of (inv ?? []) as { num: number | null; description: string | null; amount: number; status: string }[]) {
    if (i.status !== "Paid") openNow.push({ label: `Invoice INV-${String(i.num ?? 0).padStart(3, "0")} ${i.status.toLowerCase()}`, detail: `${i.description ?? "Package"} · ₹${Number(i.amount).toLocaleString("en-IN")}`, href: "/billing", tone: "warn" });
  }

  // ---- onboarding checklist (canonical) ----------------------------------
  // Reuse the same engine the Onboarding page runs, so the client's pending
  // journey steps — blood, consults, blueprint generation, sessions scheduled —
  // appear here with their real action links, and the two never disagree.
  const st = (await loadClientStatuses(sb, [clientId], today)).get(clientId);
  const allSess = (sess ?? []) as { status: string; date: string }[];
  if (st && ["blueprint", "comprehensive", "training", "membership"].includes(st.category)) {
    const activeCp = active.find((c) => c.category === st.category);
    const input: ClientInput = {
      clientId, clientName: "", category: st.category,
      packageName: activeCp?.package_name ?? st.category,
      ownerName: null, hasInvoice: (inv ?? []).length > 0,
      bloodRequested: st.bloodRequested, bloodSubmitted: st.bloodSubmitted,
      doctor: { scheduled: st.consults.doctor?.booked ?? false, completed: st.consults.doctor?.completed ?? false },
      diet: { scheduled: st.consults.dietitian?.booked ?? false, completed: st.consults.dietitian?.completed ?? false },
      trainer: { scheduled: st.consults.trainer?.booked ?? false, completed: st.consults.trainer?.completed ?? false },
      blueprintGenerated: Boolean(bp?.generated),
      sessionScheduled: allSess.some((s) => s.status === "scheduled"),
    };
    for (const step of onboardingRow(input).steps) {
      if (!step.done) openNow.push({ label: step.label, href: step.action?.href ?? clientHref, tone: "warn" });
    }
  }

  // ---- clinician deliverables the onboarding ladder doesn't track ----------
  const doneKinds = new Set(((cons ?? []) as { kind: string; status: string }[]).filter((c) => c.status === "completed").map((c) => c.kind));
  // Comprehensive blood is a separate panel — the onboarding step only checks it
  // was *requested*; the client still owes the actual report.
  const compBlood = ((blood ?? []) as { panel: string | null; submitted: boolean }[]).find((b) => (b.panel ?? "blueprint") === "comprehensive");
  // Blood card + consolidated approval live on this same page, so no cross-link.
  if (isComp && compBlood && !compBlood.submitted) openNow.push({ label: "Comprehensive blood report — awaiting client", tone: "warn" });
  // Clinician-owed deliverables: name the responsible clinician so ops roles can
  // nudge them, rather than linking to a workspace they can't act in.
  const diet = ownerBy.get("dietitian"), trainer = ownerBy.get("trainer"), doctor = ownerBy.get("doctor");
  if (isComp && doneKinds.has("Diet") && !((charts ?? []).length)) openNow.push({ label: "Diet chart — not drafted", detail: diet ? `Owed by ${diet.name}` : undefined, ownerStaffId: diet?.id, ownerName: diet?.name, tone: "warn" });
  if ((isComp || isPt) && doneKinds.has("Trainer") && !((workouts ?? []).length)) openNow.push({ label: "Workout plan — not created", detail: trainer ? `Owed by ${trainer.name}` : undefined, ownerStaffId: trainer?.id, ownerName: trainer?.name, tone: "warn" });
  if (isComp && ["Doctor", "Diet", "Trainer"].every((k) => doneKinds.has(k)) && !proto?.approved_at) openNow.push({ label: "Consolidated summary — awaiting approval", detail: doctor ? `Owed by ${doctor.name}` : undefined, ownerStaffId: doctor?.id, ownerName: doctor?.name, tone: "warn" });

  // ---- strength sessions remaining (scheduling itself is an onboarding step) --
  if (isComp || isPt) {
    const total = allSess.length;
    const remaining = total - allSess.filter((s) => s.status === "completed").length;
    if (total > 0 && remaining > 0) {
      const next = allSess.filter((s) => s.status !== "completed" && s.date >= today).map((s) => s.date).sort()[0];
      upcoming.push({ label: `${remaining} of ${total} strength sessions remaining`, detail: next ? `next ${fmt(next)}` : undefined, href: "/sessions", tone: "info" });
    }
  }

  // ---- comprehensive calendar milestones ---------------------------------
  if (isComp) {
    const comp = active.find((c) => c.category === "comprehensive");
    const start = proto?.start_date ?? comp?.start_date ?? null;
    if (start) {
      const spanDays = comp?.end_date ? Math.max(28, daysBetween(start, comp.end_date)) : 28;
      for (const m of milestoneDates(start, cyclesFor(spanDays))) {
        const satisfied = (appts ?? []).some((a: { type: string | null; date: string | null; status: string }) => a.type === m.apptType && a.date && a.date >= m.fromDate && (a.status === "completed" || a.status === "scheduled"));
        if (satisfied) continue;
        const bookHref = `/appointments?client=${clientId}`;
        if (today > m.dueDate) openNow.push({ label: `${m.label} — overdue`, detail: `was due ${fmt(m.dueDate)}`, href: bookHref, tone: "warn" });
        else upcoming.push({ label: m.label, detail: `by ${fmt(m.dueDate)}`, href: bookHref, tone: "info" });
      }
    }
  }

  // ---- package end dates --------------------------------------------------
  for (const c of active) {
    if (!c.end_date) continue;
    upcoming.push({ label: `${c.package_name ?? c.category} ends`, detail: fmt(c.end_date), tone: "neutral" });
  }

  upcoming.sort((a, b) => (a.detail ?? "").localeCompare(b.detail ?? ""));
  return { openNow, upcoming };
}
