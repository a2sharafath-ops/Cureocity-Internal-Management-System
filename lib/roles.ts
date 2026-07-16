// Role → permissions map (mirrors the prototype's RBAC, simplified).

export type Role =
  | "Administrator"
  | "Manager"
  | "Front Desk"
  | "Health Professional"
  | "Finance"
  | "HR"
  | "Staff";

// Which nav items each role can see. "all" = every role.
export const NAV_ACCESS: Record<string, Role[] | "all"> = {
  "/dashboard": "all",
  "/clients": ["Administrator", "Manager", "Front Desk", "Health Professional"],
  "/leads": ["Administrator", "Manager", "Front Desk"],
  "/sessions": ["Administrator", "Manager", "Front Desk", "Health Professional"],
  "/users": ["Administrator"],
};

export function canSee(role: string, href: string): boolean {
  const rule = NAV_ACCESS[href];
  if (!rule) return true;
  if (rule === "all") return true;
  return (rule as string[]).includes(role);
}

// Who can create/edit clients and move leads.
export function canWrite(role: string): boolean {
  return ["Administrator", "Manager", "Front Desk"].includes(role);
}

// Who can reschedule / complete strength sessions (front desk + trainers).
export function canManageSessions(role: string): boolean {
  return ["Administrator", "Manager", "Front Desk", "Health Professional"].includes(role);
}
