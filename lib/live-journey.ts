// The Live Journey — pure stage + KPI logic for the D0 concierge board.
//
// Kept free of I/O (mirrors lib/whiteboard-stage.ts / lib/journey.ts) so the
// SOP's three-minute standard is unit-tested against fixtures, not the DB. The
// page loads `journeys` + `journey_events` and hands them here; the server
// actions in lib/actions.ts drive the transitions.

export type JourneyStageKey =
  | "front_desk"
  | "await_coach"
  | "briefing"
  | "fitness"
  | "transition_med"
  | "medical"
  | "transition_diet"
  | "diet"
  | "review"
  | "done";

export type StageOwner = "Front Desk" | "Health Coach" | "Fitness Trainer" | "Doctor" | "Dietitian";

export type JourneyStage = {
  key: JourneyStageKey;
  label: string;
  owner: StageOwner;
  /** A "coach returns within 3 minutes" waiting stage — the ones the KPIs judge. */
  wait: boolean;
  /** The assessment a professional is running here, if any (drives Notify-coach). */
  assessment?: "fitness" | "medical" | "diet";
};

// The SOP flow, in order. The Health Coach owns every transition.
export const JOURNEY_STAGES: JourneyStage[] = [
  { key: "front_desk",     label: "Front Desk",            owner: "Front Desk" },
  { key: "await_coach",    label: "Awaiting Coach",        owner: "Health Coach", wait: true } as JourneyStage,
  { key: "briefing",       label: "Coach Briefing",        owner: "Health Coach" },
  { key: "fitness",        label: "Fitness Assessment",    owner: "Fitness Trainer", assessment: "fitness" },
  { key: "transition_med", label: "Transition → Medical",  owner: "Health Coach", wait: true } as JourneyStage,
  { key: "medical",        label: "Medical Assessment",    owner: "Doctor", assessment: "medical" },
  { key: "transition_diet",label: "Transition → Diet",     owner: "Health Coach", wait: true } as JourneyStage,
  { key: "diet",           label: "Diet Assessment",       owner: "Dietitian", assessment: "diet" },
  { key: "review",         label: "Coach Review & Blueprint", owner: "Health Coach" },
  { key: "done",           label: "Handed to Front Desk",  owner: "Front Desk" },
].map((s) => ({ wait: false, ...s })) as JourneyStage[];

/** The SOP standard: the coach returns within three minutes at every handover. */
export const MAX_WAIT_MS = 3 * 60 * 1000;

const STAGE_BY_KEY = new Map(JOURNEY_STAGES.map((s) => [s.key, s]));

export function stageMeta(key: string): JourneyStage {
  return STAGE_BY_KEY.get(key as JourneyStageKey) ?? JOURNEY_STAGES[0];
}

export function stageIndex(key: string): number {
  const i = JOURNEY_STAGES.findIndex((s) => s.key === key);
  return i < 0 ? 0 : i;
}

/** Next stage in the flow; clamps at the terminal `done`. */
export function nextStageKey(key: string): JourneyStageKey {
  const i = stageIndex(key);
  return JOURNEY_STAGES[Math.min(i + 1, JOURNEY_STAGES.length - 1)].key;
}

export function isWaitStage(key: string): boolean {
  return stageMeta(key).wait;
}

export function assessmentOf(key: string): "fitness" | "medical" | "diet" | null {
  return stageMeta(key).assessment ?? null;
}

// ---- auto-sync: consultations drive the board ------------------------------
//
// The board is a projection of work the team already logs, not a second data
// entry. A clinician opening their consultation IS the client arriving at that
// assessment; completing it IS the handover back to the coach. So each
// consultation kind maps to a stage on start and another on completion, and the
// gap between "completed" and the next "started" is exactly the transition wait
// the SOP's three-minute standard measures.
//
// Psychologist is absent deliberately — it is not one of the three core
// assessments, so a psychology consult never moves the journey.

/** Consultation kind → the stage the client occupies while that consult runs. */
export const CONSULT_START_STAGE: Record<string, JourneyStageKey> = {
  Trainer: "fitness",
  Doctor: "medical",
  Diet: "diet",
  Coach: "briefing",
};

/** Consultation kind → the stage the journey moves to when that consult ends. */
export const CONSULT_DONE_STAGE: Record<string, JourneyStageKey> = {
  Trainer: "transition_med",
  Doctor: "transition_diet",
  Diet: "review",
  // Coach is absent on purpose — see stageForConsult. The coach appears TWICE
  // in the flow and the kind alone cannot say which visit this is.
};

/**
 * The stage a consultation event implies, or null when that kind should leave
 * the board untouched. Stages are SET, not incremented, so the flow survives
 * professionals being seen out of order (which the SOP explicitly allows).
 *
 * The coach is the exception, and it mattered: their kind was mapped to
 * "briefing" on start and "done" on completion, so finishing the OPENING
 * briefing marked the visit handed back and closed the journey. The client was
 * still in the building waiting for fitness, medical and diet; because the row
 * was no longer active, every later consult was a silent no-op and the journey
 * could never move again. It also inflated "Completed today".
 *
 * So the coach's stage is read from where the client already is: before the
 * assessments it is the briefing, after them it is the closing review. A coach
 * consult opened in the middle of the flow moves nothing — walking a client
 * between rooms is not an assessment, and guessing would send the board
 * backwards.
 */
export function stageForConsult(
  kind: string,
  phase: "start" | "complete",
  currentStage?: string | null,
): JourneyStageKey | null {
  if (kind === "Coach") {
    const at = stageIndex(currentStage ?? "front_desk");
    const atReview = at >= stageIndex("review");
    const beforeAssessments = at <= stageIndex("briefing");
    if (phase === "start") {
      if (atReview) return "review";
      return beforeAssessments ? "briefing" : null;
    }
    if (atReview) return "done";
    // The briefing ended: the client goes on to the first assessment. Setting it
    // here rather than waiting for the trainer to open their console keeps the
    // board honest about where the client actually is.
    return beforeAssessments ? "fitness" : null;
  }
  const map = phase === "start" ? CONSULT_START_STAGE : CONSULT_DONE_STAGE;
  return map[kind] ?? null;
}

/**
 * How long after creation a journey keeps auto-tracking consultations. The D0
 * visit is one day, but initial assessments are sometimes split across a couple
 * of visits — so the window is generous while still preventing a stale journey
 * from capturing a follow-up consult months later.
 */
export const AUTO_WINDOW_DAYS = 14;

// ---- data shapes (a subset of the DB rows) --------------------------------
export type JourneyRow = {
  id: string;
  stage: string;
  status: string;
  stage_entered_at: string;
};

// ---- who is actually in the building ---------------------------------------
//
// A journey opens the moment a coached package is sold, but for Comprehensive
// the client rarely arrives that day: Front Desk has two days just to BOOK the
// assessments. So a purchase-day row would otherwise sit on the board reading
// "Front Desk" for a week, inflating every live number with people who are not
// in the building.
//
// Three groups instead, decided per row at read time (no background job):
//
//   here     — on the floor now. Either already handed over (past Front Desk),
//              or still at the desk with an assessment booked for today.
//   expected — sold, not here yet. Booked for a future day, or not booked at
//              all, which is the one worth chasing.
//   lapsed   — started moving, then nothing since before today. The client went
//              home mid-flow and nobody closed them out.
//
// Only `here` feeds the KPIs. A lapsed journey must never keep counting against
// the three-minute standard for a day it wasn't being measured on.

export type JourneyGroup = "here" | "expected" | "lapsed";

/** Local calendar day of an ISO timestamp — journeys are judged per clinic day. */
function dayOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function journeyGroup(
  row: { stage: string; status: string; stage_entered_at: string },
  hasAppointmentToday: boolean,
  now: number,
): JourneyGroup {
  const today = dayOf(new Date(now).toISOString());
  const movedToday = dayOf(row.stage_entered_at) === today;

  // Finished journeys stay with the day they finished on, so "Completed today"
  // means today and yesterday's total doesn't follow the board around forever.
  if (row.stage === "done" || row.status === "done") return movedToday ? "here" : "lapsed";

  if (row.stage === "front_desk") {
    // Never handed over. Here only if they're expected on the floor today.
    if (hasAppointmentToday) return "here";
    return movedToday ? "here" : "expected";
  }

  // Mid-flow: on the floor if something moved them today, otherwise abandoned.
  return movedToday ? "here" : "lapsed";
}

export type JourneyEvent = {
  journey_id: string;
  kind: string;
  stage: string | null;
  at: string;
};

export type JourneyKpis = {
  /** active visits not yet handed back */
  inJourney: number;
  /** visits completed (handed back to Front Desk) */
  done: number;
  /** mean duration of COMPLETED waiting stages, ms */
  avgWaitMs: number;
  /** share of completed waiting stages met within 3 min */
  coachPresentPct: number;
  /** waiting stages (open or closed) that ran over 3 min */
  breaches: number;
};

const ms = (iso: string) => new Date(iso).getTime();

/**
 * KPI rollup, derived purely from the `stage_enter` events.
 *
 * For each journey we order its stage entries; the duration of stage i is the
 * gap to stage i+1 (or `now` for the stage it currently sits in). Only the
 * waiting stages count toward the SOP standard.
 */
export function journeyKpis(journeys: JourneyRow[], events: JourneyEvent[], now: number): JourneyKpis {
  const enters = events.filter((e) => e.kind === "stage_enter");
  const byJourney = new Map<string, JourneyEvent[]>();
  for (const e of enters) {
    const arr = byJourney.get(e.journey_id);
    if (arr) arr.push(e);
    else byJourney.set(e.journey_id, [e]);
  }

  const durations: number[] = [];
  let breaches = 0, closed = 0, onTime = 0;

  for (const evs of byJourney.values()) {
    evs.sort((a, b) => ms(a.at) - ms(b.at));
    for (let i = 0; i < evs.length; i++) {
      if (!isWaitStage(evs[i].stage ?? "")) continue;
      const start = ms(evs[i].at);
      const hasNext = i + 1 < evs.length;
      const end = hasNext ? ms(evs[i + 1].at) : now;
      const d = end - start;
      if (d > MAX_WAIT_MS) breaches++;
      if (hasNext) {
        closed++;
        durations.push(d);
        if (d <= MAX_WAIT_MS) onTime++;
      }
    }
  }

  const inJourney = journeys.filter((j) => j.status === "active" && j.stage !== "done").length;
  // "Completed TODAY" — it used to count every journey ever finished, so the
  // number only ever climbed. A journey's stage_entered_at is stamped when it
  // reaches "done", which is when it finished.
  const today = dayOf(new Date(now).toISOString());
  const done = journeys.filter(
    (j) => (j.stage === "done" || j.status === "done") && dayOf(j.stage_entered_at) === today,
  ).length;
  const avgWaitMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const coachPresentPct = closed ? Math.round((onTime / closed) * 100) : 100;

  return { inJourney, done, avgWaitMs, coachPresentPct, breaches };
}

/** Whether the coach has been pinged for the visit's CURRENT stage. */
export function isCoachNotified(row: JourneyRow, events: JourneyEvent[]): boolean {
  const since = ms(row.stage_entered_at);
  return events.some(
    (e) => e.kind === "notify_coach" && e.journey_id === row.id && e.stage === row.stage && ms(e.at) >= since,
  );
}

/** mm:ss for a millisecond span, floored at zero. */
export function fmtElapsed(msSpan: number): string {
  const s = Math.max(0, Math.round(msSpan / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
