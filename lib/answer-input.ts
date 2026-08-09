// Fixed-choice answers that are still free text underneath.
//
// A third of the Health Coach intake is scales and yes/no questions, and every
// one of them was an empty textarea. Typing "Moderate" into a box while
// someone is talking is slower than tapping it, and what comes out is a field
// of near-misses — "mod", "moderate.", "Moderate " — that nothing downstream
// can read.
//
// But the answer must STAY text, because:
//
//   • it is stored as a [question, answer] pair and printed into the client's
//     summary, where "Yes — only at weddings" reads properly and a boolean
//     does not;
//   • the follow-up rules in lib/consult-conditions.ts judge the words;
//   • a conversation does not fit the options. "No, only socially" is the
//     answer that matters most, and a radio button cannot say it.
//
// So the chips are a fast way to write the FIRST word. Everything after the
// em-dash is whatever the coach adds, and it survives changing the chip.

export type QAnswerType =
  | { kind: "scale"; min: number; max: number }
  | { kind: "choice"; options: string[] };

/** Question text → how its answer is entered. Keyed by TEXT, like the
 *  conditions map, so sex filtering can drop questions without breaking it. */
export type QTypes = Record<string, QAnswerType>;

export const YES_NO: QAnswerType = { kind: "choice", options: ["Yes", "No"] };
export const SCALE_10: QAnswerType = { kind: "scale", min: 1, max: 10 };

/** The chips to draw for a question type. */
export function optionsOf(t: QAnswerType): string[] {
  if (t.kind === "choice") return t.options;
  return Array.from({ length: t.max - t.min + 1 }, (_, i) => String(t.min + i));
}

const SPLIT = /\s+—\s+/;

/**
 * Which chip is currently chosen, if any.
 *
 * Read from the answer's own first token rather than held in separate state —
 * an answer typed by hand ("yes, socially") lights the right chip, and an
 * answer restored from the record after a reload does too.
 */
export function selectedOption(answer: string, options: string[]): string | null {
  const head = (answer ?? "").split(SPLIT)[0]?.trim().replace(/[.,;:]$/, "") ?? "";
  if (!head) return null;
  return options.find((o) => o.toLowerCase() === head.toLowerCase()) ?? null;
}

/**
 * The answer after choosing a chip, keeping any detail already typed.
 *
 * Clicking the chip that is already chosen clears it, so a mis-tap is one tap
 * to undo rather than a value the coach has to select and delete.
 */
export function withOption(answer: string, options: string[], option: string): string {
  const parts = (answer ?? "").split(SPLIT);
  const hadChip = selectedOption(answer, options) !== null;
  const detail = (hadChip ? parts.slice(1) : parts).join(" — ").trim();
  if (selectedOption(answer, options) === option) return detail;   // toggle off
  return detail ? `${option} — ${detail}` : option;
}

/** The number a scale answer carries, or null. Used by the signal rules, which
 *  care that readiness is 2 rather than that the client said something. */
export function scaleValue(answer: string): number | null {
  const head = (answer ?? "").split(SPLIT)[0]?.trim() ?? "";
  const m = head.match(/^(\d{1,3})\b/);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}
