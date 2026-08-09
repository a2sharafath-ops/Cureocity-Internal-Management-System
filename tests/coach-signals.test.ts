import { describe, it, expect } from "vitest";
import { coachSignals, type AnswerPairs } from "@/lib/coach-signals";
import { COACH_Q, CONSULT_QUESTIONS } from "@/lib/consult-questions";
import { optionsOf, selectedOption, withOption, scaleValue, YES_NO, SCALE_10 } from "@/lib/answer-input";

const pairs = (o: Record<string, string>): AnswerPairs => Object.entries(o);
const texts = (o: Record<string, string>) => coachSignals(pairs(o)).map((s) => s.text);

describe("coachSignals — safety", () => {
  it("says nothing at all before anything has been answered", () => {
    // An intake panel that shouts on an empty form is one people stop reading.
    expect(coachSignals([])).toEqual([]);
  });

  it("raises medical clearance on a PAR-Q positive, and puts it first", () => {
    const s = coachSignals(pairs({
      [COACH_Q.tobacco]: "Yes",
      [COACH_Q.cardiacRedFlag]: "Yes, once while climbing stairs",
    }));
    expect(s[0].severity).toBe("critical");
    expect(s[0].text).toMatch(/medical clearance/i);
  });

  it("does not raise it when they say no", () => {
    expect(texts({ [COACH_Q.cardiacRedFlag]: "No" })).toEqual([]);
  });

  it("sends the sleep apnoea triad to the doctor rather than coaching hygiene", () => {
    expect(texts({ [COACH_Q.snoring]: "Yes, my wife says I stop breathing" })
      .some((t) => /sleep apnoea/i.test(t))).toBe(true);
  });

  it("suggests psychology only when panic comes WITH avoidance", () => {
    const both = texts({ [COACH_Q.panic]: "Yes", [COACH_Q.avoidance]: "Yes" });
    expect(both.some((t) => /psychology referral/i.test(t))).toBe(true);

    const panicOnly = texts({ [COACH_Q.panic]: "Yes", [COACH_Q.avoidance]: "No" });
    expect(panicOnly.some((t) => /psychology referral/i.test(t))).toBe(false);
  });
});

describe("coachSignals — which instruments to run", () => {
  it("asks for PSS-10 only when stress is described as high", () => {
    expect(texts({ [COACH_Q.stressLevel]: "High" }).some((t) => /PSS-10/.test(t))).toBe(true);
    expect(texts({ [COACH_Q.stressLevel]: "Moderate" }).some((t) => /PSS-10/.test(t))).toBe(false);
    expect(texts({ [COACH_Q.stressLevel]: "Low" }).some((t) => /PSS-10/.test(t))).toBe(false);
  });

  it("asks for PSQI when sleep is broken, or when they wake unrefreshed", () => {
    expect(texts({ [COACH_Q.sleepTrouble]: "Yes, I wake at 3am" }).some((t) => /PSQI/.test(t))).toBe(true);
    // "Do you feel fresh when you wake up?" — "No" is the concerning answer.
    expect(texts({ [COACH_Q.freshOnWaking]: "No" }).some((t) => /PSQI/.test(t))).toBe(true);
    expect(texts({ [COACH_Q.freshOnWaking]: "Yes" }).some((t) => /PSQI/.test(t))).toBe(false);
  });

  it("asks for AUDIT-C on either habit, once", () => {
    const both = texts({ [COACH_Q.tobacco]: "Yes", [COACH_Q.alcohol]: "Yes" });
    expect(both.filter((t) => /AUDIT-C/.test(t)).length).toBe(1);
    expect(texts({ [COACH_Q.tobacco]: "No", [COACH_Q.alcohol]: "No" }).some((t) => /AUDIT-C/.test(t))).toBe(false);
  });

  it("counts a social drinker as a drinker", () => {
    expect(texts({ [COACH_Q.alcohol]: "no, only socially" }).some((t) => /AUDIT-C/.test(t))).toBe(true);
  });

  it("never invents an instrument score from the conversation", () => {
    // A PSS-10 of 28 derived from the word "high" would be a fabricated number
    // in a clinical record. Every rule asks for the instrument to be RUN.
    const all = texts({
      [COACH_Q.stressLevel]: "High", [COACH_Q.worried]: "Yes",
      [COACH_Q.tobacco]: "Yes", [COACH_Q.sleepTrouble]: "Yes",
    });
    for (const t of all) expect(t).not.toMatch(/score of \d|= ?\d+\/|scored \d/i);
  });
});

describe("coachSignals — how to pitch the plan", () => {
  it("tells the coach to go small when readiness or confidence is low", () => {
    const t = texts({ [COACH_Q.confidenceScore]: "2" });
    expect(t.some((x) => /one very small habit/i.test(x))).toBe(true);
  });

  it("stays quiet when they are ready and confident", () => {
    expect(texts({ [COACH_Q.readiness]: "8", [COACH_Q.confidenceScore]: "9" })).toEqual([]);
  });

  it("reports both numbers when both are low", () => {
    const t = texts({ [COACH_Q.readiness]: "3", [COACH_Q.confidenceScore]: "1" });
    expect(t.some((x) => x.includes("3 and 1/10"))).toBe(true);
  });

  it("reads the number even when the coach typed detail after it", () => {
    expect(scaleValue("7 — depends on the week")).toBe(7);
    expect(scaleValue("")).toBe(null);
    expect(scaleValue("quite low really")).toBe(null);
  });
});

describe("answer chips", () => {
  it("draws a scale as its numbers and a choice as its options", () => {
    expect(optionsOf(SCALE_10)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(optionsOf(YES_NO)).toEqual(["Yes", "No"]);
  });

  it("lights the chip matching an answer that was typed by hand", () => {
    expect(selectedOption("yes", ["Yes", "No"])).toBe("Yes");
    expect(selectedOption("No.", ["Yes", "No"])).toBe("No");
    expect(selectedOption("Yes — twice a week", ["Yes", "No"])).toBe("Yes");
    expect(selectedOption("maybe", ["Yes", "No"])).toBe(null);
    expect(selectedOption("", ["Yes", "No"])).toBe(null);
  });

  it("keeps the detail already typed when the chip changes", () => {
    expect(withOption("Yes — only at weddings", ["Yes", "No"], "No")).toBe("No — only at weddings");
    expect(withOption("", ["Yes", "No"], "Yes")).toBe("Yes");
  });

  it("does not swallow free text that was never chip-led", () => {
    expect(withOption("sometimes at night", ["Yes", "No"], "Yes")).toBe("Yes — sometimes at night");
  });

  it("clears the answer when the chosen chip is tapped again", () => {
    // A mis-tap should cost one tap, not a select-and-delete.
    expect(withOption("Yes", ["Yes", "No"], "Yes")).toBe("");
    expect(withOption("Yes — only socially", ["Yes", "No"], "Yes")).toBe("only socially");
  });
});

describe("the coach question bank's typed answers", () => {
  const coach = CONSULT_QUESTIONS.Coach;

  it("types every question it names, and names no question that doesn't exist", () => {
    const all = new Set(coach.questions);
    for (const q of Object.keys(coach.types ?? {})) {
      expect(all.has(q), `typed question missing from the bank: ${q}`).toBe(true);
    }
  });

  it("turns a real share of the intake into taps rather than typing", () => {
    expect(Object.keys(coach.types ?? {}).length).toBeGreaterThan(25);
  });

  it("gives every question the signal rules read a chip to answer with", () => {
    // A rule that reads free text where the coach was expected to tap is a rule
    // that silently never fires.
    for (const q of [COACH_Q.cardiacRedFlag, COACH_Q.snoring, COACH_Q.panic, COACH_Q.avoidance,
                     COACH_Q.tobacco, COACH_Q.alcohol, COACH_Q.stressLevel, COACH_Q.sleepTrouble,
                     COACH_Q.freshOnWaking, COACH_Q.readiness, COACH_Q.confidenceScore]) {
      expect(coach.types?.[q], q).toBeTruthy();
    }
  });
});
