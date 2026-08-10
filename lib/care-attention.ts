// Care-work exceptions for the dashboard "Needs your attention" queue: the
// Comprehensive / BluePrint deliverables and calendar milestones that are
// outstanding or overdue right now, across every active care client. Computed
// live from bulk reads (not the once-per-gate SLA ledger, which keeps fired
// events even after the work is done).

import { createClient } from "@/lib/supabase/server";
import { dueOn, waitingSince } from "@/lib/due";
import { clock, formatLeft } from "@/lib/sla-clock";
import type { Flag } from "@/components/AttentionPanel";
import { COMPREHENSIVE_CATEGORY, milestoneDates, cyclesFor, DIET_DRAFT_MS, WORKOUT_PLAN_MS, BOOKING_DUE_DAYS } from "@/lib/comprehensive";
import { milestoneDates as ptMilestoneDates, cyclesFor as ptCyclesFor } from "@/lib/pt";
import { GENERATION_MS as BP_GENERATION_MS } from "@/lib/blueprint-sla";
import { buildOwnerResolver, outstandingDeliverables, unsatisfiedMilestones, consultDoneKinds, currentTerm, type AssignRow, type ApptOwnerRow, type DoneConsultRow, type DoneApptRow } from "@/lib/obligations";
import { makeCatOf } from "@/lib/appt-match";
import { loadClientStatuses } from "@/lib/client-status";
import { MARKERS, markerOverdueDays, markerNeedsReferral, type MarkerState } from "@/lib/coach-markers";
import {
  BOOKING_OWNER, BLOOD_CHASE_OWNER, DELIVERY_OWNER, sessionOwners,
  CONCERN_ESCALATION_OWNER, CONCERN_ESCALATION_DAYS, MARKER_BASELINE_GRACE_DAYS,
} from "@/lib/work-owners";
import { onboardingRow, type ClientInput } from "@/lib/onboarding";

const addDaysISO = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

export async function careWorkFlags(today: string): Promise<Flag[]> {
  const sb = await createClient();
  const [{ data: cps }, { data: clients }, { data: cons }, { data: charts }, { data: workouts }, { data: blood }, { data: bp }, { data: protos }, { data: openConcerns }, { data: coachRows }, { data: appts }, { data: signoffs }] = await Promise.all([
    sb.from("client_packages").select("client_id, category, start_date, end_date, status").eq("status", "active"),
    sb.from("clients").select("id, name"),
    sb.from("consultations").select("client_id, kind, status, completed_at"),
// The diet CHART became the diet PLAN.
    //
    // `diet_charts` is the retired flat document; `diet_plans` is the structured
    // one the dietitian actually writes now. The obligation is the same — has
    // this client been given their eating plan — so it has to watch the table
    // that can still be satisfied. Left pointing at diet_charts, every
    // Comprehensive client would read "diet chart pending" for ever, because
    // nothing would ever create one again.
    sb.from("diet_plans").select("client_id"),
    sb.from("client_workouts").select("client_id"),
    sb.from("blood_requests").select("client_id, panel, submitted, requested_at"),
    sb.from("blueprints").select("client_id, generated"),
    // Every active protocol row, every protocol. Filtering to Comprehensive
    // meant a PT client's clock came from a package date here while Today's
    // agenda used their protocol row — the same client, two different day-10s.
    sb.from("care_protocols").select("client_id, protocol, start_date").eq("status", "active"),
    sb.from("concerns").select("client_id, body, created_at").eq("status", "Open"),
    sb.from("coach_assessments").select("client_id, marker, date, tone, band").order("date", { ascending: false }),
    sb.from("appointments").select("client_id, type, date, status, provider_id, staff:provider_id(name, role)").neq("status", "cancelled"),
    // The ACTUAL BluePrint sign-offs. The flag below used to infer them from
    // completed consultations, which is a different thing entirely — see there.
    sb.from("blueprint_signoffs").select("client_id, discipline, created_at"),
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
  // The day-0 bookings and the strength-session prompt.
  //
  // These were the dashboard's blind spot. Its milestone loop reads MILESTONES,
  // which begins at day 10 — the three INITIAL consultations live in a separate
  // list that only the client card consulted. So the most urgent thing front
  // desk owns (a client has paid and nobody has booked them in) was visible on
  // one client's page and on no queue anywhere, and the dashboard would first
  // mention that client on day 10, ten days late.
  //
  // Deliberately driven by onboardingRow — the same engine the client card and
  // the Onboarding page run — rather than a second implementation of "which
  // bookings are outstanding". Labels, links and completion rules stay in one
  // place, which is the whole point of lib/obligations.
  const { data: initSvc } = await sb.from("services").select("category, day_offset, name").ilike("name", "Initial%");
  const initialOffsets = new Map<string, number>();
  for (const sv of ((initSvc ?? []) as { category: string; day_offset: number | null }[])) {
    if (sv.day_offset == null) continue;
    const prev = initialOffsets.get(sv.category);
    if (prev == null || sv.day_offset < prev) initialOffsets.set(sv.category, sv.day_offset);
  }
  const [{ data: sessAll }, { data: invAll }] = await Promise.all([
    sb.from("sessions").select("client_id, status"),
    sb.from("invoices").select("client_id"),
  ]);
  const sessCount = new Map<string, number>();
  const sessScheduled = new Set<string>();
  for (const r of (sessAll ?? []) as { client_id: string | null; status: string }[]) {
    if (!r.client_id) continue;
    sessCount.set(r.client_id, (sessCount.get(r.client_id) ?? 0) + 1);
    if (r.status === "scheduled") sessScheduled.add(r.client_id);
  }
  const hasInvoice = new Set(((invAll ?? []) as { client_id: string | null }[])
    .map((r) => r.client_id).filter(Boolean) as string[]);

  // Service catalogue → category resolver + pre-filled Book links.
  const { data: svcData } = await sb.from("services").select("name, category, day_offset");
  const services = (svcData ?? []) as { name: string; category: string; day_offset: number | null }[];

  const name = new Map(((clients ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const catsBy = new Map<string, { category: string; start_date: string | null; end_date: string | null }[]>();
  for (const c of (cps ?? []) as { client_id: string; category: string; start_date: string | null; end_date: string | null }[]) {
    (catsBy.get(c.client_id) ?? catsBy.set(c.client_id, []).get(c.client_id)!).push(c);
  }
  // When the clock started for each clinician deliverable: the chart is owed
  // 24h after the diet consult finished, the plan 24h after the assessment.
  const completedAt = new Map<string, Map<string, string>>();
  for (const c of (cons ?? []) as { client_id: string; kind: string; status: string; completed_at: string | null }[]) {
    if (c.status !== "completed" || !c.completed_at) continue;
    const per = completedAt.get(c.client_id) ?? new Map<string, string>();
    // Earliest completion is what the SLA runs from — a later re-consult
    // must not quietly reset a deadline that has already been missed.
    const prev = per.get(c.kind);
    if (!prev || c.completed_at < prev) per.set(c.kind, c.completed_at);
    completedAt.set(c.client_id, per);
  }
  // When each discipline signed the consolidated summary, per client. Only a
  // row here means somebody actually signed.
  const signedAt = new Map<string, Map<string, string>>();
  for (const s of (signoffs ?? []) as { client_id: string; discipline: string; created_at: string | null }[]) {
    if (!s.created_at) continue;
    const per = signedAt.get(s.client_id) ?? new Map<string, string>();
    per.set(s.discipline, s.created_at);
    signedAt.set(s.client_id, per);
  }

  // When the comprehensive panel was asked for, so "awaiting" can say how long.
  const bloodAsked = new Map<string, string>();
  for (const b of (blood ?? []) as { client_id: string; panel: string | null; submitted: boolean; requested_at: string | null }[]) {
    if ((b.panel ?? "blueprint") !== "comprehensive" || b.submitted || !b.requested_at) continue;
    bloodAsked.set(b.client_id, b.requested_at);
  }

  // One definition of "the consult happened", shared with the client card and
  // the client badge. A session held and recorded only as a completed
  // appointment used to leave the diet chart and the workout plan un-owed for
  // ever, with no screen saying anything was missing. See consultDoneKinds.
  const catOf = makeCatOf(services);
  const consBy = new Map<string, DoneConsultRow[]>();
  for (const c of (cons ?? []) as { client_id: string; kind: string; status: string }[]) {
    (consBy.get(c.client_id) ?? consBy.set(c.client_id, []).get(c.client_id)!).push(c);
  }
  const apptDoneBy = new Map<string, DoneApptRow[]>();
  for (const a of (appts ?? []) as unknown as ({ client_id: string } & DoneApptRow)[]) {
    (apptDoneBy.get(a.client_id) ?? apptDoneBy.set(a.client_id, []).get(a.client_id)!).push(a);
  }
  const doneKinds = new Map<string, Set<string>>();
  for (const id of new Set([...consBy.keys(), ...apptDoneBy.keys()])) {
    doneKinds.set(id, consultDoneKinds(consBy.get(id) ?? [], apptDoneBy.get(id) ?? [], catOf));
  }
  const hasChart = new Set(((charts ?? []) as { client_id: string }[]).map((r) => r.client_id));
  const hasWorkout = new Set(((workouts ?? []) as { client_id: string }[]).map((r) => r.client_id));
  const bloodBy = new Map<string, Map<string, boolean>>();
  for (const b of (blood ?? []) as { client_id: string; panel: string | null; submitted: boolean }[]) {
    (bloodBy.get(b.client_id) ?? bloodBy.set(b.client_id, new Map()).get(b.client_id)!).set(b.panel ?? "blueprint", b.submitted);
  }
  const bpGen = new Set(((bp ?? []) as { client_id: string; generated: boolean }[]).filter((r) => r.generated).map((r) => r.client_id));
  // ALL of a client's protocol rows, not the last one the database returned.
  // A renewal adds a second, and keeping one arbitrarily is what made the
  // number of follow-up cycles change between page loads.
  const protoBy = new Map<string, { protocol?: string | null; start_date: string | null }[]>();
  for (const r of (protos ?? []) as { client_id: string; protocol: string | null; start_date: string | null }[]) {
    (protoBy.get(r.client_id) ?? protoBy.set(r.client_id, []).get(r.client_id)!).push(r);
  }
  const apptsBy = new Map<string, { type: string | null; date: string | null; status: string }[]>();
  for (const a of (appts ?? []) as { client_id: string; type: string | null; date: string | null; status: string }[]) {
    (apptsBy.get(a.client_id) ?? apptsBy.set(a.client_id, []).get(a.client_id)!).push(a);
  }

  const concernsBy = new Map<string, { body: string; created_at: string | null }[]>();
  for (const c of (openConcerns ?? []) as { client_id: string | null; body: string; created_at: string | null }[]) {
    if (!c.client_id) continue;
    (concernsBy.get(c.client_id) ?? concernsBy.set(c.client_id, []).get(c.client_id)!).push(c);
  }

  // Latest reading per client+marker. The query is date-descending, so the
  // first row seen for a key is the newest.
  const markerLatest = new Map<string, MarkerState>();
  for (const r of (coachRows ?? []) as { client_id: string; marker: string; date: string; tone: string | null; band: string | null }[]) {
    const key = `${r.client_id}|${r.marker}`;
    if (!markerLatest.has(key)) markerLatest.set(key, { marker: r.marker as never, date: r.date, tone: r.tone, band: r.band });
  }

  const statuses = await loadClientStatuses(sb, Array.from(catsBy.keys()), today);

  const flags: Flag[] = [];
  for (const [clientId, rows] of catsBy) {
    const who = name.get(clientId) ?? "Client";
    const cats = new Set(rows.map((r) => r.category));
    const done = doneKinds.get(clientId) ?? new Set<string>();

    // Comprehensive / PT clinician deliverables — same detection as the client
    // card. compblood + dietchart are Comprehensive-only (the predicate enforces
    // it); the workout plan is owed for PT clients too, so this runs for every
    // client, not just Comprehensive ones.
    const deliv = new Set(outstandingDeliverables({
      isComp: cats.has("comprehensive"), isPt: cats.has("training"),
      dietConsultDone: done.has("Diet"), trainerConsultDone: done.has("Trainer"),
      hasChart: hasChart.has(clientId), hasWorkout: hasWorkout.has(clientId),
      compBloodSubmitted: bloodBy.get(clientId)?.get("comprehensive") ?? null,
    }));
    // Where the work gets DONE, not merely where the client is described.
    // These three used to land on the client card, which meant the reader
    // arrived at the top of a long page and still had to go and find the diet
    // builder. The builders already accept ?client=<id> and open pre-filled.
    // The 24h turnaround clocks already exist for these two — package-status
    // shows them, this queue did not, so the same flag read as urgent in one
    // place and undated in the other.
    const sla = (startAt: string | null | undefined, windowMs: number) => {
      const c = clock(startAt, null, windowMs, Date.now());
      if (!c.dueAt) return {};
      return { dueLabel: `due ${fmt(c.dueAt.slice(0, 10))} · ${formatLeft(c.msLeft)}`, overdue: c.status === "breached" };
    };
    const chartHref   = `/workspace?role=diet&tab=charts&client=${clientId}`;
    const workoutHref = `/workspace?role=trainer&tab=planner&client=${clientId}`;
    // Blood status lives with the reports it describes, on the Card tab.
    const bloodHref   = `/clients/${clientId}?tab=card`;

    if (deliv.has("compblood")) {
      // Chasing the client for the report is the Health Coach's job (they own
      // the client relationship for PT / Comprehensive). Nudge the assigned
      // coach; if none is assigned yet, chase the Health Coach role.
      const o = ownerFor(clientId, "coach");
      flags.push({ sev: "med", title: `${who} — comprehensive blood report pending`, detail: o ? `Follow-up owed by ${o.name}` : "Requested, awaiting the client", href: bloodHref, cta: "Open reports",
        ...waitingSince(bloodAsked.get(clientId), today),
        // Keyed by panel, not just client. This flag is the COMPREHENSIVE
        // panel; the front-desk queue raises one per outstanding panel. Keyed
        // by client alone the two collapsed on the dashboard, and since care
        // flags merge first, a client owing both panels had their BluePrint one
        // silently dropped.
        dedupeKey: `blood:${clientId}:comprehensive`,
        nudge: o ? { clientId, staffId: o.id, label: "Blood report — awaiting client", who: o.name } : undefined,
        chaseRole: o ? undefined : { roles: BLOOD_CHASE_OWNER, who: "Health Coach", label: "Blood report — awaiting client", clientId, href: bloodHref } });
    }
    if (deliv.has("dietchart")) {
      const o = ownerFor(clientId, "dietitian");
      flags.push({ sev: "med", title: `${who} — diet chart not drafted`, detail: o ? `Owed by ${o.name}` : "Owed after the diet consult", href: chartHref, cta: "Draft chart", ...sla(completedAt.get(clientId)?.get("Diet"), DIET_DRAFT_MS),
        nudge: o ? { clientId, staffId: o.id, label: "Diet chart — not drafted", who: o.name } : undefined,
        chaseRole: o ? undefined : { roles: DELIVERY_OWNER.dietitian, who: "Dietitian", label: "Diet chart — not drafted", clientId, href: chartHref } });
    }
    if (deliv.has("workout")) {
      const o = ownerFor(clientId, "trainer");
      flags.push({ sev: "med", title: `${who} — workout plan not created`, detail: o ? `Owed by ${o.name}` : "Owed after the fitness assessment", href: workoutHref, cta: "Build plan", ...sla(completedAt.get(clientId)?.get("Trainer"), WORKOUT_PLAN_MS),
        nudge: o ? { clientId, staffId: o.id, label: "Workout plan — not created", who: o.name } : undefined,
        chaseRole: o ? undefined : { roles: DELIVERY_OWNER.trainer, who: "Fitness Trainer", label: "Workout plan — not created", clientId, href: workoutHref } });
    }

    // ---- a concern nobody has answered -----------------------------------
    // The coach owns it from the moment it is raised. After
    // CONCERN_ESCALATION_DAYS it stops being theirs alone and the Medical
    // Director is told — the clinical backstop, so nothing raised about a
    // client can quietly sit open forever.
    for (const c of concernsBy.get(clientId) ?? []) {
      if (!c.created_at) continue;
      const ageDays = Math.floor((Date.parse(today) - Date.parse(c.created_at.slice(0, 10))) / 86_400_000);
      if (ageDays < CONCERN_ESCALATION_DAYS) continue;
      flags.push({
        sev: "high",
        title: `${who} — concern open ${ageDays} days`,
        detail: c.body.slice(0, 120),
        href: `/workspace?role=coach&tab=concerns`, cta: "Open",
        dedupeKey: `concern-esc:${clientId}`,
        chaseRole: { roles: CONCERN_ESCALATION_OWNER, who: "Medical Director", label: `Unanswered concern — ${who}`, clientId, href: "/workspace?role=coach&tab=concerns" },
      });
    }

    // ---- the Health Coach's six markers ----------------------------------
    //
    // These raised NOTHING anywhere: no follow-up, no task, no flag. The only
    // place an overdue PSS-10 or HAM-A appeared was inside the coach's own tab,
    // so if that coach was on leave the whole clinic was blind to it —
    // including the referral pathway for severe anxiety and substance use.
    //
    // Only for clients who actually have a coach on their care team; a
    // membership client is not owed coaching.
    if (cats.has("comprehensive") || cats.has("training")) {
      const coachOwner = ownerFor(clientId, "coach");
      for (const m of MARKERS) {
        const last = markerLatest.get(`${clientId}|${m.key}`);

        // A reading in the referral band outranks any cadence question: the
        // number itself is the reason to act, however recently it was taken.
        if (markerNeedsReferral(last)) {
          flags.push({
            sev: "high",
            title: `${who} — ${m.label.toLowerCase()} in referral band`,
            detail: `${m.tool} · ${last!.band ?? "referral"} · ${m.referral}`,
            href: "/workspace?role=coach&tab=coaching", cta: "Open",
            dedupeKey: `marker-refer:${clientId}:${m.key}`,
            nudge: coachOwner ? { clientId, staffId: coachOwner.id, label: `${m.label} — referral band`, who: coachOwner.name } : undefined,
            chaseRole: coachOwner ? undefined : { roles: DELIVERY_OWNER.coach, who: "Health Coach", label: `${m.label} — referral band`, clientId, href: "/workspace?role=coach&tab=coaching" },
          });
          continue;
        }

        // Cadence. A client with no baseline at all is only flagged once the
        // package has had time to start — MARKER_BASELINE_GRACE_DAYS — so a
        // client who joined this morning doesn't arrive with six red flags.
        const activeCp = rows.find((r) => r.category === (cats.has("comprehensive") ? "comprehensive" : "training"));
        const start = currentTerm(rows, protoBy.get(clientId) ?? [], today)?.anchor ?? activeCp?.start_date ?? null;
        const sinceStart = start ? Math.floor((Date.parse(today) - Date.parse(start)) / 86_400_000) : 0;
        if (!last && sinceStart < MARKER_BASELINE_GRACE_DAYS) continue;

        const over = markerOverdueDays(m, last, today, sinceStart - MARKER_BASELINE_GRACE_DAYS);
        if (over === null || over <= 0) continue;
        flags.push({
          sev: "med",
          title: last ? `${who} — ${m.label.toLowerCase()} re-assessment overdue` : `${who} — ${m.label.toLowerCase()} never assessed`,
          detail: last ? `${m.tool} · last ${last.date} · every ${m.reassessDays} days` : `${m.tool} · no baseline on file`,
          href: "/workspace?role=coach&tab=coaching", cta: "Assess",
          dueLabel: `${over} day${over === 1 ? "" : "s"} overdue`, overdue: true,
          dedupeKey: `marker-due:${clientId}:${m.key}`,
          nudge: coachOwner ? { clientId, staffId: coachOwner.id, label: `${m.label} re-assessment due`, who: coachOwner.name } : undefined,
          chaseRole: coachOwner ? undefined : { roles: DELIVERY_OWNER.coach, who: "Health Coach", label: `${m.label} re-assessment due`, clientId, href: "/workspace?role=coach&tab=coaching" },
        });
      }
    }

    // ---- overdue day-0 bookings ------------------------------------------
    const st = statuses.get(clientId);
    if (st && ["blueprint", "comprehensive", "training", "membership"].includes(st.category)) {
      const activeCp = rows.find((r) => r.category === st.category);
      const pkgStart = currentTerm(rows, protoBy.get(clientId) ?? [], today)?.anchor ?? activeCp?.start_date ?? null;
      const input: ClientInput = {
        clientId, clientName: who, category: st.category,
        packageName: activeCp?.category ?? st.category,
        ownerName: null, hasInvoice: hasInvoice.has(clientId),
        bloodRequested: st.bloodRequested, bloodSubmitted: st.bloodSubmitted,
        doctor: { scheduled: st.consults.doctor?.booked ?? false, completed: st.consults.doctor?.completed ?? false },
        diet: { scheduled: st.consults.dietitian?.booked ?? false, completed: st.consults.dietitian?.completed ?? false },
        trainer: { scheduled: st.consults.trainer?.booked ?? false, completed: st.consults.trainer?.completed ?? false },
        psych: { scheduled: st.consults.psychologist?.booked ?? false, completed: st.consults.psychologist?.completed ?? false },
        blueprintGenerated: bpGen.has(clientId),
        sessionScheduled: sessScheduled.has(clientId),
      };
      for (const step of onboardingRow(input).steps) {
        // Booked-but-not-yet-held is not front-desk work — it is scheduled and
        // waiting on the clinician. Sessions have their own flag below.
        // Optional steps are offered, never owed — they cannot go overdue.
        if (step.done || step.booked || step.optional || /session/i.test(step.label)) continue;
        // The deadline is whatever the clinic set in Services → Day offset, not
        // a number in this file.
        const offset = step.bookCategory ? initialOffsets.get(step.bookCategory) ?? null : null;
        const due = offset != null && pkgStart ? addDaysISO(pkgStart, offset) : null;
        if (!due || today <= due) continue;   // this queue is overdue-only
        const href = step.action?.href ?? `/clients/${clientId}`;
        flags.push({
          sev: "high", title: `${who} — ${step.label.toLowerCase()}`, detail: "",
          href, cta: "Book", ...dueOn(due, today),
          dedupeKey: `init:${clientId}:${step.bookCategory ?? step.label}`,
          chaseRole: { roles: BOOKING_OWNER, who: "Health Coach", label: step.label, clientId, href },
        });
      }
    }

    // ---- paid, but not one strength session in the diary -------------------
    if (cats.has("comprehensive") || cats.has("training")) {
      if ((sessCount.get(clientId) ?? 0) === 0) {
        const cat = rows.find((r) => r.category === (cats.has("training") ? "training" : "comprehensive"));
        const start = currentTerm(rows, protoBy.get(clientId) ?? [], today)?.anchor ?? cat?.start_date ?? null;
        const due = start ? addDaysISO(start, BOOKING_DUE_DAYS) : null;
        if (due && today > due) {
          flags.push({
            sev: "high", title: `${who} — no strength sessions booked`,
            detail: start ? `Package started ${fmt(start)} · nothing in the diary yet` : "Nothing in the diary yet",
            href: "/sessions", cta: "Schedule", ...dueOn(due, today),
            dedupeKey: `sess:${clientId}`,
            // Nothing in the diary is a booking failure AND a delivery one, so
            // both hear about it; a booked block running behind is the
            // trainer's alone (sessionOwners).
            chaseRole: { roles: sessionOwners(false), who: "Health Coach & trainer", label: "Book 12 strength sessions", clientId, href: "/sessions" },
          });
        }
      }
    }

    // Milestones for BOTH protocols. This block used to be Comprehensive-only,
    // so a PT client's day-28 fitness reassessment could go a month overdue
    // with nothing on any queue saying so.
    if (cats.has("comprehensive") || cats.has("training")) {
      const isPt = !cats.has("comprehensive") && cats.has("training");
      // Overdue calendar milestones (bookings that never got made). Same term
      // and same anchor as the client card and Today's agenda.
      const term = currentTerm(rows, protoBy.get(clientId) ?? [], today);
      const start = term?.anchor ?? null;
      if (start) {
        const span = term?.spanDays ?? 28;
        const dated = isPt
          ? ptMilestoneDates(start, ptCyclesFor(span))
          : milestoneDates(start, cyclesFor(span));
        for (const m of unsatisfiedMilestones(clientId, dated, apptsBy.get(clientId) ?? [], services, today)) {
          if (today <= m.dueDate) continue; // dashboard shows only overdue milestones
          // A missed milestone is two failures wearing one label: nobody booked
          // it, or it was booked and not held. MILESTONES records the
          // DELIVERING discipline and this queue used to throw that away and
          // say "Front Desk" — so the same overdue item chased different people
          // on different screens. Name both.
          const deliver = DELIVERY_OWNER[m.owner] ?? [];
          const o = ownerFor(clientId, m.owner);
          flags.push({ sev: "high", title: `${who} — ${m.label.toLowerCase()} overdue`, detail: o ? `To be held by ${o.name}` : "", href: m.bookHref, cta: "Book", ...dueOn(m.dueDate, today),
            chaseRole: { roles: [...BOOKING_OWNER, ...deliver], who: "Health Coach", label: `Book ${m.label}`, clientId, href: m.bookHref } });
        }
      }
    }

    if (cats.has("blueprint") && !bpGen.has(clientId)) {
      const bpBlood = bloodBy.get(clientId)?.get("blueprint");
      if (bpBlood) {
        // The clock starts at the LAST sign-off: until all three disciplines
        // have signed, the document genuinely cannot be produced. Once they
        // have, GENERATION_MS is how long it may sit — previously nothing, so
        // this flag could never read as overdue no matter how long it waited.
        // Sign-offs, not consultations.
        //
        // This used to read completedAt — the map of finished CONSULTATIONS —
        // and call the result "sign-offs". Two consequences, both bad: the flag
        // announced "all three sign-offs done" when nobody had signed anything,
        // and the generation clock started at the last APPOINTMENT, so it read
        // as overdue while the three clinicians were still inside their own
        // sign-off windows. A clinician was being chased for lateness that had
        // not happened yet.
        const signed = ["doctor", "dietitian", "trainer"]
          .map((d) => signedAt.get(clientId)?.get(d))
          .filter(Boolean) as string[];
        const allSigned = signed.length === 3 ? signed.sort().slice(-1)[0] : null;
        flags.push({
          sev: allSigned ? "high" : "med",
          title: `${who} — BluePrint not generated`,
          detail: allSigned ? "Blood in · all three sign-offs done" : `Blood in · awaiting sign-off (${signed.length}/3 signed)`,
          href: "/blueprint", cta: "Review",
          ...sla(allSigned, BP_GENERATION_MS),
          chaseRole: { roles: [...DELIVERY_OWNER.doctor, ...DELIVERY_OWNER.dietitian, ...DELIVERY_OWNER.trainer], who: "Health Professionals", label: "BluePrint sign-off", clientId, href: "/blueprint" },
        });
      }
    }
  }
  return flags;
}
