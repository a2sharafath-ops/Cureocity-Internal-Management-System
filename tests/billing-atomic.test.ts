import { describe, expect, it, vi } from "vitest";
import {
  ATOMIC_BILLING_MIGRATION,
  atomicBillingEnabled,
  billingOperationKey,
  runAtomicBillingRpc,
  subscriptionRenewalKey,
} from "@/lib/billing-atomic";

describe("atomic billing rollout gate", () => {
  it("is off unless the environment explicitly says true", () => {
    expect(atomicBillingEnabled({})).toBe(false);
    expect(atomicBillingEnabled({ BILLING_ATOMIC_RPC_ENABLED: "false" })).toBe(false);
    expect(atomicBillingEnabled({ BILLING_ATOMIC_RPC_ENABLED: "TRUE" })).toBe(false);
    expect(atomicBillingEnabled({ BILLING_ATOMIC_RPC_ENABLED: "true" })).toBe(true);
  });
});

describe("billing idempotency keys", () => {
  it("keeps a submitted browser mutation key stable and workflow-scoped", () => {
    const formData = new FormData();
    formData.set("mutation_key", "same-click");
    expect(billingOperationKey(formData, "package-purchase")).toBe("package-purchase:same-click");
    expect(billingOperationKey(formData, "package-renewal")).toBe("package-renewal:same-click");
  });

  it("uses the subscription cycle for deterministic automatic retries", () => {
    expect(subscriptionRenewalKey("sub-1", "2026-08-14"))
      .toBe("subscription-renewal:sub-1:2026-08-14");
    expect(subscriptionRenewalKey("sub-1", "2026-09-13"))
      .not.toBe(subscriptionRenewalKey("sub-1", "2026-08-14"));
  });
});

describe("atomic billing RPC error handling", () => {
  it("returns the committed RPC result", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { invoice_id: "inv-1" }, error: null });
    await expect(runAtomicBillingRpc({ rpc }, "refund_invoice_atomic", { p_invoice_id: "inv-1" }))
      .resolves.toEqual({ ok: true, data: { invoice_id: "inv-1" } });
  });

  it("replays a committed operation key without a second mutation", async () => {
    const committed = new Map<string, Record<string, unknown>>();
    let writes = 0;
    const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => {
      const key = String(args.p_operation_key);
      const prior = committed.get(key);
      if (prior) return { data: { ...prior, idempotent_replay: true }, error: null };
      writes++;
      const result = { invoice_id: "inv-1", idempotent_replay: false };
      committed.set(key, result);
      return { data: result, error: null };
    });
    const args = { p_operation_key: "package-renewal:one-click" };

    const first = await runAtomicBillingRpc({ rpc }, "renew_package_atomic", args);
    const retry = await runAtomicBillingRpc({ rpc }, "renew_package_atomic", args);

    expect(first).toEqual({ ok: true, data: { invoice_id: "inv-1", idempotent_replay: false } });
    expect(retry).toEqual({ ok: true, data: { invoice_id: "inv-1", idempotent_replay: true } });
    expect(writes).toBe(1);
  });

  it("reports a transaction failure as no records changed", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23503", message: "insert violates foreign key" },
    });
    const result = await runAtomicBillingRpc({ rpc }, "purchase_package_atomic", {});
    expect(result).toEqual({
      ok: false,
      error: "The billing transaction failed. No billing records were changed. insert violates foreign key",
    });
  });

  it("fails closed with a precise migration-order error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "function was not found in the schema cache" },
    });
    const result = await runAtomicBillingRpc({ rpc }, "renew_package_atomic", {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(ATOMIC_BILLING_MIGRATION);
      expect(result.error).toContain("No billing records were changed");
    }
  });

  it("does not treat an empty response as success", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    await expect(runAtomicBillingRpc({ rpc }, "void_client_package_atomic", {}))
      .resolves.toEqual({
        ok: false,
        error: "The billing transaction returned no result. No success was recorded.",
      });
  });
});
