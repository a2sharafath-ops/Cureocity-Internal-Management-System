import { describe, expect, it } from "vitest";
import { INSTRUMENTS, instrumentIsComplete, visibleInstrumentItems } from "../lib/coach-instruments";

describe("health-coach screening instruments", () => {
  it("does not score a partially answered embedded instrument", () => {
    const gad = INSTRUMENTS.anxiety!;
    expect(instrumentIsComplete(gad, { g1: 2 }, "")).toBe(false);
  });

  it("requires an official external result for PSQI", () => {
    const psqi = INSTRUMENTS.sleep!;
    expect(instrumentIsComplete(psqi, {}, "")).toBe(false);
    expect(instrumentIsComplete(psqi, {}, "11")).toBe(true);
  });

  it("requires both PAR-Q+ outcome and all IPAQ quantities", () => {
    const activity = INSTRUMENTS.activity!;
    const answers = { vigDays: 0, vigMin: 0, modDays: 3, modMin: 20, walkDays: 5, walkMin: 30 };
    expect(instrumentIsComplete(activity, answers, "")).toBe(false);
    expect(instrumentIsComplete(activity, answers, "No follow-up required")).toBe(true);
    expect(instrumentIsComplete(activity, { ...answers, vigDays: 8 }, "No follow-up required")).toBe(false);
  });

  it("opens Fagerström items only when cigarette use is recorded", () => {
    const substance = INSTRUMENTS.substance!;
    expect(visibleInstrumentItems(substance, { n0: 0 }).some((item) => item.id === "n1")).toBe(false);
    expect(visibleInstrumentItems(substance, { n0: 1 }).some((item) => item.id === "n1")).toBe(true);
  });

  it("treats any positive PHQ-9 item 9 as a safety trigger", () => {
    const phq = INSTRUMENTS.mood!;
    const answers = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`q${i + 1}`, 0]));
    answers.q9 = 1;
    expect(phq.compute!(answers).safetyTrigger).toBe(true);
  });
});
