import { isHealthCoachSupervisor } from "@/lib/roles";

export const COACH_OVERRIDE_REASON_MIN_LENGTH = 12;

export type CoachClientWriteDecision =
  | { allowed: true; mode: "assigned-coach"; overrideReason: null }
  | { allowed: true; mode: "supervisor-override"; overrideReason: string }
  | { allowed: false; error: string };

/**
 * Pure policy for writes to the Health Coach-owned care record.
 *
 * The formal client_assignments row is the ownership source of truth. Clinical
 * safety escalation is intentionally handled outside this policy: any
 * authorised clinician must still be able to open a safety event immediately.
 */
export function coachClientWriteDecision(input: {
  role: string;
  staffId: string | null;
  assignedCoachStaffId: string | null;
  overrideReason?: string | null;
}): CoachClientWriteDecision {
  if (input.role === "Health Coach") {
    if (!input.staffId) {
      return { allowed: false, error: "Your Health Coach staff profile is not linked." };
    }
    if (!input.assignedCoachStaffId) {
      return { allowed: false, error: "This client does not have an assigned Health Coach." };
    }
    if (input.assignedCoachStaffId !== input.staffId) {
      return { allowed: false, error: "This client is assigned to another Health Coach." };
    }
    return { allowed: true, mode: "assigned-coach", overrideReason: null };
  }

  if (isHealthCoachSupervisor(input.role)) {
    const reason = input.overrideReason?.trim() ?? "";
    if (reason.length < COACH_OVERRIDE_REASON_MIN_LENGTH) {
      return {
        allowed: false,
        error: `Supervisor override requires a reason of at least ${COACH_OVERRIDE_REASON_MIN_LENGTH} characters.`,
      };
    }
    return { allowed: true, mode: "supervisor-override", overrideReason: reason };
  }

  return { allowed: false, error: "You are not authorized to change the Health Coach record." };
}
