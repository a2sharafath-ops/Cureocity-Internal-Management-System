// Retiring a care-turnaround alert once the work is actually done.
//
// The alert ledger only ever grew. A gate that breached wrote a row, the daily
// Whiteboard read every breach row as live, and nothing ever closed one — so a
// diet chart written an hour late stayed red on that client for the rest of
// their package, and the coach was asked to explain it again every single day.
//
// The sweeps already know the current state of every gate. This turns that into
// the missing half: whatever is no longer breached or due gets stamped resolved.

/** A gate still worth shouting about. */
export type OpenGate = { client_id: string; gate: string };

/**
 * Which recorded alerts should now be closed.
 *
 * `existing` is what the ledger already holds open; `stillOpen` is what this
 * run found. Anything in the first and not the second is finished work.
 *
 * Deliberately keyed on client + gate and NOT on kind: a gate that breached
 * after warning has two rows, and both describe the same piece of work. Closing
 * one and leaving the other is how half an alert survives.
 */
export function resolvableGates(
  existing: { client_id: string; gate: string }[],
  stillOpen: OpenGate[],
): { client_id: string; gate: string }[] {
  const open = new Set(stillOpen.map((g) => `${g.client_id}|${g.gate}`));
  const seen = new Set<string>();
  const out: { client_id: string; gate: string }[] = [];
  for (const e of existing) {
    const key = `${e.client_id}|${e.gate}`;
    if (open.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ client_id: e.client_id, gate: e.gate });
  }
  return out;
}

type Updater = {
  from: (table: string) => {
    update: (patch: Record<string, unknown>) => {
      is: (col: string, val: null) => {
        eq: (col: string, val: string) => {
          in: (col: string, vals: string[]) => PromiseLike<unknown>;
        };
      };
    };
  };
};

/**
 * Stamp the finished ones resolved.
 *
 * Grouped by client rather than issued per row: a client has a handful of gates
 * and a clinic has hundreds of clients, so one request each way round is the
 * difference between a sweep that finishes and one that times out.
 */
export async function closeResolvedGates(
  supabase: Updater,
  rows: { client_id: string; gate: string }[],
  now = new Date().toISOString(),
): Promise<number> {
  const byClient = new Map<string, string[]>();
  for (const r of rows) {
    (byClient.get(r.client_id) ?? byClient.set(r.client_id, []).get(r.client_id)!).push(r.gate);
  }
  let closed = 0;
  for (const [clientId, gates] of byClient) {
    await supabase.from("blueprint_sla_events")
      .update({ resolved_at: now })
      .is("resolved_at", null)
      .eq("client_id", clientId)
      .in("gate", gates);
    closed += gates.length;
  }
  return closed;
}
