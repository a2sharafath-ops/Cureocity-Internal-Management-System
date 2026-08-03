import { describe, it, expect } from "vitest";
import { deriveFlags, labsFromAnswers } from "@/lib/auto-flags";

const texts = (s: { text: string }[]) => s.map((x) => x.text).join(" | ");

describe("vitals thresholds", () => {
  it("flags a hypertensive emergency as critical", () => {
    const s = deriveFlags({ vitals: { systolic: 184, diastolic: 112 } });
    expect(s[0].severity).toBe("critical");
    expect(s[0].text).toMatch(/severely elevated/i);
  });

  it("flags stage-1 hypertension as a warning, not critical", () => {
    const s = deriveFlags({ vitals: { systolic: 145, diastolic: 92 } });
    expect(s[0].severity).toBe("warning");
  });

  it("stays quiet on a normal reading", () => {
    expect(deriveFlags({ vitals: { systolic: 124, diastolic: 80, pulse: 78, spo2: 98, temp_c: 36.8 } })).toEqual([]);
  });

  it("treats hypoxaemia as critical and borderline SpO2 as a warning", () => {
    expect(deriveFlags({ vitals: { spo2: 90 } })[0].severity).toBe("critical");
    expect(deriveFlags({ vitals: { spo2: 93 } })[0].severity).toBe("warning");
  });

  it("reads a low pulse as a note, since it may just be fitness", () => {
    const s = deriveFlags({ vitals: { pulse: 46 } });
    expect(s[0].severity).toBe("info");
    expect(s[0].text).toMatch(/well trained/i);
  });

  it("flags fever", () => {
    expect(texts(deriveFlags({ vitals: { temp_c: 38.4 } }))).toMatch(/febrile/i);
  });
});

describe("InBody thresholds", () => {
  it("flags obese BMI and underweight BMI", () => {
    expect(texts(deriveFlags({ inbody: { bmi: 31.2 } }))).toMatch(/obese/i);
    expect(texts(deriveFlags({ inbody: { bmi: 17.4 } }))).toMatch(/underweight/i);
  });

  it("says nothing about a normal BMI", () => {
    expect(deriveFlags({ inbody: { bmi: 23.5 } })).toEqual([]);
  });

  it("applies sex-specific body-fat cut-offs", () => {
    expect(deriveFlags({ inbody: { bodyFat: 28 }, gender: "Male" }).length).toBe(1);
    expect(deriveFlags({ inbody: { bodyFat: 28 }, gender: "Female" }).length).toBe(0);
  });

  it("grades visceral fat", () => {
    expect(deriveFlags({ inbody: { visceral: 10 } })[0].severity).toBe("info");
    expect(deriveFlags({ inbody: { visceral: 16 } })[0].severity).toBe("warning");
    expect(deriveFlags({ inbody: { visceral: 6 } })).toEqual([]);
  });
});

describe("lab thresholds", () => {
  it("separates pre-diabetic from diabetic ranges", () => {
    expect(deriveFlags({ labs: { glucose: 108 } })[0].severity).toBe("warning");
    expect(deriveFlags({ labs: { glucose: 140 } })[0].severity).toBe("critical");
    expect(deriveFlags({ labs: { hba1c: 6.0 } })[0].severity).toBe("warning");
    expect(deriveFlags({ labs: { hba1c: 7.1 } })[0].severity).toBe("critical");
  });

  it("never states a diagnosis — only the observation", () => {
    const s = deriveFlags({ labs: { glucose: 140, hba1c: 7.1 } });
    expect(texts(s)).toMatch(/confirm/i);
    expect(texts(s)).not.toMatch(/\bis diabetic\b|\bhas diabetes\b/i);
  });

  it("uses sex-specific HDL references", () => {
    expect(deriveFlags({ labs: { hdl: 45 }, gender: "Male" })).toEqual([]);
    expect(deriveFlags({ labs: { hdl: 45 }, gender: "Female" }).length).toBe(1);
  });

  it("grades triglycerides and hsCRP", () => {
    expect(deriveFlags({ labs: { triglycerides: 168 } })[0].severity).toBe("info");
    expect(deriveFlags({ labs: { triglycerides: 240 } })[0].severity).toBe("warning");
    expect(deriveFlags({ labs: { hscrp: 4.2 } })[0].severity).toBe("warning");
    expect(deriveFlags({ labs: { hscrp: 1.8 } })).toEqual([]);
  });
});

describe("labsFromAnswers", () => {
  const answers: [string, string][] = [
    ["Labs — fasting glucose (mg/dL)", "96"],
    ["Labs — HbA1c (% gly Hgb)", "5.5"],
    ["Labs — total cholesterol (mg/dL)", "192 mg/dL"],
    ["Labs — HDL-c (mg/dL)", "41"],
    ["Labs — triglycerides (mg/dL)", "168"],
    ["Labs — hsCRP (mg/L)", "1.8"],
    ["Primary goal / reason for visit", "Fat loss"],
  ];

  it("reads the values, ignoring units the clinician typed", () => {
    const l = labsFromAnswers(answers);
    expect(l).toMatchObject({ glucose: 96, hba1c: 5.5, cholesterol: 192, hdl: 41, triglycerides: 168, hscrp: 1.8 });
  });

  it("returns nulls when the labs weren't answered", () => {
    expect(labsFromAnswers([["Primary goal / reason for visit", "Fat loss"]]).glucose).toBeNull();
  });

  it("end-to-end: Sha's real answers raise exactly the borderline items", () => {
    const s = deriveFlags({ labs: labsFromAnswers(answers), gender: "Male" });
    // HDL 41 is fine for a man; glucose 96 and HbA1c 5.5 are normal.
    expect(texts(s)).toMatch(/Triglycerides 168/);
    expect(texts(s)).not.toMatch(/glucose|HbA1c|HDL/i);
  });
});

describe("ordering", () => {
  it("puts the most serious first so it can't be missed", () => {
    const s = deriveFlags({
      vitals: { systolic: 186, diastolic: 114, pulse: 104 },
      inbody: { visceral: 10 },
      labs: { glucose: 140 },
    });
    expect(s[0].severity).toBe("critical");
    expect(s[s.length - 1].severity).toBe("info");
  });
});
