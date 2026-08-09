import { describe, it, expect } from "vitest";
import { isAffirmative, visibleQuestions } from "@/lib/consult-conditions";
import { consultQFor, CONSULT_QUESTIONS } from "@/lib/consult-questions";

describe("isAffirmative", () => {
  it("treats an unanswered question as not yet opening its follow-ups", () => {
    expect(isAffirmative("")).toBe(false);
    expect(isAffirmative("   ")).toBe(false);
    expect(isAffirmative(null)).toBe(false);
    expect(isAffirmative(undefined)).toBe(false);
  });

  it("reads the ways people actually say no", () => {
    for (const no of ["No", "no.", "NO", "nil", "None", "never", "nope", "not really",
                      "no I don't", "I don't", "none at all", "nothing", "n/a", "0"]) {
      expect(isAffirmative(no), no).toBe(false);
    }
  });

  it("reads the ways people actually say yes", () => {
    for (const yes of ["Yes", "yes, daily", "sometimes", "occasionally", "twice a week",
                       "socially", "2-3 times a month", "8"]) {
      expect(isAffirmative(yes), yes).toBe(true);
    }
  });

  it("keeps a denial that carries detail — the answer that matters most", () => {
    // "No, only socially" is a drinker. Hiding the follow-ups here would lose
    // exactly the client whose habit is worth a conversation.
    expect(isAffirmative("no, only socially")).toBe(true);
    expect(isAffirmative("not daily, but every weekend")).toBe(true);
    expect(isAffirmative("no cigarettes, only occasional beedi")).toBe(true);
  });

  it("still reads a one-word denial as a denial", () => {
    // "No smoking" is a no, even though a word follows the negation.
    expect(isAffirmative("no smoking")).toBe(false);
    expect(isAffirmative("never alcohol")).toBe(false);
  });

  it("treats a zero on a 1–10 scale as nothing", () => {
    expect(isAffirmative("0")).toBe(false);
    expect(isAffirmative("1")).toBe(true);
    expect(isAffirmative("10")).toBe(true);
  });
});

describe("visibleQuestions", () => {
  const qs = ["Do you smoke?", "How often?", "Do you drink?", "Anything else?"];
  const conds = {
    "How often?": { parent: "Do you smoke?" },
    "Anything else?": { parent: ["Do you smoke?", "Do you drink?"] },
  };

  it("shows everything when the questionnaire has no conditions", () => {
    expect(visibleQuestions(qs, ["", "", "", ""])).toEqual([true, true, true, true]);
  });

  it("keeps a follow-up hidden until its parent is answered", () => {
    expect(visibleQuestions(qs, ["", "", "", ""], conds)).toEqual([true, false, true, false]);
  });

  it("opens a follow-up when the parent says yes", () => {
    expect(visibleQuestions(qs, ["Yes, 10 a day", "", "", ""], conds)[1]).toBe(true);
  });

  it("keeps it shut when the parent says no", () => {
    expect(visibleQuestions(qs, ["No", "", "", ""], conds)[1]).toBe(false);
  });

  it("opens a shared follow-up when ANY of its parents qualifies", () => {
    expect(visibleQuestions(qs, ["No", "", "Yes", ""], conds)[3]).toBe(true);
    expect(visibleQuestions(qs, ["Yes", "", "No", ""], conds)[3]).toBe(true);
    expect(visibleQuestions(qs, ["No", "", "No", ""], conds)[3]).toBe(false);
  });

  it("'answered' opens on any reply, including a low score", () => {
    const c = { "Why?": { parent: "Confidence 1-10?", when: "answered" as const } };
    const two = ["Confidence 1-10?", "Why?"];
    expect(visibleQuestions(two, ["2", ""], c)[1]).toBe(true);
    expect(visibleQuestions(two, ["0", ""], c)[1]).toBe(true);   // still worth asking
    expect(visibleQuestions(two, ["", ""], c)[1]).toBe(false);
  });

  it("hides a follow-up whose parent was filtered out entirely", () => {
    // A follow-up must never outlive the question it depends on.
    expect(visibleQuestions(["How often?"], [""], conds)).toEqual([false]);
  });
});

describe("the Health Coach intake", () => {
  const coach = CONSULT_QUESTIONS.Coach;

  it("carries the whole flow, not a summary of it", () => {
    expect(coach.questions.length).toBeGreaterThan(80);
  });

  it("every condition names a question that exists", () => {
    // A typo here would hide a follow-up for ever, silently.
    const all = new Set(coach.questions);
    for (const [q, cond] of Object.entries(coach.conditions ?? {})) {
      expect(all.has(q), `follow-up missing: ${q}`).toBe(true);
      for (const p of (Array.isArray(cond.parent) ? cond.parent : [cond.parent])) {
        expect(all.has(p), `parent missing: ${p}`).toBe(true);
      }
    }
  });

  it("every section intro matches a real section heading", () => {
    const heads = new Set(coach.questions.map((q) => q.split(/\s+—\s+/)[0]));
    for (const title of Object.keys(coach.intros ?? {})) {
      expect(heads.has(title), `intro for unknown section: ${title}`).toBe(true);
    }
  });

  it("asks a man nothing about periods or menopause", () => {
    const male = consultQFor("Coach", "male").questions;
    expect(male.some((q) => /^Female health/.test(q))).toBe(false);
    expect(male.some((q) => /menopause|periods/i.test(q))).toBe(false);
  });

  it("asks a woman the cycle questions", () => {
    const female = consultQFor("Coach", "female").questions;
    expect(female.filter((q) => /^Female health/.test(q)).length).toBe(4);
  });

  it("asks everything when the client's sex isn't recorded", () => {
    // Better a redundant question than a silently skipped one.
    expect(consultQFor("Coach", null).questions.length).toBe(coach.questions.length);
  });

  it("leaves a non-smoking non-drinker out of the whole habit interrogation", () => {
    // The reason this feature exists: being asked "how ready are you to cut
    // down, 1 to 10" when you have never smoked reads as an accusation.
    const qs = consultQFor("Coach", "male").questions;
    const ans = qs.map((q) =>
      q === "Substance use — do you smoke or use tobacco in any form?" ? "No"
      : q === "Substance use — do you consume alcohol?" ? "No" : "");
    const vis = visibleQuestions(qs, ans, coach.conditions);
    const hidden = qs.filter((_, i) => !vis[i] && /^Substance use/.test(qs[i]));
    expect(hidden.length).toBe(6);
    expect(qs.filter((q, i) => vis[i] && /^Substance use/.test(q)).length).toBe(2);
  });

  it("keeps the sex filter and the condition map in step", () => {
    // consultQFor drops questions; a condition keyed by text must survive that.
    const female = consultQFor("Coach", "female");
    expect(female.conditions).toBe(coach.conditions);
    expect(female.intros).toBe(coach.intros);
  });
});
