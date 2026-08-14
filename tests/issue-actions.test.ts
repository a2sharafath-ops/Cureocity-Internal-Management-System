import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  createClient: vi.fn(),
  logServerError: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getProfile: mocks.getProfile }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/runtime-errors", () => ({ logServerError: mocks.logServerError }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { submitIssueReport, triageIssueReport } from "@/lib/issue-actions";

const reportId = "9b4232a4-1bdd-4c32-a397-0c26f64eb3bc";

function form() {
  const data = new FormData();
  data.set("type", "Bug");
  data.set("severity", "High");
  data.set("description", "The save action did not finish after clicking it.");
  data.set("route", `/clients/${reportId}?secret=removed`);
  data.set("browser_context", JSON.stringify({ browser: "Test/1", token: "removed" }));
  data.set("submission_key", "form-key");
  return data;
}

function insertClient(error: { code?: string; message: string } | null = null) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.insert = vi.fn(() => query);
  query.select = vi.fn(() => query);
  query.single = vi.fn().mockResolvedValue({ data: error ? null : { id: reportId }, error });
  const client = { from: vi.fn(() => query) };
  mocks.createClient.mockResolvedValue(client);
  return { client, query };
}

describe("issue report server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProfile.mockResolvedValue({ id: "staff-1", name: "Staff", role: "Front Desk" });
  });

  it("refuses client submissions before creating a database client", async () => {
    mocks.getProfile.mockResolvedValue({ id: "client-1", name: "Client", role: "Client" });
    expect(await submitIssueReport({}, form())).toEqual({ error: "You must be signed in as a staff member." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("stores only validated operational context and returns a checked success", async () => {
    const { query } = insertClient();
    expect(await submitIssueReport({}, form())).toEqual({ ok: "Report submitted. Thank you for including the details." });
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({
      route: `/clients/${reportId}`,
      client_ref: reportId,
      browser_context: { browser: "Test/1" },
      reporter_id: "staff-1",
    }));
    const inserted = query.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted).not.toHaveProperty("status");
    expect(JSON.stringify(inserted)).not.toContain("removed");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/issues");
  });

  it("returns a safe error and records database failures", async () => {
    insertClient({ code: "57014", message: "database details" });
    expect(await submitIssueReport({}, form())).toEqual({ error: "The report could not be saved. Please try again." });
    expect(mocks.logServerError).toHaveBeenCalledWith(expect.objectContaining({ code: "57014" }), {
      source: "issue_report",
      operation: "insert",
    });
  });

  it("reserves triage writes for administrators", async () => {
    mocks.getProfile.mockResolvedValue({ id: "manager-1", name: "Manager", role: "Manager" });
    const data = new FormData();
    data.set("id", reportId);
    data.set("status", "Resolved");
    expect(await triageIssueReport({}, data)).toEqual({ error: "Administrator access is required." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
