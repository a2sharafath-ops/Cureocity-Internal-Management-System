import { describe, expect, it } from "vitest";
import {
  applicableMarkerKeys, MARKER_BY_KEY, markerNextReviewDate, markerOverdueDays,
} from "@/lib/coach-markers";
import { MARKER_BASELINE_GRACE_DAYS } from "@/lib/work-owners";

const TODAY = "2026-08-09";

describe("conditional Health Coach screening applicability", () => {
  it("does not chase instruments that a symptom-free baseline did not trigger", () => {
    expect(applicableMarkerKeys([], [])).toEqual(new Set());
  });

  it("maps baseline pathways to their approved instruments without duplicates", () => {
    expect(applicableMarkerKeys([
      "GAD-7 anxiety screening",
      "AUDIT-C alcohol screening",
      "Fagerström nicotine screening",
    ], [])).toEqual(new Set(["anxiety", "substance"]));
  });

  it("keeps a clinician-started instrument applicable for its recorded follow-up", () => {
    expect(applicableMarkerKeys([], ["nutrition"])).toEqual(new Set(["nutrition"]));
  });
});

describe("first applicable screening grace", () => {
  const dueForTriggeredStress = (sinceStart: number) => {
    if (sinceStart < MARKER_BASELINE_GRACE_DAYS) return null;
    return markerOverdueDays(
      MARKER_BY_KEY.stress,
      undefined,
      TODAY,
      sinceStart - MARKER_BASELINE_GRACE_DAYS,
    );
  };

  it("stays quiet through the grace week", () => {
    for (let day = 0; day < MARKER_BASELINE_GRACE_DAYS; day += 1) {
      expect(dueForTriggeredStress(day), `day ${day}`).toBeNull();
    }
  });

  it("becomes overdue only after the grace date", () => {
    expect(dueForTriggeredStress(MARKER_BASELINE_GRACE_DAYS)).toBe(0);
    expect(dueForTriggeredStress(MARKER_BASELINE_GRACE_DAYS + 3)).toBe(3);
  });
});

describe("instrument-specific next-review policy", () => {
  it("uses weekly reviews in month one and biweekly reviews afterward", () => {
    expect(markerNextReviewDate(MARKER_BY_KEY.stress, "2026-08-01", null, "warn")).toBe("2026-08-08");
    expect(markerNextReviewDate(MARKER_BY_KEY.stress, "2026-09-05", "2026-08-01", "good")).toBe("2026-09-19");
  });

  it("uses the documented nutrition, substance and poor-sleep intervals", () => {
    expect(markerNextReviewDate(MARKER_BY_KEY.nutrition, "2026-08-01", null, "warn")).toBe("2026-09-12");
    expect(markerNextReviewDate(MARKER_BY_KEY.substance, "2026-08-01", null, "good")).toBe("2026-08-15");
    expect(markerNextReviewDate(MARKER_BY_KEY.sleep, "2026-08-01", null, "bad")).toBe("2026-08-29");
  });

  it("leaves PHQ-9 timing to the recorded clinical plan", () => {
    expect(markerNextReviewDate(MARKER_BY_KEY.mood, "2026-08-01", null, "warn")).toBeNull();
    expect(markerNextReviewDate(MARKER_BY_KEY.mood, "2026-08-01", null, "warn", "2026-08-22")).toBe("2026-08-22");
  });

  it("uses the persisted next-review date as the alert source of truth", () => {
    expect(markerOverdueDays(MARKER_BY_KEY.stress, {
      marker: "stress", date: "2026-08-01", tone: "good", band: "Low", next_review_date: "2026-08-08",
    }, TODAY)).toBe(1);
    expect(markerOverdueDays(MARKER_BY_KEY.mood, {
      marker: "mood", date: "2026-08-01", tone: "good", band: "Minimal", next_review_date: null,
    }, TODAY)).toBeNull();
  });
});
