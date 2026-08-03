// Database side of the care-team assignment engine. The decision rules are in
// lib/assignment.ts (pure); this loads the pool, applies them, and persists.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DISCIPLINES, ROLE_FOR, planCareTeam, primaryPro, disciplinesForCategory,
  type Assignment, type Candidate, type Discipline, type Booking, type Busy,
} from "@/lib/assignment";
import { packageCategory } from "@/lib/packages";
import { createAdminClient } from "@/lib/supabase/admin";

type DB = SupabaseClient<any, any, any>;

const CATEGORY_PRIORITY = ["blueprint", "comprehensive", "training", "membership"];

/** The client's package category, by the same priority the Onboarding board uses. */
async function resolveCategory(supabase: DB, clientId: string): Promise<string> {
  const { data: cps } = await supabase
    .from("client_packages").select("category").eq("client_id", clientId).eq("status", "active");
  const cats = ((cps ?? []) as { category: string }[]).map((r) => r.category);
  const hit = CATEGORY_PRIORITY.find((p) => cats.includes(p));
  if (hit) return hit;
  const { data: c } = await supabase.from("clients").select("package_id").eq("id", clientId).maybeSingle();
  const pkgId = (c as { package_id: string | null } | null)?.package_id ?? null;
  if (pkgId) {
    const { data: pk } = await supabase.from("packages").select("is_facility").eq("id", pkgId).maybeSingle();
    return packageCategory(pkgId, (pk as { is_facility: boolean } | null)?.is_facility ?? false);
  }
  return "other";
}

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

  const [{ data: assignRows }, { data: activeCps }] = await Promise.all([
    supabase.from("client_assignments").select("staff_id, discipline, client_id"),
    supabase.from("client_packages").select("client_id").eq("status", "active"),
  ]);
  const assigns = (assignRows ?? []) as { staff_id: string | null; discipline: string; client_id: string }[];
  // Rotation load = CURRENT active caseload, not lifetime. Assignments for
  // churned clients (no active package) don't count — otherwise a coach who has
  // cycled through many clients shows a permanently high load and stops getting
  // new ones even when their live caseload is small.
  const activeClients = new Set(((activeCps ?? []) as { client_id: string }[]).map((r) => r.client_id));

  const pool = {} as Record<Discipline, Candidate[]>;
  for (const d of DISCIPLINES) {
    pool[d] = staff
      .filter((s) => s.role === ROLE_FOR[d])
      .map((s) => ({
        id: s.id,
        name: s.name,
        joined: s.created_at ?? "",
        load: assigns.filter((a) => a.staff_id === s.id && a.discipline === d && activeClients.has(a.client_id)).length,
      }));
  }
  return pool;
}

/**
 * Assign a client's care team and persist it. Existing assignments are left
 * alone unless `reassign` is set, so re-running is safe and a manual override
 * is never silently undone.
 *
 * PERMISSIONS — read with the caller's client, WRITE with the service role.
 * `client_assignments` is locked by RLS to admins/managers (see 0071), but the
 * *automatic* engine legitimately runs as whoever triggered it — most often
 * Front Desk selling a package. Writing as the caller meant those inserts were
 * silently rejected and the client ended up with no care team at all. The reads
 * below stay on the caller's client (RLS-safe); only the two writes are
 * elevated.
 *
 * Because the service role bypasses every check, this function must only ever
 * be called from an already permission-gated server action (package purchase,
 * lead conversion, appointment creation). Never call it from an ungated path.
 */
export async function assignCareTeam(
  supabase: DB,
  clientId: string,
  opts: { slot?: { date: string; hour: number } | null; actor?: string; reassign?: boolean; disciplines?: string[] } = {},
): Promise<Assignment[]> {
  const { data: client } = await supabase
    .from("clients").select("id, branch").eq("id", clientId).maybeSingle();
  if (!client) return [];

  const [{ data: apptRows }, { data: busyRows }, { data: apptBusyRows }, { data: existingRows }] = await Promise.all([
    supabase.from("appointments").select("provider_id, type, date, hour, status").eq("client_id", clientId),
    supabase.from("sessions").select("trainer_id, date, hour").eq("status", "scheduled"),
    supabase.from("appointments").select("provider_id, date, hour, status").neq("status", "cancelled"),
    supabase.from("client_assignments").select("discipline, staff_id").eq("client_id", clientId),
  ]);

  const bookings = (apptRows ?? []) as Booking[];
  // A trainer is "busy" at a slot if they have a scheduled strength session OR a
  // (non-cancelled) appointment there — a fitness assessment blocks the slot too.
  // freeAt matches on the trainer's id, so non-trainer providers in this list
  // simply never collide with a trainer candidate.
  const busy: Busy[] = [
    ...((busyRows ?? []) as { trainer_id: string | null; date: string; hour: number }[])
      .filter((b): b is Busy => Boolean(b.trainer_id)),
    ...((apptBusyRows ?? []) as { provider_id: string | null; date: string; hour: number }[])
      .filter((a) => a.provider_id).map((a) => ({ trainer_id: a.provider_id as string, date: a.date, hour: a.hour })),
  ];
  const existing = new Set(
    ((existingRows ?? []) as { discipline: string; staff_id: string | null }[])
      .filter((r) => r.staff_id).map((r) => r.discipline)
  );

  const pool = await loadPool(supabase, client.branch);
  let planned = planCareTeam({ bookings, pool, busy, slot: opts.slot ?? null });

  // Scope to the disciplines this package actually needs. An explicit
  // `disciplines` override wins; otherwise it's derived from the client's
  // package category — BluePrint/Comprehensive get the full clinical team,
  // PT gets trainer + coach, membership gets none.
  const disciplines = opts.disciplines ?? disciplinesForCategory(await resolveCategory(supabase, clientId));
  const want = new Set<string>(disciplines);
  // Keep the disciplines this package needs — PLUS any discipline the client was
  // explicitly booked into. Booking a diet/doctor/psych consult means that
  // clinician owns the client for that discipline, even if the package category
  // (e.g. a membership) wouldn't otherwise pull in a full clinical team. Without
  // this, the clinician has the appointment but the client never lands in their
  // "My clients" roster.
  planned = planned.filter((a) => want.has(a.discipline) || a.method === "booking");

  const toWrite = opts.reassign ? planned : planned.filter((a) => !existing.has(a.discipline));
  if (!toWrite.length) return [];

  // Elevated: RLS on client_assignments allows admins/managers only, but the
  // engine runs as whoever triggered it (usually Front Desk). See the note above.
  const db = createAdminClient();
  const { error: writeErr } = await db.from("client_assignments").upsert(
    toWrite.map((a) => ({
      client_id: clientId, discipline: a.discipline, staff_id: a.staff_id,
      method: a.method, assigned_by: opts.actor ?? null, assigned_at: new Date().toISOString(),
    })),
    { onConflict: "client_id,discipline" },
  );
  // Never fail silently again: a rejected write used to look exactly like a
  // successful one, so a client quietly ended up with no care team.
  if (writeErr) {
    console.error("[care-team] assignment write failed", { clientId, error: writeErr.message });
    return [];
  }

  // keep the denormalised single pro on the clients list in step
  const { data: allRows } = await db
    .from("client_assignments").select("discipline, staff_id").eq("client_id", clientId);
  const all = ((allRows ?? []) as { discipline: string; staff_id: string | null }[])
    .filter((r) => r.staff_id)
    .map((r) => ({ discipline: r.discipline as Discipline, staff_id: r.staff_id as string, method: "rotation" as const }));
  const pro = primaryPro(all);
  if (pro) await db.from("clients").update({ pro_id: pro }).eq("id", clientId);

  return toWrite;
}
