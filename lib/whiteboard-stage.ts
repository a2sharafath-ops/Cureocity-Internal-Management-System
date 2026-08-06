// Whiteboard staging — the "alive/dead + traffic-light stage + major alerts"
// layer the team walks through every working day.
//
// Pure functions only: given the flags already gathered for a client, decide
//   • alive  — do they have an active package (green) or not (dead / red)?
//   • stage  — green → yellow → orange → red → alarm-red, on a severity ladder
//   • alerts — the MAJOR items (SLA breach, open concern, overdue follow-up,
//              critical/low score) that force a "why + solution" from the
//              assigned person before they clear.
//
// The section component supplies the raw flags and resolves each alert's owning
// discipline to a real staff name; this module holds the decision logic so it
// can be reasoned about (and unit-tested) on its own.

import { BP_SCORES, type BpScores } from "@/lib/blueprint";

export const STAGES = ["green", "yellow", "orange", "red", "alarm"] as const;
export type StageKey = (typeof STAGES)[number];

/** Ordinal so stages can be compared / sorted (higher = worse). */
export const STAGE_RANK: Record<StageKey, number> = { green: 0, yellow: 1, orange: 2, red: 3, alarm: 4 };

export const STAGE_META: Record<StageKey, { label: string; dot: string; bg: string; text: string; border: string }> = {
  green:  { label: "On track",      dot: "#16a34a", bg: "rgba(22,163,74,0.10)",  text: "#15803d", border: "rgba(22,163,74,0.35)" },
  yellow: { label: "Watch",         dot: "#eab308", bg: "rgba(234,179,8,0.12)",  text: "#a16207", border: "rgba(234,179,8,0.40)" },
  orange: { label: "Needs action",  dot: "#f97316", bg: "rgba(249,115,22,0.12)", text: "#c2410c", border: "rgba(249,115,22,0.40)" },
  red:    { label: "Escalate",      dot: "#dc2626", bg: "rgba(220,38,38,0.10)",  text: "#b91c1c", border: "rgba(220,38,38,0.40)" },
  alarm:  { label: "Alarm",         dot: "#7f1d1d", bg: "rgba(127,29,29,0.14)",  text: "#7f1d1d", border: "rgba(127,29,29,0.55)" },
};

export type AlertKind = "sla" | "concern" | "followup" | "score";
export type AlertSeverity = "orange" | "red" | "alarm";

/** A single major alert on a client — the thing the assigned person answers. */
export type WbAlert = {
  key: string;               // stable per (client, alert): sla | concern:<id> | followup:<id> | score:<key>
  kind: AlertKind;
  label: string;             // one line shown on the board
  detail?: string;           // extra context (concern body, score value…)
  severity: AlertSeverity;
  discipline: string | null; // owning discipline (doctor|dietitian|trainer|coach|psychologist)
};

export type StageInput = {
  scores: BpScores | null;
  /** care-turnaround / protocol SLA breached, and which protocol */
  slaBreached?: boolean;
  slaProtocol?: string | null;              // "blueprint" | "comprehensive" | …
  openConcerns: { id: string; body: string; role: string | null }[];
  overdueFollowups: { id: string; label: string }[];
  /** minor signals — nudge to yellow, not a forced alert */
  nothingBooked?: boolean;
  daysQuiet?: number;                        // days since last completed session
};

import { UNOWNED_CONCERN_DISCIPLINE } from "@/lib/work-owners";

/** Normalise the various discipline spellings to the client_assignments set. */
export function normDiscipline(d: string | null | undefined): string | null {
  if (!d) return null;
  const m: Record<string, string> = {
    doctor: "doctor", diet: "dietitian", dietitian: "dietitian",
    trainer: "trainer", coach: "coach", psych: "psychologist", psychologist: "psychologist",
  };
  return m[d] ?? null;
}

/** The major alerts on a client, worst-first. */
export function clientAlerts(i: StageInput): WbAlert[] {
  const out: WbAlert[] = [];

  if (i.slaBreached) {
    // A blueprint breach is a doctor's; comprehensive/PT is coordinated by the coach.
    const disc = i.slaProtocol === "blueprint" ? "doctor" : "coach";
    out.push({ key: "sla", kind: "sla", label: "Care turnaround overdue", detail: i.slaProtocol ? `${i.slaProtocol} protocol` : undefined, severity: "red", discipline: disc });
  }

  for (const c of i.openConcerns) {
    // A concern raised as "general", or against a role this app doesn't map,
    // used to resolve to null — an orange alert on the board that nobody was
    // asked to answer. The Health Coach owns the client relationship, so it
    // falls to them by default.
    out.push({ key: `concern:${c.id}`, kind: "concern", label: "Open concern", detail: c.body, severity: "orange", discipline: normDiscipline(c.role) ?? UNOWNED_CONCERN_DISCIPLINE });
  }

  for (const f of i.overdueFollowups) {
    out.push({ key: `followup:${f.id}`, kind: "followup", label: "Overdue follow-up", detail: f.label, severity: "orange", discipline: "coach" });
  }

  // Critical / very low BluePrint scores.
  if (i.scores) {
    for (const s of BP_SCORES) {
      const v = i.scores[s.key];
      if (typeof v !== "number") continue;
      if (v < 20) out.push({ key: `score:${s.key}`, kind: "score", label: `Critical score — ${s.label}`, detail: `${v}/100`, severity: "alarm", discipline: "doctor" });
      else if (v < 40) out.push({ key: `score:${s.key}`, kind: "score", label: `Low score — ${s.label}`, detail: `${v}/100`, severity: "red", discipline: "doctor" });
    }
  }

  const rank = { orange: 0, red: 1, alarm: 2 };
  return out.sort((a, b) => rank[b.severity] - rank[a.severity]);
}

/** The traffic-light stage for a client, from their alerts + minor signals. */
export function clientStage(alerts: WbAlert[], i: StageInput): StageKey {
  if (alerts.some((a) => a.severity === "alarm")) return "alarm";
  const reds = alerts.filter((a) => a.severity === "red").length;
  const oranges = alerts.filter((a) => a.severity === "orange").length;
  if (reds >= 1) return "red";
  // two or more moderate items stack up to an escalation.
  if (oranges >= 2) return "red";
  if (oranges >= 1) return "orange";

  // No major alert — look for minor signals that warrant a watch.
  let minor = false;
  if (i.scores) {
    for (const s of BP_SCORES) {
      const v = i.scores[s.key];
      if (typeof v === "number" && v >= 40 && v < 60) { minor = true; break; }
    }
  }
  if (i.nothingBooked) minor = true;
  if ((i.daysQuiet ?? 0) >= 21) minor = true;
  return minor ? "yellow" : "green";
}

/** Convenience: alerts + stage together. */
export function stageClient(i: StageInput): { alerts: WbAlert[]; stage: StageKey } {
  const alerts = clientAlerts(i);
  return { alerts, stage: clientStage(alerts, i) };
}
