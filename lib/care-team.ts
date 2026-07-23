// Database side of the care-team assignment engine. The decision rules are in
// lib/assignment.ts (pure); this loads the pool, applies them, and persists.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DISCIPLINES, ROLE_FOR, planCareTeam, primaryPro,
  type Assignment, type Candidate, type Discipline, type Booking, type Busy,
} from "@/lib/assignment";

type DB = SupabaseClient<any, any, any>;

/**
 * Build the candidate pool for every discipline, with each staff member's
 * current client load in that discipline (the rotation counter).
 */
export async function loadPool(supabase: DB, branch?: string | null): Promise<Record<Discipline, Candidate[]>> {
  const roles = Object.values(ROLE_FOR);
  let q = supabase.from("staff").select("id, name, role, created_at").in("role", roles);
  if (branch) q = q.eq("branch", branch);
  const { data: staffRows } = await q;
  const staff = (staffRows ?? []) as { id: string; name: string; role: string; created_at: string }[];

  const { data: assignRows } = await supabase.from("client_assignments").select("staff_id, discipline");
  const assigns = (assignRows ?? []) as { staff_id: string | null; discipline: string }[];

  const pool = {} as Record<Discipline, Candidate[]>;
  for (const d of DISCIPLINES) {
    pool[d] = staff
      .filter((s) => s.role === ROLE_FOR[d])
      .map((s) => ({
        id: s.id,
        name: s.name,
        joined: s.created_at ?? "",
        load: assigns.filter((a) => a.staff_id === s.id && a.discipline === d).length,
      }));
  }
  return pool;
}

/**
 * Assign a client's care team and persist it. Existing assignments are left
 * alone unless `reassign` is set, so re-running is safe and a manual override
 * is never silently undone.
 */
export async function assignCareTeam(
  supabase: DB,
  clientId: string,
  opts: { slot?: { date: string; hour: number } | null; actor?: string; reassign?: boolean; disciplines?: string[] } = {},
): Promise<Assignment[]> {
  const { data: client } = await supabase
    .from("clients").select("id, branch").eq("id", clientId).maybeSingle();
  if (!client) return [];

  const [{ data: apptRows }, { data: busyRows }, { data: existingRows }] = await Promise.all([
    supabase.from("appointments").select("provider_id, type, date, hour, status").eq("client_id", clientId),
    supabase.from("sessions").select("trainer_id, date, hour").eq("status", "scheduled"),
    supabase.from("client_assignments").select("discipline, staff_id").eq("client_id", clientId),
  ]);

  const bookings = (apptRows ?? []) as Booking[];
  const busy = ((busyRows ?? []) as { trainer_id: string | null; date: string; hour: number }[])
    .filter((b): b is Busy => Boolean(b.trainer_id));
  const existing = new Set(
    ((existingRows ?? []) as { discipline: string; staff_id: string | null }[])
      .filter((r) => r.staff_id).map((r) => r.discipline)
  );

  const pool = await loadPool(supabase, client.branch);
  let planned = planCareTeam({ bookings, pool, busy, slot: opts.slot ?? null });

  // Scope to a subset of disciplines when asked — a PT package, for instance,
  // only wants a trainer and a health coach, not the full clinical team.
  if (opts.disciplines) {
    const want = new Set<string>(opts.disciplines);
    planned = planned.filter((a) => want.has(a.discipline));
  }

  const toWrite = opts.reassign ? planned : planned.filter((a) => !existing.has(a.discipline));
  if (!toWrite.length) return [];

  await supabase.from("client_assignments").upsert(
    toWrite.map((a) => ({
      client_id: clientId, discipline: a.discipline, staff_id: a.staff_id,
      method: a.method, assigned_by: opts.actor ?? null, assigned_at: new Date().toISOString(),
    })),
    { onConflict: "client_id,discipline" },
  );

  // keep the denormalised single pro on the clients list in step
  const { data: allRows } = await supabase
    .from("client_assignments").select("discipline, staff_id").eq("client_id", clientId);
  const all = ((allRows ?? []) as { discipline: string; staff_id: string | null }[])
    .filter((r) => r.staff_id)
    .map((r) => ({ discipline: r.discipline as Discipline, staff_id: r.staff_id as string, method: "rotation" as const }));
  const pro = primaryPro(all);
  if (pro) await supabase.from("clients").update({ pro_id: pro }).eq("id", clientId);

  return toWrite;
}
