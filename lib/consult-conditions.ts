// Follow-up questions that only apply once an earlier answer opens them.
//
// A questionnaire written as a flat list asks everybody everything. In the
// Health Coach intake that produced its own small insult: a client who neither
// smokes nor drinks was still asked "how ready are you to cut down or stop, on
// a scale of 1 to 10". Six of the eight substance questions are like that, and
// the coach either skipped them awkwardly or the client wondered what had been
// assumed about them.
//
// So a question can name the question it hangs off. It stays out of the way
// until that one is answered in a way that makes it worth asking.
//
// Two deliberate choices:
//
//   • Hidden, not removed. A follow-up that has already been answered keeps its
//     answer if the parent changes — nothing a clinician typed is ever silently
//     destroyed — and the `a_<n>` / `q_<n>` pairs the form posts stay unbroken.
//   • Judged on the answer's *content*, not on a Yes/No control, because these
//     are free-text boxes in a conversation, not a form the client fills in.

/** What has to be true of the parent's answer for the follow-up to apply. */
export type QCondition = {
  /** Question text this hangs off. Several means "any one of these". */
  parent: string | string[];
  /**
   * "affirmative" — the parent's answer says yes / describes something.
   * "answered"    — any non-blank answer will do (e.g. "why that number?",
   *                 which only needs the number to exist, whatever it is).
   */
  when?: "affirmative" | "answered";
};

/** Question text → the condition that reveals it. Keyed by TEXT, not index:
 *  sex-specific filtering removes questions and would shift every index. */
export type QConditions = Record<string, QCondition>;

// Words that carry no information of their own in a denial. If an answer is
// made of nothing but these, it is a "no" however it was phrased.
const FILLER = new Set([
  "no", "not", "never", "nope", "nil", "none", "n", "na", "nothing", "zero", "0",
  "i", "im", "am", "do", "dont", "does", "doesnt", "did", "didnt", "have", "havent",
  "has", "hasnt", "at", "all", "really", "any", "anything", "ever", "issues", "issue",
  "problem", "problems", "concerns", "complaints", "much", "so", "far", "a", "the",
]);

const NEGATION_START = /^(no|not|never|nope|nil|none|n|na|zero)\b/;

// Apostrophes are dropped rather than split on, so "don't" stays one word and
// matches the filler list. Splitting gave "don" + "t", two words of apparent
// content, and "no I don't" came out as a yes.
const words = (s: string): string[] =>
  s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

/**
 * Does this answer mean "yes, there is something here"?
 *
 * Blank counts as no — an unanswered parent should not spring its follow-ups
 * open before the coach has got there.
 *
 * The hard part is that "no" is rarely said alone. "No, only socially" is a
 * drinker; "no I don't" is not. So the test is what SURVIVES the denial: strip
 * the words that only ever negate, and if real content is left, there is
 * something to follow up on.
 */
export function isAffirmative(answer: string | null | undefined): boolean {
  const raw = (answer ?? "").trim();
  if (!raw) return false;

  const ws = words(raw.replace(/\//g, " "));
  if (!ws.length) return false;

  const content = ws.filter((w) => !FILLER.has(w));
  // "No.", "Not really", "None at all", "Nil" — nothing but denial.
  if (!content.length) return false;

  // A denial with one word after it is still a denial: "no smoking", "never
  // alcohol". Two or more means they carried on and told you something:
  // "no, only socially", "not daily but every weekend".
  if (NEGATION_START.test(ws[0]) && content.length <= 1) return false;

  // A bare number: 0 is nothing, anything else is something. Covers the 1–10
  // readiness scales used as parents.
  if (content.length === 1 && /^\d+$/.test(content[0])) return Number(content[0]) > 0;

  return true;
}

/**
 * Which questions apply right now, given what has been answered so far.
 *
 * `answers` is indexed alongside `questions` — the same pairing the form posts.
 * A question with no condition always applies. A condition naming a parent that
 * isn't in this list (filtered out by sex, say) is treated as unmet, so a
 * follow-up can never outlive the question it depends on.
 */
export function visibleQuestions(
  questions: string[],
  answers: string[],
  conditions?: QConditions,
): boolean[] {
  if (!conditions) return questions.map(() => true);
  const answerOf = new Map<string, string>();
  questions.forEach((q, i) => answerOf.set(q, answers[i] ?? ""));

  return questions.map((q) => {
    const cond = conditions[q];
    if (!cond) return true;
    const parents = Array.isArray(cond.parent) ? cond.parent : [cond.parent];
    return parents.some((p) => {
      if (!answerOf.has(p)) return false;
      const a = answerOf.get(p) ?? "";
      return cond.when === "answered" ? a.trim() !== "" : isAffirmative(a);
    });
  });
}
