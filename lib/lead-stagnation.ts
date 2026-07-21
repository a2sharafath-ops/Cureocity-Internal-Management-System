// Leads that have stopped moving through the pipeline.
//
// Distinct from the other two lead sweeps, and the distinction is the point:
//
//   coverage  — nobody committed to a next step        (no next_follow_up)
//   idle      — a big deal went quiet                  (no contact, high value)
//   stagnant  — work is happening but nothing progresses
//
// The third is the one that catches a lead being politely nursed. Someone calls
// every week, logs a remark each time, sets the next callback — so coverage and
// idle both stay silent — and the lead has been in Discovery for two months.
// Activity is not progress, and only time-in-stage can tell them apart.

export type StageLead = {
  id: string;
  name: string;
  owner_id: string | null;
  stage: string | null;
  stage_changed_at: string | null;
  disqualified_at?: string | null;
};

/**
 * How long a lead may reasonably sit in each stage before it needs a decision.
 *
 * These are patience budgets, not SLAs, and they are not uniform on purpose:
 *
 *   1-New Lead      short. An uncontacted enquiry decays fast.
 *   2-Discovery     the big middle. 519 of 847 open leads are here, so the
 *                   threshold has to be generous enough that the alert means
 *                   something when it fires.
 *   3-Product Match a recommendation is on the table; it should convert or die.
 *   4-Visit/Trial   shortest of all. They came in. If a visit hasn't closed
 *                   within a fortnight, something went wrong and nobody said.
 *   6-Nurture       explicitly the long grass. Months, not weeks — but not
 *                   forever, or Nurture becomes where leads go to be forgotten.
 */
export const STAGE_PATIENCE: Record<string, number> = {
  "1-New Lead": 5,
  "2-Discovery": 21,
  "3-Product Match": 14,
  "4-Visit/Trial": 14,
  "6-Nurture": 90,
};

/** Multiplier on the budget at which management is told as well as the owner. */
export const STAGNATION_ESCALATE = 2;

export const daysSince = (iso: string | null, todayISO: string): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso.slice(0, 10) + "T00:00:00Z");
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.parse(`${todayISO}T00:00:00Z`) - t) / 86_400_000);
};

/** Still moving through the pipeline: not won, not lost, not disqualified. */
export function isLive(l: StageLead): boolean {
  if (l.disqualified_at) return false;
  const s = l.stage ?? "";
  return s !== "LOST" && !s.startsWith("5");
}

export type StagnationVerdict = {
  status: "ok" | "stagnant" | "escalated";
  stage: string;
  daysInStage: number;
  budget: number;
  reason: string;
};

export function stagnationVerdict(l: StageLead, todayISO: string): StagnationVerdict | null {
  if (!isLive(l)) return null;

  const stage = l.stage ?? "";
  const budget = STAGE_PATIENCE[stage];
  // A stage with no budget (unknown or newly added) is not judged. Silence
  // beats guessing a threshold for a stage nobody has reasoned about.
  if (!budget) return null;

  // NULL means we have never observed this lead move — see 0086. Treating that
  // as "stuck since the beginning of time" would flag the entire back catalogue
  // on the strength of data we do not have.
  const daysInStage = daysSince(l.stage_changed_at, todayISO);
  if (daysInStage === null) return null;

  if (daysInStage < budget) {
    return { status: "ok", stage, daysInStage, budget, reason: "" };
  }

  const status = daysInStage >= budget * STAGNATION_ESCALATE ? "escalated" : "stagnant";
  return {
    status, stage, daysInStage, budget,
    reason: `${daysInStage} days in ${stage.replace(/^\d-/, "")} — expected to move within ${budget}`,
  };
}

export function stagnationTitle(l: StageLead, v: StagnationVerdict): string {
  return `Not moving — ${l.name}`;
}

export function stagnationBody(v: StagnationVerdict): string {
  return v.status === "escalated"
    ? `${v.reason}. More than twice the expected time; decide whether this is still live.`
    : `${v.reason}.`;
}

/** Per-stage counts, for a management view of where the pipeline clogs. */
export function stagnationByStage(leads: StageLead[], todayISO: string) {
  const out = new Map<string, { stagnant: number; escalated: number }>();
  for (const l of leads) {
    const v = stagnationVerdict(l, todayISO);
    if (!v || v.status === "ok") continue;
    const cur = out.get(v.stage) ?? { stagnant: 0, escalated: 0 };
    if (v.status === "escalated") cur.escalated++; else cur.stagnant++;
    out.set(v.stage, cur);
  }
  return out;
}
