// Professional role workspaces (prototype "role cockpit" model).
// Four disciplines, each with its own tab set. Tabs are either:
//   • live  — rendered inside the workspace now (Phase 1: dash, clients)
//   • href  — bridges to an existing standalone page until embedded
//   • stub  — a module slated for a later phase (Concerns, MDT, etc.)

export type WsRoleKey = "doctor" | "diet" | "trainer" | "coach";

export type WsRole = {
  key: WsRoleKey;
  label: string;   // full workspace label
  short: string;   // switcher chip label
  kind: string;    // consultation "kind" / persona kind
  icon: string;
  color: string;
};

export const WS_ROLES: WsRole[] = [
  { key: "doctor",  label: "Doctor Workspace",         short: "Doctor",    kind: "Doctor",  icon: "🩺", color: "#0ea5e9" },
  { key: "diet",    label: "Dietitian Workspace",      short: "Dietitian", kind: "Diet",    icon: "🍽", color: "#16a34a" },
  { key: "trainer", label: "Fitness Trainer Workspace", short: "Trainer",  kind: "Trainer", icon: "🎽", color: "#7c3aed" },
  { key: "coach",   label: "Health Coach Workspace",   short: "Coach",     kind: "Coach",   icon: "🌿", color: "#0d9488" },
];

export function wsRole(key: string | null | undefined): WsRole {
  return WS_ROLES.find((r) => r.key === key) ?? WS_ROLES[0];
}

// persona kind (lib/personas) → workspace role key
export function roleFromPersonaKind(kind: string | null | undefined): WsRoleKey | null {
  switch (kind) {
    case "Diet": return "diet";
    case "Trainer": return "trainer";
    case "Coach": return "coach";
    case "Doctor": return "doctor";
    default: return null;
  }
}

export type WsTab = {
  key: string;
  label: string;
  live?: boolean;   // rendered inside the workspace now
  href?: string;    // bridges to an existing page (Phase 1)
  note?: string;    // shown on stub tabs
};

// Tabs shared by every workspace (order matters).
function commonTabs(): WsTab[] {
  return [
    { key: "dash", label: "Dashboard", live: true },
    { key: "clients", label: "My Clients", live: true },
    { key: "appts", label: "📅 Appointments", live: true },
    { key: "summaries", label: "📝 Summaries", live: true },
    { key: "bp", label: "🧬 Blueprint", href: "/blueprint" },
    { key: "concerns", label: "⚠️ Concerns", live: true },
    { key: "team", label: "Integrated Dashboard", href: "/careteam" },
    { key: "monitor", label: "Client Monitoring", live: true },
    { key: "library", label: "Resource Library", live: true },
    { key: "board", label: "MDT", live: true },
  ];
}

// Insert role-specific tabs right after "clients".
function withRoleTabs(extra: WsTab[]): WsTab[] {
  const base = commonTabs();
  const at = base.findIndex((t) => t.key === "clients") + 1;
  return [...base.slice(0, at), ...extra, ...base.slice(at)];
}

export const WS_TABS: Record<WsRoleKey, WsTab[]> = {
  doctor: withRoleTabs([]),
  diet: withRoleTabs([
    { key: "meals", label: "🍽️ Meal Follow-ups", href: "/meals" },
    { key: "charts", label: "Diet Charts", live: true },
    { key: "recipes", label: "Recipes", live: true },
  ]),
  trainer: withRoleTabs([
    { key: "exlib", label: "Exercise Library", href: "/exlib" },
  ]),
  coach: withRoleTabs([
    { key: "followups", label: "Follow-ups", href: "/followups" },
  ]),
};

// ---- client scoping ---------------------------------------------------------
export type WsClient = {
  id: string;
  name: string;
  code: string | null;
  package_id: string | null;
  pro_id: string | null;
  conditions: string | null;
  goals: string[] | null;
};

const isDietPkg = (p: string | null) => !!p && (p.startsWith("comp") || p === "bp1");
const isBluePrint = (p: string | null) => p === "bp1";
const hasCondition = (c: WsClient) => {
  const t = (c.conditions ?? "").trim().toLowerCase();
  return t.length > 0 && t !== "none" && t !== "-";
};
const COACH_GOALS = ["healthy living", "regulate mood disorders", "manage health condition", "mental wellbeing"];

// Which clients belong in a given role's workspace.
export function scopeClients(role: WsRoleKey, clients: WsClient[], trainingClientIds: Set<string>): WsClient[] {
  switch (role) {
    case "trainer":
      return clients.filter((c) => trainingClientIds.has(c.id) || isDietPkg(c.package_id));
    case "diet":
      return clients.filter((c) => isDietPkg(c.package_id));
    case "doctor":
      return clients.filter((c) => hasCondition(c) || isBluePrint(c.package_id));
    case "coach":
      return clients.filter(
        (c) => isBluePrint(c.package_id) || (c.goals ?? []).some((g) => COACH_GOALS.includes(g.toLowerCase())),
      );
    default:
      return clients;
  }
}
