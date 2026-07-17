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
  "/messages": ["Administrator", "Manager", "Front Desk", "Health Professional"],
  "/sessions": ["Administrator", "Manager", "Front Desk", "Health Professional"],
  "/trainer": ["Administrator", "Manager", "Front Desk", "Health Professional"],
  "/pro": ["Administrator", "Manager", "Health Professional"],
  "/meals": ["Administrator", "Manager", "Health Professional"],
  "/blueprint": ["Administrator", "Manager", "Front Desk", "Health Professional"],
  "/packages": ["Administrator", "Manager", "Front Desk"],
  "/billing": ["Administrator", "Manager", "Front Desk", "Finance"],
  "/users": ["Administrator"],
  "/audit": ["Administrator"],
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

// Who can activate/deactivate packages.
export function canManagePackages(role: string): boolean {
  return ["Administrator", "Manager"].includes(role);
}

// Who can run consultations / write summaries.
export function canConsult(role: string): boolean {
  return ["Administrator", "Manager", "Health Professional"].includes(role);
}

// Who can drive the BluePrint flow (blood reports, generate).
export function canManageBlueprint(role: string): boolean {
  return ["Administrator", "Manager", "Front Desk", "Health Professional"].includes(role);
}

// Who can manage invoices / billing.
export function canBill(role: string): boolean {
  return ["Administrator", "Manager", "Front Desk", "Finance"].includes(role);
}

// Who can message clients.
export function canMessage(role: string): boolean {
  return ["Administrator", "Manager", "Front Desk", "Health Professional"].includes(role);
}
