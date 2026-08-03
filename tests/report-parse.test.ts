import { describe, it, expect } from "vitest";
import { parseReportMarkers, reportSummaryFromText, parseReportDate } from "@/lib/report-parse";

// Shaped like a real Indian lab printout: name, result, unit, then the lab's own
// reference range on the same line.
const PANEL = `SRL Diagnostics — Comprehensive Health Panel
Patient: Sha    Age/Sex: 31/M
Collected on: 03/08/2026

TEST                      RESULT    UNIT      REFERENCE
Fasting Blood Sugar        96       mg/dL     70 - 99
HbA1c                      5.5      %         4.0 - 5.6
Total Cholesterol          192      mg/dL     < 200
HDL Cholesterol            41       mg/dL     > 40
LDL Cholesterol            118      mg/dL     < 100
Triglycerides              168      mg/dL     < 150
TSH                        6.8      uIU/mL    0.4 - 4.0
Vitamin D (25-OH)          18       ng/mL     30 - 100
Vitamin B12                340      pg/mL     200 - 900
Haemoglobin                14.2     g/dL      13 - 17
Creatinine                 0.9      mg/dL     0.7 - 1.3
SGPT (ALT)                 61       U/L       < 50
`;

describe("parseReportMarkers", () => {
  const hits = parseReportMarkers(PANEL, "Male");
  const by = (k: string) => hits.find((h) => h.key === k);

  it("reads the result, not the reference range printed beside it", () => {
    expect(by("glucose_f")?.value).toBe(96);
    expect(by("chol")?.value).toBe(192);
    expect(by("tg")?.value).toBe(168);
  });

  it("classifies each marker against the usual adult range", () => {
    expect(by("glucose_f")?.status).toBe("normal");
    expect(by("tg")?.status).toBe("high");
    expect(by("ldl")?.status).toBe("high");
    expect(by("tsh")?.status).toBe("high");
    expect(by("vitd")?.status).toBe("low");
    expect(by("alt")?.status).toBe("high");
    expect(by("hb")?.status).toBe("normal");
  });

  it("applies sex-specific ranges", () => {
    // HDL 41 passes the male cut-off (40) but not the female one (50).
    expect(parseReportMarkers(PANEL, "Male").find((h) => h.key === "hdl")?.status).toBe("normal");
    expect(parseReportMarkers(PANEL, "Female").find((h) => h.key === "hdl")?.status).toBe("low");
  });

  it("records each marker once", () => {
    expect(hits.length).toBe(new Set(hits.map((h) => h.key)).size);
  });

  it("finds nothing in an unrelated document", () => {
    expect(parseReportMarkers("Invoice INV-004 — Membership renewal ₹35,000")).toEqual([]);
  });
});

describe("parseReportDate", () => {
  it("reads the collection date, day-first", () => {
    expect(parseReportDate(PANEL)).toBe("2026-08-03");
  });
  it("handles other printed formats", () => {
    expect(parseReportDate("Report date: 2026-08-03")).toBe("2026-08-03");
    expect(parseReportDate("Collected on 3 Aug 2026")).toBe("2026-08-03");
  });
});

describe("reportSummaryFromText", () => {
  const s = reportSummaryFromText(PANEL, "Male", "Blood panel")!;

  it("leads with what's outside the range", () => {
    expect(s).toMatch(/Outside the usual range/);
    expect(s).toMatch(/TSH 6\.8/);
    expect(s).toMatch(/Vitamin D 18 ng\/mL \(low\)/);
  });

  it("still lists what was normal, so the record shows what was tested", () => {
    expect(s).toMatch(/Within range/);
    expect(s).toMatch(/Fasting glucose 96/);
  });

  it("never states a diagnosis and admits the ranges vary", () => {
    expect(s).toMatch(/reference ranges vary by lab/i);
    expect(s).not.toMatch(/\bhypothyroid\b|\bdiagnos/i);
  });

  it("declines when too little is recognised", () => {
    expect(reportSummaryFromText("Just a scanned photo with no text", "Male")).toBeNull();
    expect(reportSummaryFromText("Haemoglobin 14.2 g/dL", "Male")).toBeNull(); // one marker only
  });
});

describe("parseReportDate — real-world headers", () => {
  it("prefers the draw date over the print date", () => {
    expect(parseReportDate("Sample drawn   : 28 Jul 2026\nReport date    : 30 Jul 2026")).toBe("2026-07-28");
  });
  it("is not fooled by the word SAMPLE in prose", () => {
    // A header that says "SAMPLE REPORT FOR SYSTEM TESTING" used to swallow the
    // anchor and return null even though a date was printed two lines down.
    expect(parseReportDate("MEDLAB\nSAMPLE REPORT FOR SYSTEM TESTING\nReport date: 30 Jul 2026")).toBe("2026-07-30");
  });
  it("reads day-first numeric dates", () => {
    expect(parseReportDate("Collected on: 03/08/2026")).toBe("2026-08-03");
  });
  it("returns null when there is no date at all", () => {
    expect(parseReportDate("Haemoglobin 14.6 g/dL")).toBeNull();
  });
});
