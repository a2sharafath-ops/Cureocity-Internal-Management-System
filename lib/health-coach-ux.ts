/**
 * Shared navigation landmarks for the Health Coach journey.
 *
 * These are navigation aids only. They deliberately mirror existing guarded
 * sections and never replace their server-side permissions, completion rules,
 * consent decisions or safety hard stops.
 */
export const HEALTH_COACH_RECORD_SECTIONS = [
  { key: "baseline", label: "Baseline", fragment: "coach-baseline" },
  { key: "goals", label: "Goals & adherence", fragment: "coaching-goals" },
  { key: "programme", label: "Programme status", fragment: "programme-lifecycle" },
  { key: "coordination", label: "Referrals & safety", fragment: "care-coordination" },
] as const;

export const HEALTH_COACH_SESSION_STEPS = [
  { number: 1, shortLabel: "Check-in & safety", fragment: "session-step-1" },
  { number: 2, shortLabel: "Progress", fragment: "session-step-2" },
  { number: 3, shortLabel: "Barrier", fragment: "session-step-3" },
  { number: 4, shortLabel: "Action", fragment: "session-step-4" },
  { number: 5, shortLabel: "Closeout", fragment: "session-step-5" },
] as const;

export function healthCoachRecordHref(clientId: string, fragment: string, readOnly = false) {
  return `/clients/${clientId}?tab=overview${readOnly ? "&ro=1" : ""}#${fragment}`;
}
