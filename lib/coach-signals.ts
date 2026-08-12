// What the Health Coach intake conversation should raise.
//
// The screening markers (lib/coach-markers.ts) are scored with validated instruments
// — PSS-10, PSQI, PAR-Q+ + IPAQ-SF, AUDIT-C + DAST-10, GAD-7 and PHQ-9. This file does NOT
// try to produce those scores from the conversation, and that is deliberate:
// "stress: high" is not a PSS-10 of 28, and writing a number into a clinical
// record because it feels about right is how a record stops being worth having.
//
// What the conversation CAN do is tell the coach two things the instruments
// won't:
//
//   • a red flag that changes what is safe to do today — a PAR-Q positive means
//     no exercise plan until a doctor has cleared it, whatever the IPAQ says;
//   • which instruments this particular client actually needs, so the coach runs
//     the two that matter rather than all six by rote.
//
// Everything here is a SUGGESTION. It appears in the same panel as the vitals
// and lab suggestions, and nothing reaches the record until the coach accepts
// it — the same rule lib/auto-flags.ts already works to.

import { COACH_Q } from "@/lib/consult-questions";
import { isAffirmative } from "@/lib/consult-conditions";
import { scaleValue } from "@/lib/answer-input";
import type { Suggestion } from "@/lib/auto-flags";

/** Answers as the console holds them: [question, answer] pairs. */
export type AnswerPairs = [string, string][];

const lookup = (pairs: AnswerPairs) => {
  const m = new Map(pairs.map(([q, a]) => [q, (a ?? "").trim()]));
  return (q: string) => m.get(q) ?? "";
};

/**
 * Read the intake and say what it raises.
 *
 * Ordered most-urgent first, because the panel is read top-down and the
 * cardiac question is the one that must not be scrolled past.
 */
export function coachSignals(pairs: AnswerPairs): Suggestion[] {
  const get = lookup(pairs);
  const yes = (q: string) => isAffirmative(get(q));
  const out: Suggestion[] = [];

  // --- safety ------------------------------------------------------------
  // PAR-Q positive. The activity marker's own rule is "any PAR-Q yes requires
  // medical clearance before coaching exercise" — this is that rule firing from
  // the conversation rather than waiting for the form to be run separately.
  if (yes(COACH_Q.cardiacRedFlag)) {
    out.push({
      severity: "critical", source: "Intake",
      text: "Chest pain, breathlessness or fainting during activity — medical clearance needed before any exercise plan (PAR-Q positive).",
    });
  }
  if (yes(COACH_Q.exerciseLimit)) {
    out.push({
      severity: "warning", source: "Intake",
      text: "Pain, injury or medical restriction during exercise — confirm the limits before prescribing activity.",
    });
  }
  // Snoring + choking + daytime sleepiness is the classic obstructive sleep
  // apnoea triad. A coach cannot diagnose it; they can stop treating it as a
  // sleep-hygiene problem and send it on.
  if (yes(COACH_Q.snoring)) {
    out.push({
      severity: "warning", source: "Intake",
      text: "Snoring, choking or daytime sleepiness — screen for sleep apnoea; refer to the doctor rather than coaching sleep hygiene alone.",
    });
  }
  // Panic-type symptoms WITH avoidance is the combination that warrants a
  // psychologist. Either alone is common and does not.
  if (yes(COACH_Q.panic) && yes(COACH_Q.avoidance)) {
    out.push({
      severity: "warning", source: "Intake",
      text: "Panic-type symptoms with situational avoidance — offer a psychology referral.",
    });
  }

  // --- what to run next --------------------------------------------------
  if (/high/i.test(get(COACH_Q.stressLevel))) {
    out.push({ severity: "info", source: "Intake", text: "Stress described as high — run PSS-10 to set the Stress baseline." });
  }
  if (yes(COACH_Q.sleepTrouble) || !yes(COACH_Q.freshOnWaking)) {
    // "Not fresh on waking" is a negative answer to a positive question, so it
    // has to be tested the other way round — the one rule here that inverts.
    if (get(COACH_Q.sleepTrouble) || get(COACH_Q.freshOnWaking)) {
      out.push({ severity: "info", source: "Intake", text: "Sleep complaints reported — run PSQI to set the Sleep baseline." });
    }
  }
  if (yes(COACH_Q.alcohol)) out.push({ severity: "info", source: "Intake", text: "Alcohol use reported — run AUDIT-C and record the Substance marker." });
  if (yes(COACH_Q.tobacco)) out.push({ severity: "info", source: "Intake", text: "Tobacco use reported — run the Fagerström assessment and record the Substance marker." });
  if (yes(COACH_Q.worried) || yes(COACH_Q.panic)) {
    out.push({ severity: "info", source: "Intake", text: "Worry or panic symptoms reported — run GAD-7 to set the Anxiety baseline." });
  }
  if (yes(COACH_Q.emotionalLoad)) {
    out.push({ severity: "info", source: "Intake", text: "Something emotionally heavy disclosed — check in on it next session, and offer psychology support." });
  }
  if (yes(COACH_Q.openToPsych)) {
    out.push({ severity: "info", source: "Intake", text: "Client is open to speaking with a mental health professional — make the referral offer concrete." });
  }

  // --- how to pitch the plan ---------------------------------------------
  // Low readiness or low confidence is not a warning about the client, it is an
  // instruction to the coach: one very small habit, not a programme.
  const ready = scaleValue(get(COACH_Q.readiness));
  const confident = scaleValue(get(COACH_Q.confidenceScore));
  const low = [ready, confident].filter((v): v is number => v != null && v <= 3);
  if (low.length) {
    out.push({
      severity: "info", source: "Intake",
      text: `Readiness/confidence is low (${low.join(" and ")}/10) — start with one very small habit and build from there.`,
    });
  }

  return out;
}
