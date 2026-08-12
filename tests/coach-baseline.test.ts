import { describe, expect, it } from "vitest";
import { BASELINE_MODULES, baselineProgress, questionIsVisible, sanitizeBaselineAnswers, triggeredBaselinePathways } from "../lib/coach-baseline";

describe("Health Coach 360 baseline", () => {
  it("does not require a conditional detail until its gate is positive", () => {
    const detail = BASELINE_MODULES.flatMap((module) => module.questions).find((question) => question.id === "activity_symptom_detail")!;
    expect(questionIsVisible(detail, { activity_symptom: "No" })).toBe(false);
    expect(questionIsVisible(detail, { activity_symptom: "Yes" })).toBe(true);
  });

  it("counts zero as a completed structured answer", () => {
    const progress = baselineProgress({ seated_hours: 0 });
    expect(progress.missing).not.toContain("seated_hours");
  });

  it("opens only pathways supported by recorded trigger answers", () => {
    expect(triggeredBaselinePathways({ uses_alcohol: "Yes", worry_concern: "Yes", activity_symptom: "No" }))
      .toEqual(["GAD-7 anxiety screening", "AUDIT-C alcohol screening"]);
  });

  it("does not silently label a symptom-free baseline as a screening trigger", () => {
    expect(triggeredBaselinePathways({ stress_source: "None", activity_symptom: "No", uses_alcohol: "No" })).toEqual([]);
  });

  it("rejects unknown options, out-of-range values and hidden stale answers", () => {
    expect(sanitizeBaselineAnswers({
      channel: "Carrier pigeon", confidence: 14, bed_time: "29:00",
      uses_alcohol: "No", heavy_daily_alcohol: "Yes", preferred_name: "  Sam  ",
    })).toEqual({ preferred_name: "Sam", uses_alcohol: "No" });
  });
});
