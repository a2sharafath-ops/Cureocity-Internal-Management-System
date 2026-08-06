import { describe, it, expect } from "vitest";
import {
  mifflinStJeor, estimateTee, activityFactor, bmiFrom, waistHipFrom, fatMassFrom,
  ageOn, answerTo, stressFrom, draftAssessment, assessmentGaps, ACTIVITY_FACTORS,
} from "@/lib/diet-assessment";

// The real figures from the issued assessment, used as the fixture throughout.
const ARUN = { dob: "1990-08-22", gender: "MALE", height: 176.5, weight: 71.1 };
const ON = new Date("2026-07-21T00:00:00Z");

describe("ageOn", () => {
  it("matches the age on the day the document was issued", () => {
    expect(ageOn(ARUN.dob, ON)).toBe(35);
  });
  it("does not count a birthday that hasn't happened yet", () => {
    expect(ageOn("1990-12-31", new Date("2026-07-21T00:00:00Z"))).toBe(35);
    expect(ageOn("1990-07-20", new Date("2026-07-21T00:00:00Z"))).toBe(36);
  });
  it("returns null for a missing or nonsense date", () => {
    expect(ageOn(null)).toBeNull();
    expect(ageOn("not a date")).toBeNull();
  });
});

describe("mifflinStJeor", () => {
  it("computes a male BMR", () => {
    // 10(71.1) + 6.25(176.5) − 5(35) + 5
    expect(mifflinStJeor("MALE", 71.1, 176.5, 35)).toBe(1644);
  });
  it("computes a female BMR with the −161 constant", () => {
    // 10(60) + 6.25(162) − 5(30) − 161 = 1301.5
    expect(mifflinStJeor("Female", 60, 162, 30)).toBe(1302);
  });
  it("returns null rather than guessing when an input is missing", () => {
    expect(mifflinStJeor("MALE", null, 176.5, 35)).toBeNull();
    expect(mifflinStJeor("MALE", 71.1, null, 35)).toBeNull();
    expect(mifflinStJeor("MALE", 71.1, 176.5, null)).toBeNull();
  });
});

describe("estimateTee", () => {
  it("reproduces the issued document from the MEASURED bmr", () => {
    // The InBody said 1500; the sheet's TEE is 1800 — sedentary, ×1.2.
    expect(estimateTee(1500, "Sedentary")).toBe(1800);
  });
  it("applies each activity factor", () => {
    expect(estimateTee(1500, "Lightly active")).toBe(2050);
    expect(estimateTee(1500, "Very active")).toBe(2600);
  });
  it("rounds to the nearest 50 — nobody has calorie precision", () => {
    expect(estimateTee(1644, "Sedentary") % 50).toBe(0);
  });
  it("says nothing without a bmr or an activity level", () => {
    expect(estimateTee(null, "Sedentary")).toBeNull();
    expect(estimateTee(1500, null)).toBeNull();
    expect(estimateTee(1500, "jogging a bit")).toBeNull();
  });
});

describe("activityFactor", () => {
  it("is case and space tolerant — the label comes from a dropdown a human edits", () => {
    expect(activityFactor("  sedentary ")).toBe(1.2);
    expect(activityFactor("LIGHTLY ACTIVE")).toBe(1.375);
  });
  it("covers the five standard bands", () => {
    expect(ACTIVITY_FACTORS).toHaveLength(5);
  });
});

describe("derived body figures", () => {
  it("computes BMI matching the issued sheet", () => {
    expect(bmiFrom(71.1, 176.5)).toBe(22.8);
  });
  it("computes the waist–hip ratio matching the issued sheet", () => {
    expect(waistHipFrom(97, 100)).toBe(0.97);
  });
  it("computes fat mass matching the issued sheet", () => {
    // 71.1 kg at 26.4% → 18.8 kg
    expect(fatMassFrom(71.1, 26.4)).toBe(18.8);
  });
  it("returns null rather than zero when a figure is missing", () => {
    expect(bmiFrom(null, 176.5)).toBeNull();
    expect(waistHipFrom(97, null)).toBeNull();
    expect(fatMassFrom(71.1, null)).toBeNull();
  });
});

describe("answerTo", () => {
  const answers: [string, string][] = [
    ["Water intake", "~1.5 ltr /day"],
    ["Food aversions or dislikes", "Pumpkin, carrot, yam"],
    ["Family history of metabolic diseases (diabetes, hypertension, obesity)", "Father — diabetes"],
    ["Cravings and comfort foods", "   "],
  ];
  it("matches on the question, not a position", () => {
    expect(answerTo(answers, /water intake/i)).toBe("~1.5 ltr /day");
    expect(answerTo(answers, /family history/i)).toBe("Father — diabetes");
  });
  it("skips a blank answer rather than returning whitespace", () => {
    expect(answerTo(answers, /cravings/i)).toBeNull();
  });
  it("returns null when nothing matches", () => {
    expect(answerTo(answers, /nonexistent/i)).toBeNull();
  });
});

describe("stressFrom", () => {
  it("reads a level out of prose", () => {
    expect(stressFrom("Stress is generally moderate at work")).toBe("medium");
    expect(stressFrom("High stress, constant deadlines")).toBe("high");
    expect(stressFrom("Low — rarely stressed")).toBe("low");
  });
  it("declines to guess when the text says nothing about level", () => {
    expect(stressFrom("Goes for a walk to cope")).toBeNull();
    expect(stressFrom(null)).toBeNull();
  });
});

describe("draftAssessment", () => {
  const sources = {
    client: { dob: ARUN.dob, gender: ARUN.gender, occupation: "Business", height: ARUN.height, weight: ARUN.weight, conditions: "Nil", goals: ["Improve fitness", "Improve gut health"] },
    measurement: { weight: 71.1, bmi: 22.8, body_fat: 26.4, muscle_mass: 29.6, visceral_fat: 8, waist: 97, hip: 100, bmr: 1500 },
    allergies: ["Dust mite"],
    answers: [
      ["Water intake", "~1.5 ltr /day"],
      ["Food aversions or dislikes", "Pumpkin, carrot, yam, colocasia, banana, mackerel"],
      ["Family history of metabolic diseases (diabetes, hypertension, obesity)", "Father - Parkinson's, prostate cancer, diabetes"],
      ["Stress — stressful situations", "Medium, work pressure"],
    ] as [string, string][],
    dietitian: "Afya Sudharshanan",
    consultedOn: "2026-07-21",
  };

  it("prefers the InBody's MEASURED bmr over the estimate", () => {
    const a = draftAssessment(sources, ON);
    expect(a.bmr).toBe(1500);                         // not 1644
  });

  it("falls back to the estimate when the machine gave none", () => {
    const a = draftAssessment({ ...sources, measurement: { ...sources.measurement, bmr: null } }, ON);
    expect(a.bmr).toBe(1644);
  });

  it("carries across what the questionnaire already answered", () => {
    const a = draftAssessment(sources, ON);
    expect(a.hydration).toBe("~1.5 ltr /day");
    expect(a.food_dislikes).toMatch(/Pumpkin/);
    expect(a.family_history).toMatch(/Parkinson/);
    expect(a.stress_level).toBe("medium");
    expect(a.occupation).toBe("Business");
    expect(a.allergies).toBe("Dust mite");
  });

  it("computes the body figures", () => {
    const a = draftAssessment(sources, ON);
    expect(a.bmi).toBe(22.8);
    expect(a.fat_mass).toBe(18.8);
    expect(a.waist_hip).toBe(0.97);
  });

  it("leaves TEE empty until someone says how active they are", () => {
    const a = draftAssessment(sources, ON);
    expect(a.tee).toBeNull();
    expect(a.daily_activity).toBeNull();
  });
});

describe("assessmentGaps", () => {
  const base = draftAssessment({
    client: { dob: ARUN.dob, gender: "MALE", occupation: null, height: 176.5, weight: 71.1, conditions: null, goals: ["Improve fitness"] },
    measurement: { weight: 71.1, bmi: 22.8, body_fat: 26.4, muscle_mass: 29.6, visceral_fat: 8, waist: 97, hip: 100, bmr: 1500 },
    allergies: [], answers: [], dietitian: null, consultedOn: null,
  }, ON);

  it("names the activity level, because without it there is no calorie target", () => {
    expect(assessmentGaps(base).some((g) => /activity/i.test(g))).toBe(true);
  });

  it("is quiet once the gaps are filled", () => {
    expect(assessmentGaps({ ...base, daily_activity: "Sedentary" })).toEqual([]);
  });

  it("flags missing height and weight", () => {
    expect(assessmentGaps({ ...base, height: null }).some((g) => /Height and weight/.test(g))).toBe(true);
  });
});
