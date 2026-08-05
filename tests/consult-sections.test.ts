import { describe, it, expect } from "vitest";
import { sectionsFor, questionBody, answeredIn } from "@/lib/consult-sections";
import { CONSULT_QUESTIONS } from "@/lib/consult-questions";

const doctor = CONSULT_QUESTIONS.Doctor.questions;

describe("sectionsFor", () => {
  it("groups the real Doctor intake into readable sections", () => {
    const s = sectionsFor(doctor);
    expect(s.length).toBeGreaterThan(5);
    expect(s.length).toBeLessThan(doctor.length / 2);
    expect(s.map((x) => x.title)).toContain("Labs");
  });

  it("keeps every question exactly once, in the original order", () => {
    const s = sectionsFor(doctor);
    const flat = s.flatMap((x) => x.indices);
    expect(flat.length).toBe(doctor.length);
    expect(new Set(flat).size).toBe(doctor.length);
    // Indices must stay sorted within a section — a_i pairing depends on them.
    for (const sec of s) expect([...sec.indices].sort((a, b) => a - b)).toEqual(sec.indices);
  });

  it("leaves a short questionnaire ungrouped", () => {
    const s = sectionsFor(["A — one", "A — two", "B — three"]);
    expect(s).toHaveLength(1);
    expect(s[0].title).toBe("");
  });

  it("leaves an unprefixed questionnaire ungrouped", () => {
    const qs = Array.from({ length: 20 }, (_, i) => `Plain question ${i}?`);
    expect(sectionsFor(qs)).toHaveLength(1);
  });

  it("does not treat a long clause before a dash as a section name", () => {
    const qs = Array.from({ length: 14 }, (_, i) => `Do you currently smoke or vape at all — and if so, how much ${i}?`);
    expect(sectionsFor(qs)).toHaveLength(1);
  });

  it("puts unprefixed questions in General rather than dropping them", () => {
    const qs = [
      ...Array.from({ length: 8 }, (_, i) => `Labs — value ${i}`),
      ...Array.from({ length: 6 }, (_, i) => `Sleep — habit ${i}`),
      "How are you feeling today?",
    ];
    const s = sectionsFor(qs);
    expect(s.flatMap((x) => x.indices)).toHaveLength(qs.length);
    expect(s.find((x) => x.title === "General")?.indices).toEqual([14]);
  });
});

describe("questionBody", () => {
  it("strips the section prefix so the heading isn't repeated", () => {
    expect(questionBody("Labs — Fasting glucose", "Labs")).toBe("Fasting glucose");
  });
  it("leaves the text alone when the prefix isn't this section", () => {
    expect(questionBody("Labs — Fasting glucose", "Sleep")).toBe("Labs — Fasting glucose");
  });
  it("leaves an ungrouped question alone", () => {
    expect(questionBody("How did you sleep?", "")).toBe("How did you sleep?");
  });
});

describe("answeredIn", () => {
  it("counts only non-blank answers", () => {
    const sec = { title: "Labs", indices: [0, 2, 4] };
    expect(answeredIn(sec, ["yes", "x", "  ", "y", "no"])).toBe(2);
  });
});
