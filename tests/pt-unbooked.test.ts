import { describe, it, expect, vi } from "vitest";
import { runPtSla } from "@/lib/cron/pt-sla";
import { BOOKING_DUE_DAYS, CYCLE_DAYS, addDaysISO } from "@/lib/pt";

vi.mock("@/lib/notify", () => ({ notifyRoles: vi.fn(async () => {}) }));
vi.mock("@/lib/appt-match", async (orig) => ({
  // Only the catalogue load is stubbed — the matching rules are the real ones,
  // so this suite keeps exercising them rather than a copy that can drift.
  ...(await orig<typeof import("@/lib/appt-match")>()),
  loadCatOf: async () => (t: string | null) => t,
}));

const START = "2026-07-01";

/**
 * A minimal stand-in for the Supabase client: enough chaining to satisfy the
 * sweep, returning whatever rows the test hands it per table. Inserts are
 * captured so we can assert what the sweep decided rather than what it logged.
 */
function fakeSb(tables: Record<string, unknown[]>, captured: Record<string, unknown[]> = {}) {
  const builder = (table: string) => {
    const res = { data: tables[table] ?? [], error: null };
    const chain: Record<string, unknown> = {
      select: () => chain, eq: () => chain, in: () => chain, neq: () => chain,
      is: () => chain, order: () => chain,
      // The sweep now retires alerts whose work is done; record the update so a
      // test can assert on it, and keep the chain going.
      update: (patch: unknown) => { (captured[`${table}:update`] ??= []).push(patch); return chain; },
      insert: (rows: unknown[]) => { (captured[table] ??= []).push(...rows); return Promise.resolve({ error: null }); },
      upsert: (rows: unknown[]) => { (captured[table] ??= []).push(...rows); return Promise.resolve({ error: null }); },
      then: (ok: (v: unknown) => unknown) => Promise.resolve(res).then(ok),
    };
    return chain;
  };
  return { from: builder } as never;
}

const base = (over: Record<string, unknown[]> = {}) => ({
  care_protocols: [{ client_id: "c1", start_date: START, hold_since: null }],
  clients: [{ id: "c1", name: "Anjali" }],
  appointments: [],
  sessions: [],
  tasks: [],
  client_packages: [{ client_id: "c1", package_id: "pt4" }],
  packages: [{ id: "pt4", validity: CYCLE_DAYS }],
  blueprint_sla_events: [],
  ...over,
});

describe("PT sweep — package bought but never scheduled", () => {
  const at = (iso: string) => Date.parse(`${iso}T06:00:00Z`);

  it("stays quiet before the booking deadline", async () => {
    const r = await runPtSla(fakeSb(base()), at(START));
    expect(r.unbooked).toBe(0);
  });

  it("flags once the booking deadline passes with nothing in the diary", async () => {
    const r = await runPtSla(fakeSb(base()), at(addDaysISO(START, BOOKING_DUE_DAYS)));
    expect(r.unbooked).toBe(1);
  });

  it("does not wait for the 28-day cycle breach", async () => {
    // The whole point: the old code only noticed at the cycle deadline, four
    // weeks after the money was taken.
    const dayAfterDue = addDaysISO(START, BOOKING_DUE_DAYS + 1);
    expect(dayAfterDue < addDaysISO(START, CYCLE_DAYS)).toBe(true);
    const r = await runPtSla(fakeSb(base()), at(dayAfterDue));
    expect(r.unbooked).toBe(1);
  });

  it("stays quiet when sessions are booked but not yet held", async () => {
    // Booked-and-unattended is a different problem with a different owner; the
    // cycle breach covers it. This flag is only about an empty diary.
    const sessions = [{ client_id: "c1", status: "scheduled" }];
    const r = await runPtSla(fakeSb(base({ sessions })), at(addDaysISO(START, 10)));
    expect(r.unbooked).toBe(0);
  });

  it("never nags twice — a recorded breach suppresses it", async () => {
    const blueprint_sla_events = [{ client_id: "c1", gate: "sessions_unbooked", kind: "breach" }];
    const r = await runPtSla(fakeSb(base({ blueprint_sla_events })), at(addDaysISO(START, 10)));
    expect(r.unbooked).toBe(0);
  });

  it("stays quiet while the package is on hold", async () => {
    const care_protocols = [{ client_id: "c1", start_date: START, hold_since: "2026-07-02" }];
    const r = await runPtSla(fakeSb(base({ care_protocols })), at(addDaysISO(START, 10)));
    expect(r.unbooked).toBe(0);
  });

  it("records the breach so it can be deduped next night", async () => {
    const captured: Record<string, unknown[]> = {};
    await runPtSla(fakeSb(base(), captured), at(addDaysISO(START, BOOKING_DUE_DAYS)));
    const events = (captured.blueprint_sla_events ?? []) as { gate: string; kind: string }[];
    expect(events.some((e) => e.gate === "sessions_unbooked" && e.kind === "breach")).toBe(true);
  });
});
