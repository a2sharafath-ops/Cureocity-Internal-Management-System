// Grouping a questionnaire into sections.
//
// A Doctor intake is ~85 questions. Presented as one flat column it is a
// several-thousand-pixel scroll, which is a poor thing to navigate while a
// client is sitting opposite you talking.
//
// The question bank already carries the structure: most questions are written
// "Prenatal — Was the pregnancy planned?", "Labs — Fasting glucose". So the
// section is derived from the text rather than invented, and no question needs
// rewriting. Questions with no prefix collect under a "General" heading rather
// than being dropped or forced into a neighbour's section.

export type QSection = {
  /** Heading shown on the section and in the jump rail. */
  title: string;
  /** Indices into the ORIGINAL questions array — never renumber, because the
   *  answer for question i is posted as a_i and must stay paired with it. */
  indices: number[];
};

/** The em-dash separator the question bank uses. Hyphens are left alone: they
 *  appear mid-question ("Follow-up", "day-to-day") and would split wrongly. */
const SEP = /\s+—\s+/;

/** Prefixes long enough to be a sentence are not section names. "Do you smoke
 *  — and if so, how much?" is one question, not a "Do you smoke" section. */
const MAX_TITLE_WORDS = 4;
const MAX_TITLE_CHARS = 28;

function prefixOf(q: string): string | null {
  const at = q.search(SEP);
  if (at <= 0) return null;
  const head = q.slice(0, at).trim();
  if (!head || head.length > MAX_TITLE_CHARS) return null;
  if (head.split(/\s+/).length > MAX_TITLE_WORDS) return null;
  // A prefix ending in punctuation is a clause, not a label.
  if (/[?!.,;:]$/.test(head)) return null;
  return head;
}

/**
 * Group questions into ordered sections.
 *
 * Sections appear in the order their first question appears, so the clinical
 * order of the intake is preserved exactly — this only inserts headings, it
 * never reorders.
 *
 * Returns a single unnamed section when grouping wouldn't help: a short
 * questionnaire, or one where almost nothing carries a prefix. In that case
 * the caller renders the old flat list and no rail.
 */
export function sectionsFor(questions: string[], minToGroup = 12): QSection[] {
  const single = [{ title: "", indices: questions.map((_, i) => i) }];
  if (questions.length < minToGroup) return single;

  const order: string[] = [];
  const byTitle = new Map<string, number[]>();
  let prefixed = 0;

  questions.forEach((q, i) => {
    const p = prefixOf(q);
    if (p) prefixed++;
    const title = p ?? "General";
    if (!byTitle.has(title)) { byTitle.set(title, []); order.push(title); }
    byTitle.get(title)!.push(i);
  });

  // Grouping earns its keep only if most questions actually carry a prefix and
  // it produces a handful of sections rather than one per question.
  const sections = order.map((t) => ({ title: t, indices: byTitle.get(t)! }));
  if (prefixed < questions.length / 2) return single;
  if (sections.length < 2 || sections.length > questions.length / 2) return single;

  return sections;
}

/** The question text with its section prefix removed, so a heading and its
 *  questions don't both say "Labs". Falls back to the full text. */
export function questionBody(q: string, sectionTitle: string): string {
  if (!sectionTitle) return q;
  const at = q.search(SEP);
  if (at <= 0) return q;
  if (q.slice(0, at).trim() !== sectionTitle) return q;
  return q.slice(at).replace(SEP, "").trim() || q;
}

/** How many of a section's questions have an answer. */
export function answeredIn(section: QSection, answers: string[]): number {
  return section.indices.filter((i) => (answers[i] ?? "").trim()).length;
}
