// Whiteboard — the daily multi-disciplinary meeting.
//
// BluePrint answers "where is this client, based on blood work and three
// consultations?" once. The whiteboard asks the same question every day,
// against the same dataset, and records what the team decided to do about it.
//
// This module holds the pure parts: which clients the board should raise
// today, and how a tweaked score compares to the signed-off baseline.

import { BP_SCORES, type BpScores } from "@/lib/blueprint";

export const WB_DISCIPLINES = ["doctor", "dietitian", "trainer", "coach", "psych"] as const;
export type WbDiscipline = (typeof WB_DISCIPLINES)[number];

export type NoteKind = "insight" | "action" | "concern";

/** A per-score adjustment agreed in the meeting. */
export type ScoreTweak = { score?: number; note?: string };
export type ScoreTweaks = Record<string, ScoreTweak>;

export type CandidateInput = {
  id: string;
  name: string;
  /** signed-off BluePrint scores, if one exists */
  scores: BpScores | null;
  bloodSubmitted: boolean;
  blueprintGenerated: boolean;
  /** ISO date of the client's last completed session, if any */
  lastSession: string | null;
  /** sessions still on the calendar */
  upcoming: number;
  /** open concerns raised by any discipline */
  openConcerns: number;
  /** overdue follow-ups */
  overdueFollowups: number;
  /** ISO date this client was last discussed on a whiteboard */
  lastDiscussed: string | null;
};

export type Candidate = { id: string; name: string; reason: string; weight: number };

/**
 * Which clients should the team look at today, and why.
 *
 * Ordered by how much attention they need. A client already discussed today is
 * excluded; one discussed recently is de-prioritised so the board rotates
 * rather than fixating on the same few people.
 */
export function boardCandidates(clients: CandidateInput[], today: string): Candidate[] {
  const out: Candidate[] = [];

  for (const c of clients) {
    if (c.lastDiscussed === today) continue;

    const reasons: string[] = [];
    let weight = 0;

    // A low score is the strongest signal — that's what the meeting is for.
    const low = BP_SCORES
      .map((s) => ({ label: s.label, v: c.scores?.[s.key] }))
      .filter((s) => typeof s.v === "number" && (s.v as number) < 40);
    if (low.length) {
      reasons.push(`${low.length} score${low.length === 1 ? "" : "s"} needing attention (${low.slice(0, 2).map((l) => l.label).join(", ")}${low.length > 2 ? "…" : ""})`);
      weight += 40 + low.length * 5;
    }

    if (c.openConcerns) { reasons.push(`${c.openConcerns} open concern${c.openConcerns === 1 ? "" : "s"}`); weight += 25 * c.openConcerns; }
    if (c.overdueFollowups) { reasons.push(`${c.overdueFollowups} overdue follow-up${c.overdueFollowups === 1 ? "" : "s"}`); weight += 20 * c.overdueFollowups; }
    if (c.bloodSubmitted && !c.blueprintGenerated) { reasons.push("blood report in, BluePrint not generated"); weight += 30; }
    if (!c.upcoming && c.lastSession) { reasons.push("nothing booked"); weight += 15; }

    // gone quiet — 21 days without a completed session
    if (c.lastSession && daysBetween(c.lastSession, today) >= 21) {
      reasons.push(`no session for ${daysBetween(c.lastSession, today)} days`);
      weight += 25;
    }

    if (!reasons.length) continue;

    // rotate: someone seen in the last week matters less today
    if (c.lastDiscussed) {
      const gap = daysBetween(c.lastDiscussed, today);
      if (gap < 7) weight = Math.round(weight * (gap / 7));
    }

    out.push({ id: c.id, name: c.name, reason: reasons.join(" · "), weight });
  }

  return out.sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
}

export function daysBetween(a: string, b: string): number {
  const d = (Date.parse(b) - Date.parse(a)) / 86400000;
  return Number.isFinite(d) ? Math.max(0, Math.round(d)) : 0;
}

/**
 * The meeting's working view of a client: signed-off scores with the day's
 * agreed adjustments laid over the top. `delta` is what changed, so the card
 * can show the movement rather than just the new number.
 */
export function effectiveScores(baseline: BpScores | null, tweaks: ScoreTweaks | null) {
  return BP_SCORES.map((s) => {
    const base = typeof baseline?.[s.key] === "number" ? (baseline as BpScores)[s.key] : null;
    const t = tweaks?.[s.key];
    const tweaked = typeof t?.score === "number" ? t.score : null;
    return {
      key: s.key,
      label: s.label,
      domain: s.domain,
      baseline: base,
      value: tweaked ?? base,
      delta: tweaked != null && base != null ? tweaked - base : null,
      note: t?.note ?? null,
    };
  });
}

/** Only the scores the team actually moved — what to show in a summary. */
export function changedScores(baseline: BpScores | null, tweaks: ScoreTweaks | null) {
  return effectiveScores(baseline, tweaks).filter((s) => s.delta != null && s.delta !== 0);
}

/** Cards still to get through, for the board's progress meter. */
export function boardProgress(cards: { status: string }[]) {
  const done = cards.filter((c) => c.status === "discussed").length;
  return { done, total: cards.length, pct: cards.length ? Math.round((done / cards.length) * 100) : 0 };
}
