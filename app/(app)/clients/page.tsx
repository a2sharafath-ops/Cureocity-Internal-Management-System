import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ClientsTable, { type ClientRow } from "@/components/ClientsTable";
import { getProfile } from "@/lib/auth";
import { canWrite } from "@/lib/roles";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { ageFromDob } from "@/lib/dob";
import { loadClientStatuses, clientStatus, disciplineForRole } from "@/lib/client-status";
import { buildFullJourney } from "@/lib/journey";
import { loadCatOf } from "@/lib/appt-match";
import { todayISO } from "@/lib/today";

export const dynamic = "force-dynamic";

type Raw = {
  id: string; code: string | null; name: string; phone: string | null; email: string | null;
  used: number; branch: string | null; joined: string | null; dob: string | null; owner: string | null; package_id: string | null;
  packages: { name: string; sessions: number; is_facility: boolean } | null;
  staff: { name: string } | null;
};

export default async function ClientsPage() {
  const supabase = createClient();
  const profile = await getProfile();
  const writer = canWrite(profile?.role ?? "");

  const [{ data, error }, { data: staffData }] = await Promise.all([
    supabase.from("clients").select("id, code, name, phone, email, used, branch, joined, dob, owner, package_id, packages(name, sessions, is_facility), staff:pro_id(name)").order("code", { ascending: true }),
    supabase.from("staff").select("id, name").order("name"),
  ]);

  const { data: subData } = await supabase.from("tablet_submissions").select("id, first_name, last_name, phone, created_at").eq("status", "pending").order("created_at", { ascending: false });
  const submissions = (subData ?? []) as { id: string; first_name: string; last_name: string | null; phone: string | null; created_at: string }[];

  // One status engine feeds both the journey dots and the status badge, so the
  // dots are package-aware (BluePrint / PT / Comprehensive / membership each get
  // their own ladder) and can never disagree with the badge beneath them.
  const rawRows = (data ?? []) as unknown as Raw[];
  const ids = rawRows.map((c) => c.id);
  const today = todayISO();
  const [statusMap, { data: cpAll }, { data: caAll }, { data: chartsAll }, { data: workoutsAll }, { data: protosAll }, { data: sessAll }, { data: bloodAll }, { data: apptAll }, { data: fuAll }] = await Promise.all([
    loadClientStatuses(supabase, ids, today),
    supabase.from("client_packages").select("client_id, package_name, category, status, start_date, end_date").in("client_id", ids),
    supabase.from("client_assignments").select("client_id, discipline, staff_id").in("client_id", ids),
    supabase.from("diet_charts").select("client_id").in("client_id", ids),
    supabase.from("client_workouts").select("client_id").in("client_id", ids),
    supabase.from("care_protocols").select("client_id, approved_at").eq("protocol", "comprehensive").eq("status", "active").in("client_id", ids),
    supabase.from("sessions").select("client_id, status").in("client_id", ids),
    supabase.from("blood_requests").select("client_id, panel, submitted").in("client_id", ids),
    supabase.from("appointments").select("client_id, type, date, status").in("client_id", ids).neq("status", "cancelled"),
    supabase.from("followups").select("client_id, day, label, stage").in("client_id", ids),
  ]);
  const viewerDisc = disciplineForRole(profile?.role);

  // ---- full-journey signals (the whole package lifecycle, not just onboarding) --
  const chartSet = new Set(((chartsAll ?? []) as { client_id: string }[]).map((r) => r.client_id));
  const workoutSet = new Set(((workoutsAll ?? []) as { client_id: string }[]).map((r) => r.client_id));
  const consolidatedSet = new Set(((protosAll ?? []) as { client_id: string; approved_at: string | null }[]).filter((r) => r.approved_at).map((r) => r.client_id));
  const sessBy = new Map<string, { total: number; done: number; scheduled: boolean }>();
  for (const s of (sessAll ?? []) as { client_id: string; status: string }[]) {
    const v = sessBy.get(s.client_id) ?? { total: 0, done: 0, scheduled: false };
    v.total++; if (s.status === "completed") v.done++; if (s.status === "scheduled") v.scheduled = true;
    sessBy.set(s.client_id, v);
  }
  const bloodPanelBy = new Map<string, Map<string, boolean>>();
  for (const b of (bloodAll ?? []) as { client_id: string; panel: string | null; submitted: boolean }[]) {
    (bloodPanelBy.get(b.client_id) ?? bloodPanelBy.set(b.client_id, new Map()).get(b.client_id)!).set(b.panel ?? "blueprint", b.submitted);
  }
  // Resolve each booking's type to its service category so a manually-booked
  // service ("10th Day Diet Followup") counts against its journey milestone.
  const catOf = await loadCatOf(supabase);
  const apptBy = new Map<string, { type: string | null; date: string | null; status: string }[]>();
  for (const a of (apptAll ?? []) as { client_id: string; type: string | null; date: string | null; status: string }[]) {
    (apptBy.get(a.client_id) ?? apptBy.set(a.client_id, []).get(a.client_id)!).push({ ...a, type: catOf(a.type) });
  }
  // Day-2 diet chart explanation closed (booked / completed / no-consult).
  const FU_CLOSED = new Set(["BOOKED", "COMPLETED", "NO_CONSULT"]);
  const dietExplainedSet = new Set(((fuAll ?? []) as { client_id: string; day: number | null; label: string; stage: string }[])
    .filter((f) => f.day === 2 && /explanation/i.test(f.label) && FU_CLOSED.has(f.stage))
    .map((f) => f.client_id));
  const cpDatesBy = new Map<string, { category: string; start_date: string | null; end_date: string | null }[]>();
  for (const r of (cpAll ?? []) as { client_id: string; category: string; status: string; start_date: string | null; end_date: string | null }[]) {
    if (r.status !== "active") continue;
    (cpDatesBy.get(r.client_id) ?? cpDatesBy.set(r.client_id, []).get(r.client_id)!).push({ category: r.category, start_date: r.start_date, end_date: r.end_date });
  }

  const staff = (staffData ?? []) as { id: string; name: string }[];
  const staffNameById = new Map(staff.map((s) => [s.id, s.name]));

  // Real active packages + full care team per client, so the list reflects
  // everything a client holds — not just the single legacy package / pro_id.
  const CAT_LABEL: Record<string, string> = { membership: "Membership", comprehensive: "Comprehensive", training: "PT", blueprint: "BluePrint", other: "Package" };
  const DISC_LABEL: Record<string, string> = { doctor: "Doctor", dietitian: "Diet", trainer: "Fitness", coach: "Coach", psychologist: "Psych" };
  const DISC_ORDER = ["doctor", "dietitian", "trainer", "coach", "psychologist"];
  const pkgsByClient = new Map<string, { label: string; category: string }[]>();
  for (const r of (cpAll ?? []) as { client_id: string; package_name: string | null; category: string; status: string }[]) {
    if (r.status !== "active") continue;
    const arr = pkgsByClient.get(r.client_id) ?? [];
    arr.push({ label: r.package_name ?? CAT_LABEL[r.category] ?? "Package", category: r.category });
    pkgsByClient.set(r.client_id, arr);
  }
  const teamByClient = new Map<string, { disc: string; name: string }[]>();
  for (const r of (caAll ?? []) as { client_id: string; discipline: string; staff_id: string | null }[]) {
    if (!r.staff_id) continue;
    const name = staffNameById.get(r.staff_id);
    if (!name) continue;
    const arr = teamByClient.get(r.client_id) ?? [];
    arr.push({ disc: r.discipline, name });
    teamByClient.set(r.client_id, arr);
  }
  const clients: ClientRow[] = rawRows.map((c) => {
    const sessions = c.packages?.sessions ?? 0;
    const facility = c.packages?.is_facility ?? false;
    const status = facility ? "Active" : (sessions > 0 && c.used >= sessions ? "Completed" : "Active");
    const st = statusMap.get(c.id);
    // The WHOLE journey of the client's primary active package — blood, consults,
    // deliverables, consolidated, sessions and calendar milestones — not just the
    // onboarding ladder.
    const cat = st?.category ?? "other";
    const panel = cat === "comprehensive" ? "comprehensive" : "blueprint";
    const sess = sessBy.get(c.id) ?? { total: 0, done: 0, scheduled: false };
    const cpDate = (cpDatesBy.get(c.id) ?? []).find((r) => r.category === cat);
    const fullSteps = buildFullJourney({
      category: cat,
      bloodRequested: st?.bloodRequested ?? false,
      bloodReceived: bloodPanelBy.get(c.id)?.get(panel) ?? false,
      doctorDone: st?.consults.doctor?.completed ?? false,
      dietDone: st?.consults.dietitian?.completed ?? false,
      trainerDone: st?.consults.trainer?.completed ?? false,
      hasChart: chartSet.has(c.id), dietExplained: dietExplainedSet.has(c.id), hasWorkout: workoutSet.has(c.id), consolidated: consolidatedSet.has(c.id),
      blueprintGenerated: st?.journeySteps.some((s) => s.label.includes("BluePrint generated") && s.done) ?? false,
      sessionsTotal: sess.total, sessionsDone: sess.done, sessionScheduled: sess.scheduled,
      startDate: cpDate?.start_date ?? null, endDate: cpDate?.end_date ?? null,
      appts: apptBy.get(c.id) ?? [], today,
    });
    const steps = fullSteps.length ? fullSteps : (st?.journeySteps ?? [{ label: "Package sold", done: c.package_id != null }]);
    const doneCount = steps.filter((s) => s.done).length;
    const cpkgs = pkgsByClient.get(c.id) ?? [];
    const packages = cpkgs.length ? cpkgs : (c.packages?.name ? [{ label: c.packages.name, category: c.package_id === "bp1" ? "blueprint" : "other" }] : []);
    const careTeam = (teamByClient.get(c.id) ?? [])
      .sort((a, b) => DISC_ORDER.indexOf(a.disc) - DISC_ORDER.indexOf(b.disc))
      .map((t) => ({ disc: DISC_LABEL[t.disc] ?? t.disc, name: t.name }));
    return {
      id: c.id, code: c.code, name: c.name, phone: c.phone, email: c.email,
      age: ageFromDob(c.dob), branch: c.branch, used: c.used,
      package_name: c.packages?.name ?? null, is_facility: facility, package_sessions: sessions,
      packages, careTeam,
      is_blueprint: c.package_id === "bp1" || cpkgs.some((p) => p.category === "blueprint") || (c.packages?.name ?? "").toLowerCase().includes("blueprint"),
      status, coach: c.staff?.name ?? null, owner: c.owner ?? null,
      journey: { steps, done: doneCount, total: steps.length, stage: doneCount === steps.length ? "Journey complete" : `Next: ${steps.find((s) => !s.done)?.label ?? "—"}` },
      careStatus: clientStatus(st, viewerDisc),
    };
  });

  return (
    <div style={{ maxWidth: 1120 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
        <RealtimeRefresh tables={["clients"]} />
        <h1 style={{ fontSize: 20, margin: 0 }}>Clients</h1>
        <span style={{ flex: 1 }} />
        {writer && (
          <Link href="/clients/new" style={{ background: "var(--ink)", color: "#fff", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>+ Onboard Client</Link>
        )}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>CRM Hub — searchable contacts list</p>

      {writer && submissions.map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "var(--brand-tint)", border: "1px solid #99f6e4", borderRadius: "var(--radius)", padding: "12px 16px", marginBottom: 12, fontSize: 14 }}>
          <span><b>Tablet intake received:</b> {s.first_name} {s.last_name ?? ""}{s.phone ? ` · ${s.phone}` : ""} — synced to front desk</span>
          <span style={{ flex: 1 }} />
          <Link href={`/clients/new?sub=${s.id}`} style={{ background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Review &amp; Add Client</Link>
        </div>
      ))}

      {error ? (
        <div style={{ background: "var(--red-bg)", color: "var(--red-text)", border: "1px solid #fecaca", borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 14 }}>
          <b>Couldn&apos;t load clients.</b> {error.message}
        </div>
      ) : (
        <ClientsTable clients={clients} staff={staff} writer={writer} />
      )}
    </div>
  );
}
