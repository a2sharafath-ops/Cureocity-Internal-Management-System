# Refactor plan — unify the "client obligations" engines

## Problem

Three modules independently re-derive "what a client still owes" — same rules,
different code, free to drift:

| Engine | File | Surface | Output shape |
|---|---|---|---|
| `getPackageStatus` | `lib/package-status.ts` | Client 360 → Open now / Upcoming | `{ openNow, upcoming }: StatusItem[]` |
| `careWorkFlags` | `lib/care-attention.ts` | Dashboard / whiteboard attention | `Flag[]` |
| `frontDeskFlags` | `lib/frontdesk-attention.ts` | Ops dashboard attention | `Flag[]` |

(`lib/today-agenda.ts` also re-computes comprehensive milestones for "today".)

### Concrete duplication

- **Owner resolution** (care-team assignment + completed-appointment fallback):
  `package-status.ts` L55–68 ≈ `care-attention.ts` L34–48.
- **Comprehensive milestones** loop: `package-status.ts` L150–170 ≈
  `care-attention.ts` L110–123 ≈ `today-agenda.ts` deadlines.
- **Clinician deliverables** (comp blood pending, diet chart not drafted, workout
  not created): `package-status.ts` L120–127 ≈ `care-attention.ts` L87–108.
- **Diet-chart explanation**: `package-status.ts` + `workspace/page.tsx` coach block.
- **Outstanding invoices**: `package-status.ts` + `frontdesk-attention.ts`.

Symptom already seen: the diet-explanation ownership + "gate on chart exists"
rule had to be edited in multiple files to stay consistent.

## Target design

One core module, thin per-surface adapters.

### `lib/obligations.ts` (new)

```ts
export type Obligation = {
  clientId: string;
  clientName?: string;
  key: string;          // stable identity: "invoice:4", "blood:comprehensive",
                        // "dietchart", "workout", "dietexplain", "milestone:diet_10",
                        // "blueprint", "onboarding:<step>", "intake:<id>", "followup-overdue"
  kind: "payment" | "blood" | "deliverable" | "milestone" | "touchpoint"
      | "onboarding" | "intake" | "blueprint";
  label: string;
  detail?: string;
  sev: "high" | "med" | "low";
  dueDate?: string;     // ISO — drives overdue + chronological sort
  overdue?: boolean;
  href?: string;        // canonical deep link
  owner?: { discipline?: string; staffId?: string; name?: string };
  chaseRoles?: string[];// fallback when no staff owner
};

// One batched read path; supports one client or the whole clinic.
export async function computeObligations(
  sb, opts: { clientIds?: string[]; today: string },
): Promise<Obligation[]>;

// Centralised, shared by all callers.
export function resolveOwner(clientId, discipline): { staffId; name } | undefined;
```

All rule logic (predicates, milestone dates, owner resolution) lives here once,
reusing existing helpers (`onboardingRow`, `lib/comprehensive`, `lib/appt-match`).

### Adapters (each surface keeps its own presentation)

- **`getPackageStatus`** → map `Obligation[]` for one client into
  `StatusItem[]`, split `openNow` (overdue / no-date) vs `upcoming` (future),
  set `sortKey = dueDate`. Keep card-specific quirks as filters (suppress the
  session-booking onboarding step; comp-blood item has no href).
- **`careWorkFlags`** → map clinic-wide obligations to `Flag[]`: `nudge` from
  `owner.staffId`, `chaseRole` from `chaseRoles`, `dedupeKey = key`. Keep the
  clinician-deliverable + blueprint-signoff filter.
- **`frontDeskFlags`** → map front-desk-owned kinds (`payment`, `blood`,
  `intake`, overdue `touchpoint`/`followup`) to `Flag[]`. Keep the coach-owned
  diet-explanation exclusion.

## Migration — incremental, each step deployable

- **Phase A — de-dup the helpers (no output change).** Extract `resolveOwner`
  and the milestone/deliverable predicates into `lib/obligations.ts`; have the
  three existing engines call them. Kills drift immediately, lowest risk.
- **Phase B — introduce `computeObligations`, migrate one consumer at a time.**
  Order: `careWorkFlags` → `frontDeskFlags` → `getPackageStatus`. After each,
  verify parity against the snapshot tests below.
- **Phase C — delete the now-dead per-engine logic.**

## Risks & mitigations

- **Behavior drift.** Add `tests/obligations.test.ts` capturing current outputs
  for representative fixtures (a Comprehensive client mid-journey, a
  membership-only client, a client with an unpaid invoice) and assert parity
  before/after each phase. Mirrors the existing `tests/appt-match.test.ts`.
- **Performance / N+1.** `computeObligations` must batch reads and accept a
  `clientIds` filter so the clinic-wide callers stay single-pass and the
  per-client card stays cheap.
- **Surface nuance.** Keep presentation quirks (overdue↔upcoming split, card vs
  chip, front-desk exclusions) in the adapters, never in the core.

## Task breakdown

1. `lib/obligations.ts`: types + `resolveOwner` + per-obligation detectors + `computeObligations`.
2. `tests/obligations.test.ts`: parity fixtures.
3. Phase A: point the 3 engines at the shared helpers; type-check + visual check.
4. Phase B1: refactor `careWorkFlags` to adapter; verify dashboard + whiteboard.
5. Phase B2: refactor `frontDeskFlags`; verify ops dashboard.
6. Phase B3: refactor `getPackageStatus`; verify client card Open now / Upcoming.
7. Phase C: remove dead duplication; final type-check + build.

## Estimated scope

Medium. One core module + three adapter refactors + a test file. Phase A alone
removes most drift risk and is safe to ship on its own.
