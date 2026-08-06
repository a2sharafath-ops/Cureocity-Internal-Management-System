import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canConsult } from "@/lib/roles";
import { consultQ, consultQFor } from "@/lib/consult-questions";
import { milestoneDates, cyclesFor, COMPREHENSIVE_CATEGORY } from "@/lib/comprehensive";
import ConsoleView, { type ConsoleHealth } from "@/components/ConsoleView";
import { todayISO } from "@/lib/today";
import { pdfReadiness } from "@/lib/pdf";
import { watiReadiness } from "@/lib/wati";
import { fmtTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function ConsolePage({ params }: { params: { id: string } }) {
  const me = await getProfile();
  if (!me || !canConsult(me.role)) redirect("/dashboard");

  const supabase = createClient();
  const { data } = await supabase
    .from("consultations")
    .select("id, kind, status, summary, answers, flags, draft, client_id, lead_id, clients(name, code), leads(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!data) notFound();

  const row = data as unknown as {
    id: string; kind: string; status: string; summary: string | null;
    answers: [string, string][] | null; flags: { text: string; severity: string }[] | null;
    draft: { vitals?: Record<string, string>; order?: Record<string, string>; rx?: Record<string, string>; transcript?: string } | null;
    client_id: string | null; lead_id: string | null;
    clients: { name: string; code: string | null } | null; leads: { name: string } | null;
  };
  // For a diet consult, pick the questionnaire by the booked milestone: only the
  // Day-10 follow-up uses the short check-in; the initial (day 0) and Day-21
  // review use the full intake. We match this consult's booked appointment date
  // to the nearest milestone anchor off the comprehensive package start date.
  let dietFollowup = false;
  if (row.kind === "Diet" && row.client_id) {
    const { data: consAppt } = await supabase.from("consultations").select("appointment_id").eq("id", row.id).maybeSingle();
    const apptId = (consAppt as { appointment_id: string | null } | null)?.appointment_id ?? null;
    let apptDate: string | null = null;
    if (apptId) {
      const { data: appt } = await supabase.from("appointments").select("date").eq("id", apptId).maybeSingle();
      apptDate = (appt as { date: string | null } | null)?.date ?? null;
    }
    const { data: cp } = await supabase.from("client_packages")
      .select("start_date, end_date").eq("client_id", row.client_id).eq("category", COMPREHENSIVE_CATEGORY)
      .order("start_date", { ascending: false }).limit(1).maybeSingle();
    const start = (cp as { start_date: string | null } | null)?.start_date ?? null;
    const end = (cp as { end_date: string | null } | null)?.end_date ?? null;

    if (apptDate && start) {
      const days = end ? Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) : null;
      // Anchors: the day-0 initial + every dated diet milestone (day-10, day-21, per cycle).
      const anchors: { key: string; date: string }[] = [
        { key: "diet_initial", date: start },
        ...milestoneDates(start, cyclesFor(days)).filter((m) => m.owner === "dietitian").map((m) => ({ key: m.key, date: m.dueDate })),
      ];
      let bestKey = "diet_initial", bestDist = Infinity;
      for (const a of anchors) {
        const dist = Math.abs(Date.parse(`${a.date}T00:00:00Z`) - Date.parse(`${apptDate}T00:00:00Z`));
        if (dist < bestDist) { bestDist = dist; bestKey = a.key; }
      }
      dietFollowup = bestKey === "diet_10";
    } else {
      // Fallback when there's no booked date / package start: chronological order
      // (index 0 initial, 1 day-10, 2 day-21, alternating).
      const { data: dietRows } = await supabase.from("consultations").select("id").eq("client_id", row.client_id).eq("kind", "Diet").order("created_at", { ascending: true });
      const idx = ((dietRows ?? []) as { id: string }[]).findIndex((c) => c.id === row.id);
      dietFollowup = idx >= 0 && idx % 2 === 1;
    }
  }
  // Questions are resolved AFTER the client's health snapshot loads, because the
  // sex-specific items are filtered by gender (see consultQFor). Placeholder here
  // keeps the label/icon available if there's no client (a pre-sale lead).
  let q = consultQ(row.kind, dietFollowup);

  // A consultation is on a client or (for a pre-sale trial) a lead. Render the
  // right subject and point the "open card" link at the right record.
  const subject = row.client_id
    ? { id: row.client_id, name: row.clients?.name ?? "Client", code: row.clients?.code ?? null, isLead: false }
    : { id: row.lead_id ?? "", name: row.leads?.name ?? "Lead", code: null, isLead: true };

  // The client's health snapshot the clinician can see at a glance during the
  // session — profile, latest InBody, conditions, allergies and goals. Only for
  // a real client (a pre-sale lead has none of this yet).
  let health: ConsoleHealth | undefined;
  if (row.client_id) {
    const [{ data: c }, { data: m }, { data: alg }, { data: blood }] = await Promise.all([
      supabase.from("clients").select("dob, gender, height, weight, conditions, goals").eq("id", row.client_id).maybeSingle(),
      supabase.from("measurements").select("date, weight, bmi, body_fat, muscle_mass, visceral_fat, waist, hip, ai_summary").eq("client_id", row.client_id).order("date", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("allergies").select("substance, severity").eq("client_id", row.client_id),
      supabase.from("blood_requests").select("panel, submitted").eq("client_id", row.client_id),
    ]);
    const cc = c as { dob: string | null; gender: string | null; height: number | null; weight: number | null; conditions: string | null; goals: string[] | null } | null;
    const mm = m as { date: string; weight: number | null; bmi: number | null; body_fat: number | null; muscle_mass: number | null; visceral_fat: number | null; waist: number | null; hip: number | null; ai_summary: string | null } | null;
    const age = cc?.dob ? Math.floor((Date.now() - new Date(cc.dob).getTime()) / 31557600000) : null;
    const bloodRows = (blood ?? []) as { panel: string | null; submitted: boolean }[];
    // Latest uploaded InBody report PDF, if any — a signed link the clinician
    // can open. Uploading a new one is offered in the health card.
    const { data: inbodyFile } = await supabase
      .from("files").select("path, created_at").eq("client_id", row.client_id).eq("kind", "inbody").order("created_at", { ascending: false }).limit(1).maybeSingle();
    let inbodyPdfUrl: string | null = null;
    if (inbodyFile) {
      const { data: signed } = await supabase.storage.from("client-files").createSignedUrl((inbodyFile as { path: string }).path, 3600);
      inbodyPdfUrl = signed?.signedUrl ?? null;
    }
    health = {
      age, gender: cc?.gender ?? null, height: cc?.height ?? null, weight: mm?.weight ?? cc?.weight ?? null,
      bmi: mm?.bmi ?? null, bodyFat: mm?.body_fat ?? null, muscle: mm?.muscle_mass ?? null, visceral: mm?.visceral_fat ?? null,
      waist: mm?.waist ?? null, hip: mm?.hip ?? null, measuredOn: mm?.date ?? null,
      inbodySummary: mm?.ai_summary ?? null, inbodyPdfUrl,
      conditions: cc?.conditions ?? null, goals: (cc?.goals ?? []) as string[],
      allergies: ((alg ?? []) as { substance: string; severity: string }[]).map((a) => `${a.substance}${a.severity ? ` (${a.severity})` : ""}`),
      bloodStatus: bloodRows.length ? (bloodRows.every((b) => b.submitted) ? "Report received" : "Awaiting report") : null,
    };
    // Now that the client's gender is known, drop the sex-specific questions that
    // don't apply. saveConsultSession runs the identical filter, so the `a_<i>`
    // indices posted by the form line up with the questions on save.
    q = consultQFor(row.kind, cc?.gender ?? null, dietFollowup);
  }

  // Today's vitals, if already recorded. Saving clears the scratch draft, so
  // without this the boxes come back empty after a save and it looks as though
  // the reading was lost — it wasn't, it had become a real record.
  let savedVitals: Record<string, string> | null = null;
  let savedVitalsAt: string | null = null;
  if (row.client_id) {
    const { data: vt } = await supabase.from("vitals")
      .select("systolic, diastolic, pulse, spo2, temp_c, weight, created_at")
      .eq("client_id", row.client_id).eq("date", todayISO())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const v = vt as (Record<string, number | null> & { created_at: string }) | null;
    if (v) {
      savedVitals = Object.fromEntries(
        (["systolic", "diastolic", "pulse", "spo2", "temp_c", "weight"] as const)
          .map((k) => [k, v[k] === null || v[k] === undefined ? "" : String(v[k])]),
      );
      savedVitalsAt = fmtTime(v.created_at);
    }
  }

  // Medical reports + what was ordered/prescribed for this client — shown in the
  // console and used by "Compile from record" to draft the summary.
  let reports: { id: string; name: string | null; kind: string | null; report_label: string | null; report_date: string | null; summary: string | null; created_at: string; url?: string | null }[] = [];
  let orders: { test: string; priority: string | null; created_at: string }[] = [];
  // The prescription written in THIS session, if any — what the print link
  // points at. Falls back to the client's latest, so a prescription added from
  // the EMR is still printable from here.
  let rxPrintId: string | null = null;
  let rxSharedAt: string | null = null;
  let labSharedAt: string | null = null;
  let rxList: { drug: string; dose: string | null; frequency: string | null; duration: string | null }[] = [];
  if (row.client_id) {
    const [{ data: rep }, { data: ord }, { data: rx }] = await Promise.all([
      supabase.from("files").select("id, name, kind, report_label, report_date, summary, created_at, bucket, path")
        .eq("client_id", row.client_id).eq("kind", "medical_report").order("created_at", { ascending: false }).limit(15),
      supabase.from("orders").select("test, priority, created_at").eq("client_id", row.client_id).order("created_at", { ascending: false }).limit(10),
      supabase.from("prescription_items").select("drug, dose, frequency, duration, prescriptions!inner(client_id, created_at)")
        .eq("prescriptions.client_id", row.client_id).limit(15),
    ]);
    reports = await Promise.all(((rep ?? []) as { id: string; name: string | null; kind: string | null; report_label: string | null; report_date: string | null; summary: string | null; created_at: string; bucket: string | null; path: string }[]).map(async (r) => {
      const { data: signed } = await supabase.storage.from(r.bucket || "client-files").createSignedUrl(r.path, 3600);
      return { id: r.id, name: r.name, kind: r.kind, report_label: r.report_label, report_date: r.report_date, summary: r.summary, created_at: r.created_at, url: signed?.signedUrl ?? null };
    }));
    orders = (ord ?? []) as typeof orders;
    const { data: rxRow } = await supabase.from("prescriptions")
      .select("id, consultation_id, shared_at").eq("client_id", row.client_id)
      .order("created_at", { ascending: false }).limit(5);
    const rxRows = (rxRow ?? []) as { id: string; consultation_id: string | null; shared_at: string | null }[];
    const pick = rxRows.find((r) => r.consultation_id === row.id) ?? rxRows[0];
    rxPrintId = pick?.id ?? null;
    rxSharedAt = pick?.shared_at ?? null;
    // The requisition is shared as a set, so one order's stamp speaks for all.
    const { data: shared } = await supabase.from("orders")
      .select("shared_at").eq("consultation_id", row.id).not("shared_at", "is", null).limit(1).maybeSingle();
    labSharedAt = (shared as { shared_at: string | null } | null)?.shared_at ?? null;
    rxList = ((rx ?? []) as unknown as { drug: string; dose: string | null; frequency: string | null; duration: string | null }[]);
  }

  // Vitals, lab orders and prescriptions write rows keyed to a real client. A
  // lead has no clients row, so these were quietly posting a lead id into the
  // clinical tables; every other clinical panel here is already gated the same
  // way.
  const canTools = row.kind === "Doctor" && Boolean(row.client_id);

  return (
    <ConsoleView
      id={row.id}
      kind={row.kind}
      label={q.label}
      icon={q.icon}
      client={subject}
      questions={q.questions}
      answers={(row.answers ?? []) as [string, string][]}
      // Vitals typed but never saved — restored so a reload doesn't lose them.
      draftVitals={((row.draft ?? null) as { vitals?: Record<string, string> } | null)?.vitals ?? null}
      draftPending={{ order: row.draft?.order, rx: row.draft?.rx, transcript: row.draft?.transcript }}
      savedVitals={savedVitals}
      savedVitalsAt={savedVitalsAt}
      rxPrintId={rxPrintId}
      rxSharedAt={rxSharedAt}
      labSharedAt={labSharedAt}
      flags={(row.flags ?? []) as { text: string; severity: string }[]}
      summary={row.summary}
      status={row.status}
      canTools={canTools}
      pdf={pdfReadiness()}
      whatsapp={watiReadiness()}
      reports={reports}
      orders={orders}
      prescriptions={rxList}
      health={health}
    />
  );
}
