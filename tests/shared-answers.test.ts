import { describe, it, expect } from "vitest";
import { carriedAnswers, SHARED_TOPICS, type OtherConsultAnswers } from "@/lib/shared-answers";
import { consultQ } from "@/lib/consult-questions";

const doctorSaid = (pairs: [string, string][]): OtherConsultAnswers => ({
  label: "Medical consultation", completedAt: "2026-08-09T10:00:00Z", answers: pairs,
});

describe("carrying an answer across disciplines", () => {
  it("offers the doctor's sleep answer under the coach's sleep question", () => {
    const coachQ = ["Sleep — how many hours of sleep do you get on most days?"];
    const got = carriedAnswers(coachQ, [
      doctorSaid([["Sleep & recovery — sleep time, wake time, duration, quality, recovery", "11pm–5am, poor quality"]]),
    ]);
    expect(got.get(0)).toEqual([{
      from: "Medical consultation",
      asked: "Sleep & recovery — sleep time, wake time, duration, quality, recovery",
      answer: "11pm–5am, poor quality",
      at: "2026-08-09T10:00:00Z",
    }]);
  });

  it("carries nothing for a question no other bank asks", () => {
    const got = carriedAnswers(["Labs — HbA1c (% gly Hgb)"], [
      doctorSaid([["Sleep & recovery — sleep time, wake time, duration, quality, recovery", "fine"]]),
    ]);
    expect(got.size).toBe(0);
  });

  it("does not echo the identical question back at itself", () => {
    // Two clinicians can hold the same question text — a repeat consultation of
    // the same kind. Offering someone their own wording as "already asked" is
    // noise, not context.
    const q = "Current activity level";
    const got = carriedAnswers([q], [{ label: "Fitness assessment", completedAt: null, answers: [[q, "sedentary"]] }]);
    expect(got.size).toBe(0);
  });

  it("ignores blank answers — an unanswered question is not context", () => {
    const got = carriedAnswers(["Current activity level"], [
      doctorSaid([["Activity — current workout routine (type, frequency, intensity)", "   "]]),
    ]);
    expect(got.size).toBe(0);
  });

  it("keeps current routine and medical restriction apart", () => {
    // Both are filed under "Activity" and a similarity match would fuse them.
    // Putting "walks 20 minutes" under "any injury or restriction?" would be a
    // wrong answer against a safety question.
    const got = carriedAnswers(
      ["Injuries / limitations to note"],
      [doctorSaid([["Activity — current workout routine (type, frequency, intensity)", "walks 20 min daily"]])],
    );
    expect(got.size).toBe(0);
  });

  it("gathers the same topic from several colleagues at once", () => {
    const got = carriedAnswers(["Current activity level"], [
      doctorSaid([["Activity — current workout routine (type, frequency, intensity)", "nothing regular"]]),
      { label: "Coach session", completedAt: null, answers: [["Activity — how many days in a week are you active?", "two"]] },
    ]);
    expect(got.get(0)?.map((c) => c.from)).toEqual(["Medical consultation", "Coach session"]);
  });

  it("indexes against the list it was given, so sex filtering can't misalign it", () => {
    const questions = ["Labs — HbA1c (% gly Hgb)", "Current activity level"];
    const got = carriedAnswers(questions, [
      doctorSaid([["Activity — current workout routine (type, frequency, intensity)", "nothing regular"]]),
    ]);
    expect(got.has(0)).toBe(false);
    expect(got.has(1)).toBe(true);
  });
});

describe("the topic map itself", () => {
  it("names only questions that really exist in a bank", () => {
    // A typo here fails silently — the topic just never matches — so the map is
    // checked against the real banks rather than trusted.
    const real = new Set<string>();
    for (const kind of ["Doctor", "Diet", "Trainer", "Coach"]) {
      for (const q of consultQ(kind).questions) real.add(q);
    }
    const missing = SHARED_TOPICS.flatMap((t) => t.questions.filter((q) => !real.has(q)));
    expect(missing).toEqual([]);
  });

  it("never files one question under two topics", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const t of SHARED_TOPICS) {
      for (const q of t.questions) {
        if (seen.has(q)) dupes.push(q);
        seen.add(q);
      }
    }
    expect(dupes).toEqual([]);
  });

  it("has no topic that only one bank asks — those can never carry", () => {
    // A single-question topic is dead weight: there is nothing to carry from.
    // sleep_apnoea is the deliberate exception; it is kept as the anchor for a
    // question the doctor's bank is expected to gain.
    const orphans = SHARED_TOPICS.filter((t) => t.questions.length < 2).map((t) => t.key);
    expect(orphans).toEqual(["sleep_apnoea", "medications", "tried_before"]);
  });
});
