import { describe, it, expect } from "vitest";
import { consultQ, consultQFor, applicableQuestions } from "@/lib/consult-questions";

describe("sex-specific questionnaire filtering", () => {
  const doctor = consultQ("Doctor").questions;

  it("the Doctor intake has female-only questions to filter", () => {
    expect(doctor.filter((q) => /^Female —/.test(q)).length).toBe(3);
  });

  it("hides female questions for a male client", () => {
    const q = consultQFor("Doctor", "Male").questions;
    expect(q.some((x) => /^Female —/.test(x))).toBe(false);
    expect(q.length).toBe(doctor.length - 3);
  });

  it("keeps female questions for a female client", () => {
    const q = consultQFor("Doctor", "Female").questions;
    expect(q.filter((x) => /^Female —/.test(x)).length).toBe(3);
    expect(q.length).toBe(doctor.length);
  });

  it("accepts short gender codes", () => {
    expect(consultQFor("Doctor", "m").questions.length).toBe(doctor.length - 3);
    expect(consultQFor("Doctor", "F").questions.length).toBe(doctor.length);
  });

  it("shows everything when gender is unknown — never silently skip a question", () => {
    for (const g of [null, undefined, "", "  ", "Other", "prefer not to say"]) {
      expect(consultQFor("Doctor", g as string | null).questions.length).toBe(doctor.length);
    }
  });

  it("preserves order, so answers stay aligned to their question", () => {
    const filtered = applicableQuestions(doctor, "Male");
    const expected = doctor.filter((x) => !/^Female —/.test(x));
    expect(filtered).toEqual(expected);
  });

  it("leaves questionnaires with no sex-specific items untouched", () => {
    for (const kind of ["Diet", "Trainer", "Coach", "Psychologist"]) {
      const base = consultQ(kind).questions;
      expect(consultQFor(kind, "Male").questions).toEqual(base);
      expect(consultQFor(kind, "Female").questions).toEqual(base);
    }
  });
});
