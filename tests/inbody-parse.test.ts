import { describe, it, expect } from "vitest";
import { parseInbodyText, inbodySummaryFromText, metricCount, parseInbodyDate } from "@/lib/inbody-parse";

// Text as extracted from a real InBody 770 result sheet PDF.
const REPORT = `InBody 770 · Body Composition Result Sheet
Client
Name: Sha
Gender / Age: Male / 31 yrs
Height: 165.0 cm
Test date: 03 Aug 2026, 6:40 pm IST
Body Composition Analysis
Body Fat Mass 17.9 kg 7.9 – 15.8 kg Above
Fat Free Mass 46.1 kg 44.6 – 54.5 kg Normal
Weight 64.0 kg 52.6 – 71.1 kg Normal
Obesity Analysis
BMI 23.5 kg/m² 18.5 – 24.9
Percent Body Fat (PBF) 28.0 % 10 – 20 %
Waist-Hip Ratio (WHR) 0.91 0.80 – 0.90
Visceral Fat Level 10 1 – 9
Additional
Basal Metabolic Rate (BMR) 1,462 kcal/day
Skeletal Muscle Mass (SMM) 25.8 kg
InBody Score 72 / 100
Target Weight 60.0 kg
Fat Control −6.0 kg
Muscle Control +1.5 kg`;

describe("parseInbodyText", () => {
  const m = parseInbodyText(REPORT);

  it("reads the core body-composition fields", () => {
    expect(m.weight).toBe(64);
    expect(m.bmi).toBe(23.5);
    expect(m.bodyFat).toBe(28);
    expect(m.smm).toBe(25.8);
    expect(m.fatMass).toBe(17.9);
    expect(m.ffm).toBe(46.1);
    expect(m.visceral).toBe(10);
    expect(m.whr).toBe(0.91);
  });

  it("handles thousands separators and the unicode minus InBody prints", () => {
    expect(m.bmr).toBe(1462);          // "1,462"
    expect(m.fatControl).toBe(-6);     // "−6.0" (U+2212)
    expect(m.muscleControl).toBe(1.5); // "+1.5"
  });

  it("captures score, target weight and test date", () => {
    expect(m.score).toBe(72);
    expect(m.targetWeight).toBe(60);
    expect(m.testDate).toContain("03 Aug 2026");
  });

  it("returns nothing rather than guessing on unrelated text", () => {
    expect(metricCount(parseInbodyText("Dear client, your appointment is confirmed."))).toBe(0);
  });
});

describe("parseInbodyDate", () => {
  it("reads the report's own test date, not today", () => {
    expect(parseInbodyDate(REPORT)).toBe("2026-08-03");
  });

  it("handles the date formats InBody devices print", () => {
    expect(parseInbodyDate("Test date: 2026-08-03")).toBe("2026-08-03");
    expect(parseInbodyDate("Test date: 3 August 2026")).toBe("2026-08-03");
    expect(parseInbodyDate("Test date: 03 Aug 2026, 6:40 pm")).toBe("2026-08-03");
    expect(parseInbodyDate("Test date: 03/08/2026")).toBe("2026-08-03"); // day-first
  });

  it("returns null rather than guessing a date", () => {
    expect(parseInbodyDate("no test date here")).toBeNull();
    expect(parseInbodyDate("Test date: sometime last week")).toBeNull();
  });
});

describe("inbodySummaryFromText", () => {
  it("summarises the report with its real numbers", () => {
    const s = inbodySummaryFromText(REPORT, "Male")!;
    expect(s).toContain("64 kg");
    expect(s).toContain("BMI 23.5");
    expect(s).toContain("28%");
    expect(s).toContain("visceral fat level 10");
  });

  it("spots the normal-BMI / high-body-fat pattern", () => {
    const s = inbodySummaryFromText(REPORT, "Male")!;
    expect(s).toMatch(/normal-weight, high-body-fat/i);
  });

  it("applies a sex-appropriate body-fat threshold", () => {
    // 28% is above target for a man, but within range for a woman.
    expect(inbodySummaryFromText(REPORT, "Male")).toMatch(/above target/i);
    expect(inbodySummaryFromText(REPORT, "Female")).toMatch(/within the expected range/i);
  });

  it("always marks the summary as auto-extracted and unreviewed", () => {
    expect(inbodySummaryFromText(REPORT, "Male")).toMatch(/Auto-extracted.*not yet reviewed/is);
  });

  it("declines when too little is recognised — never fabricate a summary", () => {
    expect(inbodySummaryFromText("Weight 64.0 kg", "Male")).toBeNull();
    expect(inbodySummaryFromText("no numbers here at all", "Male")).toBeNull();
  });
});
