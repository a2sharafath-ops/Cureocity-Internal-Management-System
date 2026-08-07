// "Already chased" — the durable half of the Chase button.
//
// Pressing Chase sends a notification and writes an audit row, but the button
// itself only remembers within the page: refresh and it reads "Chase …" again,
// with nothing to say it was pressed an hour ago. That is right for the BUTTON
// — the work is still undone, so the flag and the button must both stay — and
// wrong for the ROW, which said nothing about what had already been tried.
//
// So the history moves onto the row: "chased 2 days ago by Sini · 3rd time".
// The button stays live, because the only thing that should silence a flag is
// the work getting done.
//
// Read from audit_log rather than a new table: the chase is already recorded
// there, and a second store would be one more thing to keep in step.

import { createClient } from "@/lib/supabase/server";

/** The two audit actions that mean "somebody was chased about this". */
const CHASE_ACTIONS = ["Team chased", "Health Professional nudged", "Clinician nudged"];

/** How far back to look. Older than this and the chase is not useful context. */
const LOOKBACK_DAYS = 30;

export type ChaseRecord = {
  /** ISO timestamp of the most recent chase. */
  at: string;
  /** Who pressed it last. */
  by: string | null;
  /** How many times inside the lookback window. */
  count: number;
};

/**
 * Chases keyed by the flag's label, and separately by client.
 *
 * `nudgeRole` records the label in `target` and the client in `detail`;
 * `nudgeClinician` records the CLIENT in `target` and the label in `detail`.
 * The two actions were written at different times and never reconciled, so
 * both orders are indexed here rather than rewriting history.
 */
export type ChaseIndex = Map<string, ChaseRecord>;

const keyOf = (label: string, clientId?: string | null) =>
  `${label.trim().toLowerCase()}|${clientId ?? ""}`;

export async function loadChaseLog(): Promise<ChaseIndex> {
  const supabase = await createClient();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const { data } = await supabase
    .from("audit_log")
    .select("actor_name, action, target, detail, created_at")
    .in("action", CHASE_ACTIONS)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const idx: ChaseIndex = new Map();
  const add = (k: string, row: { actor_name: string | null; created_at: string }) => {
    const prev = idx.get(k);
    // Rows arrive newest-first, so the first one seen is the latest chase.
    if (!prev) idx.set(k, { at: row.created_at, by: row.actor_name, count: 1 });
    else prev.count += 1;
  };

  for (const r of (data ?? []) as { actor_name: string | null; action: string; target: string | null; detail: string | null; created_at: string }[]) {
    const a = (r.target ?? "").trim();
    const b = (r.detail ?? "").trim();
    if (!a && !b) continue;
    // Index under both orderings and under the bare label, so a lookup finds
    // the record whichever way round the action happened to store it.
    if (a) { add(keyOf(a, b || null), r); add(keyOf(a, null), r); }
    if (b) { add(keyOf(b, a || null), r); add(keyOf(b, null), r); }
  }
  return idx;
}

/** The most recent chase for a flag, or null. */
export function chaseFor(idx: ChaseIndex, label: string | undefined, clientId?: string | null): ChaseRecord | null {
  if (!label) return null;
  return idx.get(keyOf(label, clientId)) ?? idx.get(keyOf(label, null)) ?? null;
}

/** "chased 2 days ago by Sini · 3rd time" — short enough to sit under a title. */
export function chaseLabel(c: ChaseRecord, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - Date.parse(c.at)) / 60_000));
  const when =
    mins < 1 ? "just now"
      : mins < 60 ? `${mins} min ago`
        : mins < 60 * 24 ? `${Math.round(mins / 60)}h ago`
          : `${Math.round(mins / (60 * 24))}d ago`;
  const ordinal = c.count === 1 ? "" : c.count === 2 ? " · 2nd time" : ` · ${c.count}th time`;
  return `chased ${when}${c.by ? ` by ${c.by.split(" ")[0]}` : ""}${ordinal}`;
}


/**
 * Stamp each flag with what has already been tried.
 *
 * Deliberately a decorator rather than something the queues compute: the
 * obligation engines answer "what is outstanding and whose is it", and the
 * chase history is a fact about the PEOPLE, not the work. Keeping it separate
 * means adding a new flag anywhere gets this for free.
 */
export async function withChaseHistory<T extends {
  chaseNote?: string;
  nudge?: { label: string; clientId?: string };
  chaseRole?: { label: string; clientId?: string };
}>(flags: T[]): Promise<T[]> {
  if (!flags.length) return flags;
  const idx = await loadChaseLog();
  if (!idx.size) return flags;
  const now = Date.now();
  return flags.map((f) => {
    const label = f.nudge?.label ?? f.chaseRole?.label;
    const clientId = f.nudge?.clientId ?? f.chaseRole?.clientId;
    const rec = chaseFor(idx, label, clientId);
    return rec ? { ...f, chaseNote: chaseLabel(rec, now) } : f;
  });
}
