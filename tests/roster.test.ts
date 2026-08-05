import { describe, it, expect } from "vitest";
import { weekDates, shortTime, shiftHours, isOverridden, compOffBalance, compOffExpiry, visibleDays } from "@/lib/roster";
import type { Shift, RosterRow } from "@/lib/roster";

const shifts = new Map<string, Shift>([
  ["M",   { code: "M",   name: "Morning",  start_time: "07:00:00", end_time: "15:00:00", color: null, working: true }],
  ["OFF", { code: "OFF", name: "Week off", start_time: null,       end_time: null,       color: null, working: false }],
]);
const row = (o: Partial<RosterRow> = {}): RosterRow =>
  ({ staff_id: "s1", date: "2026-08-05", shift: "M", start_time: null, end_time: null, note: null, ...o });

describe("weekDates", () => {
  it("starts on Monday whatever day you ask for", () => {
    // 5 Aug 2026 is a Wednesday.
    expect(weekDates("2026-08-05")[0]).toBe("2026-08-03");
    expect(weekDates("2026-08-03")[0]).toBe("2026-08-03");   // Monday itself
    expect(weekDates("2026-08-09")[0]).toBe("2026-08-03");   // Sunday belongs to it
    expect(weekDates("2026-08-05")).toHaveLength(7);
  });
});

describe("shortTime", () => {
  it("reads as a person would say it", () => {
    expect(shortTime("07:00:00")).toBe("7am");
    expect(shortTime("14:30:00")).toBe("2:30pm");
    expect(shortTime("12:00:00")).toBe("12pm");
    expect(shortTime("00:00:00")).toBe("12am");
    expect(shortTime(null)).toBe("");
  });
});

describe("shiftHours", () => {
  it("uses the template when there is no override", () => {
    expect(shiftHours(row(), shifts)).toBe("7am–3pm");
  });
  it("uses the override when there is one", () => {
    expect(shiftHours(row({ start_time: "09:00:00", end_time: "17:00:00" }), shifts)).toBe("9am–5pm");
  });
  it("names a non-working shift instead of inventing hours", () => {
    expect(shiftHours(row({ shift: "OFF" }), shifts)).toBe("Week off");
  });
});

describe("isOverridden", () => {
  it("is false when the times match the template", () => {
    expect(isOverridden(row({ start_time: "07:00:00", end_time: "15:00:00" }), shifts)).toBe(false);
    expect(isOverridden(row(), shifts)).toBe(false);
  });
  it("is true when someone worked different hours", () => {
    expect(isOverridden(row({ start_time: "06:00:00" }), shifts)).toBe(true);
  });
});

describe("compOffBalance", () => {
  const c = (o: Partial<{ expires_on: string; status: string }>) =>
    ({ id: "1", staff_id: "s1", earned_on: "2026-05-01", reason: "Worked 15 Aug",
       expires_on: "2026-12-01", status: "available", ...o });

  it("counts what can actually be taken", () => {
    const b = compOffBalance([c({}), c({}), c({ status: "used" })], "2026-08-05");
    expect(b).toMatchObject({ available: 2, used: 1 });
  });
  it("treats a lapsed credit as expired even if the sweep has not run", () => {
    const b = compOffBalance([c({ expires_on: "2026-08-04", status: "available" })], "2026-08-05");
    expect(b.available).toBe(0);
    expect(b.expired).toBe(1);
  });
  it("warns about credits expiring within a fortnight", () => {
    expect(compOffBalance([c({ expires_on: "2026-08-12" })], "2026-08-05").expiringSoon).toBe(1);
    expect(compOffBalance([c({ expires_on: "2026-09-30" })], "2026-08-05").expiringSoon).toBe(0);
  });
  it("ignores cancelled credits entirely", () => {
    expect(compOffBalance([c({ status: "cancelled" })], "2026-08-05"))
      .toMatchObject({ available: 0, used: 0, expired: 0 });
  });
});

describe("compOffExpiry", () => {
  it("gives 90 days from the day worked", () => {
    expect(compOffExpiry("2026-08-15")).toBe("2026-11-13");
  });
});

describe("split shifts — how the clinic actually rosters", () => {
  const withSplit = new Map<string, Shift>([
    ["SPLIT", { code: "SPLIT", name: "Split", start_time: "06:00:00", end_time: "10:00:00",
                start_time2: "17:00:00", end_time2: "21:00:00", color: null, working: true }],
    ["M",     { code: "M", name: "Morning", start_time: "06:00:00", end_time: "14:00:00", color: null, working: true }],
  ]);
  const r = (o: Partial<RosterRow> = {}): RosterRow =>
    ({ staff_id: "s1", date: "2026-07-06", shift: "SPLIT", start_time: null, end_time: null, note: null, ...o });

  it("writes both blocks, as the sheet does", () => {
    expect(shiftHours(r(), withSplit)).toBe("6am–10am, 5pm–9pm");
  });
  it("lets one block be overridden without losing the other", () => {
    expect(shiftHours(r({ start_time2: "16:00:00" }), withSplit)).toBe("6am–10am, 4pm–9pm");
    expect(isOverridden(r({ start_time2: "16:00:00" }), withSplit)).toBe(true);
  });
  it("is not an override when the times match the template", () => {
    expect(isOverridden(r({ start_time: "06:00:00", end_time2: "21:00:00" }), withSplit)).toBe(false);
  });
  it("leaves a single-block shift alone", () => {
    expect(shiftHours(r({ shift: "M" }), withSplit)).toBe("6am–2pm");
  });
});

describe("visibleDays", () => {
  const week = weekDates("2026-07-06");   // Mon 6 Jul … Sun 12 Jul
  const row = (date: string): RosterRow => ({ staff_id: "s", date, shift: "M", start_time: null, end_time: null, note: null });
  it("shows Mon–Sat when nobody works Sunday", () => {
    expect(visibleDays(week, [row("2026-07-08")])).toHaveLength(6);
  });
  it("adds Sunday the moment someone is rostered on it", () => {
    expect(visibleDays(week, [row("2026-07-12")])).toHaveLength(7);
  });
});
