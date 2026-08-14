type SafeContextValue = string | number | boolean | null | string[];

export type RuntimeErrorContext = Record<string, SafeContextValue | undefined>;

type QueryResult = {
  error: unknown;
};

type ErrorRecord = {
  event: "server_runtime_error";
  level: "error";
  timestamp: string;
  error: {
    name: string;
    message: string;
    code?: string;
    digest?: string;
  };
  context: Record<string, SafeContextValue>;
};

function errorField(error: unknown, field: string): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" && value.length <= 200 ? value : undefined;
}

function toErrorRecord(error: unknown, context: RuntimeErrorContext): ErrorRecord {
  const message = error instanceof Error
    ? error.message
    : errorField(error, "message") ?? "Unknown server error";
  const name = error instanceof Error
    ? error.name
    : errorField(error, "name") ?? "ServerError";
  const safeContext = Object.fromEntries(
    Object.entries(context).filter((entry): entry is [string, SafeContextValue] => entry[1] !== undefined),
  );

  return {
    event: "server_runtime_error",
    level: "error",
    timestamp: new Date().toISOString(),
    error: {
      name,
      message: message.slice(0, 500),
      ...(errorField(error, "code") ? { code: errorField(error, "code") } : {}),
      ...(errorField(error, "digest") ? { digest: errorField(error, "digest") } : {}),
    },
    context: safeContext,
  };
}

/**
 * Emits a machine-readable, deliberately small server log entry. Callers must
 * provide only operational labels: never request bodies, tokens, client names,
 * clinical notes, or other sensitive record contents.
 */
export function logServerError(error: unknown, context: RuntimeErrorContext): void {
  console.error("[server-runtime-error]", JSON.stringify(toErrorRecord(error, context)));
}

/**
 * Prevents failed critical reads from being mistaken for legitimate empty
 * datasets. The thrown error is handled by the nearest Next.js error boundary.
 */
export function assertCriticalQueries(
  scope: string,
  queries: ReadonlyArray<readonly [operation: string, result: QueryResult]>,
): void {
  const failed = queries.filter(([, result]) => Boolean(result.error));
  if (failed.length === 0) return;

  logServerError(failed[0][1].error, {
    source: "critical_query",
    scope,
    operations: failed.map(([operation]) => operation),
  });

  const error = new Error(`Required data could not be loaded for ${scope}.`);
  error.name = "CriticalDataReadError";
  throw error;
}
