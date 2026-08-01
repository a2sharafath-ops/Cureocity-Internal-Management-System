// Shared building blocks for the "what a client owes" engines
// (lib/package-status.ts, lib/care-attention.ts, lib/frontdesk-attention.ts).
//
// Phase A of the obligations refactor (docs/obligations-refactor-plan.md): pull
// the logic that was copy-pasted across those engines into one place so they
// can't drift. No behaviour change — callers get the same results, from one
// implementation.

// Provider staff role → care-team discipline key.
export const ROLE_TO_DISC: Record<string, string> = {
  Doctor: "doctor",
  Dietitian: "dietitian",
  "Fitness Trainer": "trainer",
  "Health Coach": "coach",
  Psychologist: "psychologist",
};

export type Owner = { id: string; name: string };

export type AssignRow = { client_id: string; discipline: string; staff_id: string | null; staff: { name: string } | null };
export type ApptOwnerRow = { client_id: string; status: string; provider_id: string | null; staff: { name: string; role: string } | null };

// Resolve who owns each (client, discipline) deliverable: the explicit care-team
// assignment is the source of truth; failing that, the clinician who actually
// ran the completed consult (the appointment provider) — so a "Remind …" still
// targets a real person instead of degrading to a plain link.
//
// Works clinic-wide or for a single client; pass whatever assignment /
// appointment rows you already loaded. Returns a lookup `(clientId, disc)`.
export function buildOwnerResolver(
  assignments: AssignRow[],
  appts: ApptOwnerRow[],
): (clientId: string, discipline: string) => Owner | undefined {
  const assigned = new Map<string, Owner>();
  for (const a of assignments) {
    if (a.staff_id) assigned.set(`${a.client_id}|${a.discipline}`, { id: a.staff_id, name: a.staff?.name ?? "clinician" });
  }
  const fallback = new Map<string, Owner>();
  for (const a of appts) {
    if (a.status !== "completed" || !a.provider_id || !a.staff) continue;
    const disc = ROLE_TO_DISC[a.staff.role];
    if (!disc) continue;
    const key = `${a.client_id}|${disc}`;
    if (!fallback.has(key)) fallback.set(key, { id: a.provider_id, name: a.staff.name });
  }
  return (clientId, discipline) => assigned.get(`${clientId}|${discipline}`) ?? fallback.get(`${clientId}|${discipline}`);
}
