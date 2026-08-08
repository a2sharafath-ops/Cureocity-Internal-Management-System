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

// ---- data shapes (a subset of the DB rows) --------------------------------
export type JourneyRow = {
  id: string;
  stage: string;
  status: string;
  stage_entered_at: string;
};

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
  const done = journeys.filter((j) => j.stage === "done" || j.status === "done").length;
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
