import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getProfile: vi.fn(),
  runTaskReminders: vi.fn(),
  todayISO: vi.fn(() => "2026-08-20"),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/auth", () => ({ getProfile: mocks.getProfile }));
vi.mock("@/lib/cron/task-reminders", () => ({ runTaskReminders: mocks.runTaskReminders }));
vi.mock("@/lib/today", () => ({ todayISO: mocks.todayISO }));

import { POST } from "@/app/api/cron/task-reminders/route";

function staffQuery(data: unknown[], error: unknown = null) {
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.not = vi.fn(() => query);
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve);
  return query;
}

function request(secret: string | null = "cron-fixture") {
  return new Request("https://example.test/api/cron/task-reminders", {
    method: "POST",
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  });
}

const previousSecret = process.env.CRON_SECRET;

beforeEach(() => {
  process.env.CRON_SECRET = "cron-fixture";
  mocks.createAdminClient.mockReset();
  mocks.getProfile.mockReset().mockResolvedValue(null);
  mocks.runTaskReminders.mockReset().mockResolvedValue({
    scanned: 2,
    inApp: 1,
    whatsapp: 1,
    escalated: 0,
    operationsDigest: 1,
    skipped: false,
  });
});

afterEach(() => {
  if (previousSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previousSecret;
});

describe("controlled task-reminder route", () => {
  it("fails closed before touching the database", async () => {
    const response = await POST(request("wrong-secret"));
    expect(response.status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("accepts the existing real Super Admin session without revealing the cron secret", async () => {
    const admin = { from: vi.fn(() => staffQuery([
      { id: "staff-1", task_reminder_phone: "+919000000001" },
    ])) };
    mocks.getProfile.mockResolvedValue({ role: "Super Admin" });
    mocks.createAdminClient.mockReturnValue(admin);

    const response = await POST(request(null));
    expect(response.status).toBe(200);
    expect(mocks.getProfile).toHaveBeenCalledTimes(1);
    expect(mocks.runTaskReminders).toHaveBeenCalledTimes(1);
  });

  it("refuses to run unless exactly one opted-in contact is ready", async () => {
    const admin = { from: vi.fn(() => staffQuery([
      { id: "staff-1", task_reminder_phone: "+919000000001" },
      { id: "staff-2", task_reminder_phone: "+919000000002" },
    ])) };
    mocks.createAdminClient.mockReturnValue(admin);

    const response = await POST(request());
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ ok: false, optedInContacts: 2 });
    expect(mocks.runTaskReminders).not.toHaveBeenCalled();
  });

  it("runs the real reminder engine for only the single opted-in staff record", async () => {
    const admin = { from: vi.fn(() => staffQuery([
      { id: "staff-1", task_reminder_phone: "+919000000001" },
    ])) };
    mocks.createAdminClient.mockReturnValue(admin);

    const response = await POST(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, controlled: true, whatsapp: 1, operationsDigest: 1 });
    expect(mocks.runTaskReminders).toHaveBeenCalledWith(admin, "2026-08-20", {
      onlyStaffId: "staff-1",
      sendInApp: true,
      escalateManagement: false,
      includeOperationsDigest: true,
    });
  });
});
