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

import { updateWorkboardStatus } from "@/lib/workboard-actions";

const itemId = "1ba8a8d7-7e4f-48ba-97f9-4443ea11f218";

function form(status = "In progress") {
  const data = new FormData();
  data.set("id", itemId);
  data.set("status", status);
  return data;
}

function updateClient(result: { data: { id: string; status: string } | null; error: { code?: string; message: string } | null }) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.update = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.select = vi.fn(() => query);
  query.maybeSingle = vi.fn().mockResolvedValue(result);
  const client = { from: vi.fn(() => query) };
  mocks.createClient.mockResolvedValue(client);
  return { client, query };
}

describe("Workboard status action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProfile.mockResolvedValue({ id: "owner-1", name: "Owner", role: "Super Admin" });
  });

  it("refuses non-owner writes before creating a database client", async () => {
    mocks.getProfile.mockResolvedValue({ id: "admin-1", name: "Admin", role: "Administrator" });
    expect(await updateWorkboardStatus({}, form())).toEqual({ error: "Super Admin access is required." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("updates only the status and relies on the database for atomic attribution and audit", async () => {
    const { query } = updateClient({ data: { id: itemId, status: "In progress" }, error: null });
    expect(await updateWorkboardStatus({}, form())).toEqual({ ok: "Status updated to In progress." });
    expect(query.update).toHaveBeenCalledWith({ status: "In progress" });
    expect(query.eq).toHaveBeenCalledWith("id", itemId);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/workboard");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/audit");
  });

  it("returns a checked error when persistence fails", async () => {
    const dbError = { code: "57014", message: "database details" };
    updateClient({ data: null, error: dbError });
    expect(await updateWorkboardStatus({}, form("Done"))).toEqual({ error: "The work item could not be updated. Please try again." });
    expect(mocks.logServerError).toHaveBeenCalledWith(dbError, { source: "workboard", operation: "status_update" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("distinguishes a missing item from a database failure", async () => {
    updateClient({ data: null, error: null });
    expect(await updateWorkboardStatus({}, form("Done"))).toEqual({ error: "Work item not found." });
  });
});
