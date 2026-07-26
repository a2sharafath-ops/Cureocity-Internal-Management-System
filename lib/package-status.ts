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

export type StatusItem = { label: string; detail?: string; href?: string; tone: "warn" | "info" | "neutral" };
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

  // ---- blood panels -------------------------------------------------------
  const bloodByPanel = new Map(((blood ?? []) as { panel: string | null; submitted: boolean }[]).map((b) => [b.panel ?? "blueprint", b.submitted]));
  if (isComp) {
    const sub = bloodByPanel.get("comprehensive");
    if (sub === undefined) openNow.push({ label: "Comprehensive blood panel — not requested", href: "/blueprint", tone: "warn" });
    else if (!sub) openNow.push({ label: "Comprehensive blood report — awaiting client", href: clientHref, tone: "warn" });
  }
  if (cats.has("blueprint")) {
    const sub = bloodByPanel.get("blueprint");
    if (sub !== undefined && !sub) openNow.push({ label: "BluePrint blood report — awaiting client", href: clientHref, tone: "warn" });
  }

  // ---- consults + clinician deliverables ---------------------------------
  const doneKinds = new Set(((cons ?? []) as { kind: string; status: string }[]).filter((c) => c.status === "completed").map((c) => c.kind));
  const bookedKinds = new Set(((cons ?? []) as { kind: string; status: string }[]).filter((c) => c.status !== "completed").map((c) => c.kind));
  if (isComp || isPt) {
    const need: [string, string][] = isComp ? [["Doctor", "Doctor consultation"], ["Diet", "Diet consultation"], ["Trainer", "Fitness assessment"]] : [["Trainer", "Fitness assessment"]];
    for (const [k, lbl] of need) {
      if (!doneKinds.has(k)) openNow.push({ label: `${lbl} — ${bookedKinds.has(k) ? "booked, awaiting the session" : "not booked"}`, href: bookedKinds.has(k) ? clientHref : `/appointments?client=${clientId}`, tone: "warn" });
    }
    if (isComp && doneKinds.has("Diet") && !((charts ?? []).length)) openNow.push({ label: "Diet chart — not drafted", href: clientHref, tone: "warn" });
    if ((isComp || isPt) && doneKinds.has("Trainer") && !((workouts ?? []).length)) openNow.push({ label: "Workout plan — not created", href: clientHref, tone: "warn" });
    if (isComp && ["Doctor", "Diet", "Trainer"].every((k) => doneKinds.has(k)) && !proto?.approved_at) openNow.push({ label: "Consolidated summary — awaiting approval", href: clientHref, tone: "warn" });
  }
  if (cats.has("blueprint") && bp && !bp.generated) openNow.push({ label: "BluePrint — awaiting clinician sign-offs", href: "/blueprint", tone: "warn" });

  // ---- strength sessions --------------------------------------------------
  const allSess = (sess ?? []) as { status: string; date: string }[];
  if (isComp || isPt) {
    const total = allSess.length;
    const doneSess = allSess.filter((s) => s.status === "completed").length;
    const remaining = total - doneSess;
    if (total === 0) openNow.push({ label: "Strength sessions — not scheduled", href: clientHref, tone: "warn" });
    else if (remaining > 0) {
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
    upcoming.push({ label: `${c.package_name ?? c.category} ends`, detail: fmt(c.end_date), href: clientHref, tone: "neutral" });
  }

  upcoming.sort((a, b) => (a.detail ?? "").localeCompare(b.detail ?? ""));
  return { openNow, upcoming };
}
