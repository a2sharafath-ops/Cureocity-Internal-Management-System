import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertCriticalQueries, logServerError } from "@/lib/runtime-errors";

describe("structured runtime error logging", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("emits bounded structured metadata without stack or arbitrary fields", () => {
    const write = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(new Error("database unavailable"), {
      code: "57014",
      token: "must-not-be-logged",
    });

    logServerError(error, { source: "test", scope: "billing" });

    expect(write).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(write.mock.calls[0][1]));
    expect(payload).toMatchObject({
      event: "server_runtime_error",
      level: "error",
      error: { name: "Error", message: "database unavailable", code: "57014" },
      context: { source: "test", scope: "billing" },
    });
    expect(JSON.stringify(payload)).not.toContain("must-not-be-logged");
    expect(payload.error.stack).toBeUndefined();
  });

  it("allows successful critical reads and throws when any required read fails", () => {
    const write = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => assertCriticalQueries("billing", [["invoices", { error: null }]])).not.toThrow();

    expect(() => assertCriticalQueries("billing", [
      ["invoices", { error: { message: "timeout", code: "57014" } }],
      ["packages", { error: null }],
    ])).toThrowError(/Required data could not be loaded for billing/);
    expect(write).toHaveBeenCalledOnce();
    expect(String(write.mock.calls[0][1])).toContain('"operations":["invoices"]');
  });
});
