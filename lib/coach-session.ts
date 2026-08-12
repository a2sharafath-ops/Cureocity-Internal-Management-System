import { BARRIER_CATEGORIES } from "@/lib/coach-goals";
import { applicableMarkerKeys, type MarkerKey } from "@/lib/coach-markers";

export const COACH_SESSION_VERSION = "Cureocity HC360 session v1.0";

export const URGENT_CONCERNS = [
  "None",
  "New exercise symptom",
  "Substance or withdrawal concern",
  "Other urgent concern",
] as const;
export const ADHERENCE_REVIEWS = ["On track", "Partly on track", "Off track", "Excused / plan changed", "Not due"] as const;
export const SCREENING_DISPOSITIONS = ["Completed today", "Scheduled", "Not clinically indicated today", "Unable today"] as const;
export const FOLLOWUP_CHANNELS = ["WhatsApp", "App", "Phone", "In person"] as const;
export const HANDOFF_DESTINATIONS = ["Doctor", "Dietitian", "Fitness Trainer", "Psychologist", "Medical Director"] as const;
export const HANDOFF_URGENCY = ["Routine", "Priority", "Urgent"] as const;
export const CONSENT_STATUSES = ["Obtained", "Declined", "Not required"] as const;

export type CoachCheckIn = {
  wellbeing?: number;
  energy?: number;
  client_priority?: string;
  urgent_concern?: string;
  immediate_action?: string;
};

export type CoachReview = {
  wins?: string;
  adherence?: string;
  evidence?: string;
  learning?: string;
  screening_disposition?: string;
  screening_note?: string;
};

export type CoachBarrier = {
  category?: string;
  detail?: string;
  coach_response?: string;
};

export type CoachActionPlan = {
  goal_id?: string;
  action_name?: string;
  target_per_week?: number;
  cue?: string;
  time_place?: string;
  confidence?: number;
  scale_down_note?: string;
  if_then_plan?: string;
  support_needed?: string;
  review_date?: string;
};

export type CoachCloseout = {
  client_recap?: string;
  coach_summary?: string;
  followup_channel?: string;
  followup_date?: string;
  handoff_needed?: string;
  handoff_destination?: string;
  handoff_reason?: string;
  handoff_urgency?: string;
  consent_status?: string;
};

export type CoachSessionData = {
  check_in: CoachCheckIn;
  review: CoachReview;
  barrier: CoachBarrier;
  action_plan: CoachActionPlan;
  closeout: CoachCloseout;
};

const text = (value: unknown, max = 3000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const enumValue = (value: unknown, options: readonly string[]) => {
  const candidate = text(value, 100);
  return options.includes(candidate) ? candidate : "";
};
const bounded = (value: unknown, min: number, max: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};
const isoDate = (value: unknown) => {
  const candidate = text(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : "";
};

/** Validate the structured session on the server. Unknown fields and invalid
 * enum/range values are discarded rather than becoming clinical data. */
export function sanitizeCoachSession(raw: Record<string, unknown>): CoachSessionData {
  const c = (raw.check_in && typeof raw.check_in === "object" ? raw.check_in : {}) as Record<string, unknown>;
  const r = (raw.review && typeof raw.review === "object" ? raw.review : {}) as Record<string, unknown>;
  const b = (raw.barrier && typeof raw.barrier === "object" ? raw.barrier : {}) as Record<string, unknown>;
  const a = (raw.action_plan && typeof raw.action_plan === "object" ? raw.action_plan : {}) as Record<string, unknown>;
  const o = (raw.closeout && typeof raw.closeout === "object" ? raw.closeout : {}) as Record<string, unknown>;
  return {
    check_in: {
      wellbeing: bounded(c.wellbeing, 0, 10), energy: bounded(c.energy, 0, 10),
      client_priority: text(c.client_priority), urgent_concern: enumValue(c.urgent_concern, URGENT_CONCERNS),
      immediate_action: text(c.immediate_action),
    },
    review: {
      wins: text(r.wins), adherence: enumValue(r.adherence, ADHERENCE_REVIEWS), evidence: text(r.evidence),
      learning: text(r.learning), screening_disposition: enumValue(r.screening_disposition, SCREENING_DISPOSITIONS),
      screening_note: text(r.screening_note),
    },
    barrier: {
      category: enumValue(b.category, BARRIER_CATEGORIES), detail: text(b.detail), coach_response: text(b.coach_response),
    },
    action_plan: {
      goal_id: text(a.goal_id, 80), action_name: text(a.action_name, 300),
      target_per_week: bounded(a.target_per_week, 1, 7), cue: text(a.cue, 500), time_place: text(a.time_place, 500),
      confidence: bounded(a.confidence, 0, 10), scale_down_note: text(a.scale_down_note),
      if_then_plan: text(a.if_then_plan), support_needed: text(a.support_needed), review_date: isoDate(a.review_date),
    },
    closeout: {
      client_recap: text(o.client_recap), coach_summary: text(o.coach_summary),
      followup_channel: enumValue(o.followup_channel, FOLLOWUP_CHANNELS), followup_date: isoDate(o.followup_date),
      handoff_needed: enumValue(o.handoff_needed, ["Yes", "No"]),
      handoff_destination: enumValue(o.handoff_destination, HANDOFF_DESTINATIONS),
      handoff_reason: text(o.handoff_reason), handoff_urgency: enumValue(o.handoff_urgency, HANDOFF_URGENCY),
      consent_status: enumValue(o.consent_status, CONSENT_STATUSES),
    },
  };
}

export function coachSessionProgress(data: CoachSessionData, screeningsDue: number) {
  const urgent = Boolean(data.check_in.urgent_concern && data.check_in.urgent_concern !== "None");
  const required: [string, unknown][] = [
    ["wellbeing", data.check_in.wellbeing], ["energy", data.check_in.energy],
    ["client priority", data.check_in.client_priority], ["safety check", data.check_in.urgent_concern],
  ];
  if (urgent) required.push(
      ["immediate safety action", data.check_in.immediate_action],
      ["coach closeout", data.closeout.coach_summary],
      ["follow-up date", data.closeout.followup_date],
  );
  else {
    required.push(
      ["wins", data.review.wins], ["adherence review", data.review.adherence], ["client learning", data.review.learning],
      ["agreed action", data.action_plan.action_name], ["weekly target", data.action_plan.target_per_week],
      ["cue", data.action_plan.cue], ["time and place", data.action_plan.time_place],
      ["confidence", data.action_plan.confidence],
      ["if-then plan", data.action_plan.if_then_plan], ["review date", data.action_plan.review_date],
      ["client recap", data.closeout.client_recap], ["coach summary", data.closeout.coach_summary],
      ["follow-up channel", data.closeout.followup_channel], ["follow-up date", data.closeout.followup_date],
      ["handoff decision", data.closeout.handoff_needed],
    );
    if (data.review.adherence === "Off track") required.push(
      ["barrier", data.barrier.detail], ["barrier response", data.barrier.coach_response],
    );
    if (Number(data.action_plan.confidence) < 7) required.push(["smaller action", data.action_plan.scale_down_note]);
    if (data.closeout.handoff_needed === "Yes") required.push(
        ["handoff destination", data.closeout.handoff_destination], ["handoff reason", data.closeout.handoff_reason],
        ["handoff urgency", data.closeout.handoff_urgency], ["handoff consent", data.closeout.consent_status],
    );
    if (screeningsDue > 0) required.push(
      ["due-screening disposition", data.review.screening_disposition],
      ["due-screening note", data.review.screening_note],
    );
  }
  const complete = required.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");
  return {
    urgent, completed: complete.length, total: required.length,
    percent: required.length ? Math.round((complete.length / required.length) * 100) : 0,
    missing: required.filter((item) => !complete.includes(item)).map(([label]) => label),
  };
}

export function coachSessionSummary(data: CoachSessionData, sessionNumber: number) {
  const urgent = data.check_in.urgent_concern && data.check_in.urgent_concern !== "None";
  const lines = [
    `HEALTH COACH SESSION ${sessionNumber}`,
    `Check-in: wellbeing ${data.check_in.wellbeing ?? "—"}/10 · energy ${data.check_in.energy ?? "—"}/10`,
    `Client priority: ${data.check_in.client_priority || "—"}`,
  ];
  if (urgent) {
    lines.push(`Safety stop: ${data.check_in.urgent_concern}`, `Immediate action: ${data.check_in.immediate_action || "—"}`);
  } else {
    lines.push(
      `Wins: ${data.review.wins || "—"}`,
      `Adherence: ${data.review.adherence || "—"}${data.review.evidence ? ` · ${data.review.evidence}` : ""}`,
      `Learning: ${data.review.learning || "—"}`,
    );
    if (data.barrier.detail) lines.push(`Barrier (${data.barrier.category || "Other"}): ${data.barrier.detail}`, `Coach response: ${data.barrier.coach_response || "—"}`);
    lines.push(
      `Agreed action: ${data.action_plan.action_name || "—"} · ${data.action_plan.target_per_week ?? "—"}x/week`,
      `Cue / context: ${data.action_plan.cue || "—"} · ${data.action_plan.time_place || "—"}`,
      `Confidence: ${data.action_plan.confidence ?? "—"}/10`,
      `If-then plan: ${data.action_plan.if_then_plan || "—"}`,
    );
  }
  lines.push(
    `Coach summary: ${data.closeout.coach_summary || "—"}`,
    `Follow-up: ${data.closeout.followup_date || "—"} via ${data.closeout.followup_channel || "—"}`,
  );
  if (data.closeout.handoff_needed === "Yes") lines.push(`Handoff decision: ${data.closeout.handoff_destination || "—"} · ${data.closeout.handoff_urgency || "—"} · consent ${data.closeout.consent_status || "—"} · ${data.closeout.handoff_reason || "—"}`);
  return lines.join("\n");
}

export function dueCoachScreenings(
  pathways: string[],
  assessments: { marker: string; next_review_date: string | null }[],
  today: string,
) {
  const latest = new Map<string, { next_review_date: string | null }>();
  for (const assessment of assessments) if (!latest.has(assessment.marker)) latest.set(assessment.marker, assessment);
  const due = new Set<MarkerKey>();
  const applicable = applicableMarkerKeys(pathways, latest.keys());
  for (const marker of applicable) {
    const result = latest.get(marker);
    if (!result) {
      due.add(marker);
      continue;
    }
    if (result?.next_review_date && result.next_review_date <= today) due.add(marker);
  }
  return [...due];
}
