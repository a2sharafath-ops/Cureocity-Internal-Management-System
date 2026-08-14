/**
 * Atomic billing RPC bridge.
 *
 * The application must not call the functions in migration 0179 before that
 * migration exists on the target database.  Keeping the switch explicit lets
 * code and migration be prepared together without changing Production early.
 */

export const ATOMIC_BILLING_MIGRATION = "0179_atomic_billing_workflows.sql";
export const ATOMIC_BILLING_FLAG = "BILLING_ATOMIC_RPC_ENABLED";

export function atomicBillingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[ATOMIC_BILLING_FLAG] === "true";
}

export function billingOperationKey(formData: FormData, prefix: string): string {
  const supplied = String(formData.get("mutation_key") ?? "").trim();
  return supplied ? `${prefix}:${supplied}` : `${prefix}:${crypto.randomUUID()}`;
}

export function subscriptionRenewalKey(subscriptionId: string, renewsOn: string | null): string {
  return `subscription-renewal:${subscriptionId}:${renewsOn ?? "unscheduled"}`;
}

type RpcError = { message: string; code?: string | null; details?: string | null };
type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: RpcError | null }>;
};

export type AtomicBillingResult<T extends Record<string, unknown> = Record<string, unknown>> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Run one 0179 RPC and turn PostgREST/database failures into a message a server
 * action can show. The RPC itself owns the transaction and idempotency record.
 */
export async function runAtomicBillingRpc<T extends Record<string, unknown>>(
  client: RpcClient,
  name: string,
  args: Record<string, unknown>,
): Promise<AtomicBillingResult<T>> {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const migrationMissing = error.code === "PGRST202" || error.code === "42883"
      || /function .* does not exist|schema cache/i.test(error.message);
    return {
      ok: false,
      error: migrationMissing
        ? `Atomic billing is enabled, but ${ATOMIC_BILLING_MIGRATION} is not applied to this environment. No billing records were changed.`
        : `The billing transaction failed. No billing records were changed. ${error.message}`,
    };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "The billing transaction returned no result. No success was recorded." };
  }
  return { ok: true, data: data as T };
}
