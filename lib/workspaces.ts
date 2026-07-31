// Professional role workspaces (prototype "role cockpit" model).
// Four disciplines, each with its own tab set. Tabs are either:
//   • live  — rendered inside the workspace now (Phase 1: dash, clients)
//   • href  — bridges to an existing standalone page until embedded
//   • stub  — a module slated for a later phase (Concerns, MDT, etc.)

export type WsRoleKey = "doctor" | "diet" | "trainer" | "coach" | "psych";

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
  { key: "diet",    label: "Dietitian Workspace",      short: "Dietitian", kind: "Diet",    icon: "🍽", color: "var(--green)" },
  { key: "trainer", label: "Fitness Trainer Workspace", short: "Trainer",  kind: "Trainer", icon: "🎽", color: "var(--purple)" },
  { key: "coach",   label: "Health Coach Workspace",   short: "Coach",     kind: "Coach",   icon: "🌿", color: "#e11f34" },
  { key: "psych",   label: "Psychology Workspace",     short: "Psychologist", kind: "Psychologist", icon: "💬", color: "#db2777" },
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
    case "Psychologist": return "psych";
    default: return null;
  }
}

// ---- workspace access ------------------------------------------------------
// A clinician gets ONE workspace: their own. They never open another
// discipline's dashboard. Cross-discipline access is limited to *client
// details* they're permitted to see, which the database enforces via RLS
// (can_read_ws / can_read_consult_kind in supabase/0068) — not via workspaces.
// Only Admin/Manager/Super Admin can step through every discipline (oversight).
const WS_OVERSIGHT = ["Administrator", "Super Admin", "Manager"];

// The discipline workspace this login role opens. Always at most ONE — nobody
// (not even an admin) gets an in-workspace switcher. Admins move between
// disciplines with the header "Enter as …" persona dropdown, which resolves to
// that discipline here, so their view matches a real clinician's exactly.
export function visibleWorkspaces(loginRole: string): WsRoleKey[] {
  const own = roleFromStaffRole(loginRole);
  if (own) return [own];
  // Oversight roles may open ANY discipline workspace — so deep links like
  // "?role=trainer" (e.g. a dashboard "workout plan not created" flag) resolve
  // to that discipline instead of falling back to doctor. The default landing
  // (no ?role) is still doctor; the header persona menu is the usual switch.
  if (WS_OVERSIGHT.includes(loginRole)) return ["doctor", "diet", "trainer", "coach", "psych"];
  return [];
}

// Can this login role EDIT the given discipline workspace (vs view-only)?
// Admins/managers edit anywhere; a clinician edits only their own discipline.
export function canEditWorkspace(loginRole: string, key: WsRoleKey): boolean {
  if (WS_OVERSIGHT.includes(loginRole)) return true;
  return roleFromStaffRole(loginRole) === key;
}

// a professional's real login role (lib/roles) → their workspace role key
export function roleFromStaffRole(role: string | null | undefined): WsRoleKey | null {
  switch (role) {
    case "Doctor": return "doctor";
    case "Dietitian": return "diet";
    case "Fitness Trainer": return "trainer";
    case "Health Coach": return "coach";
    case "Psychologist": return "psych";
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
    { key: "appts", label: "Appointments", live: true },
    { key: "summaries", label: "Summaries", live: true },
    { key: "bp", label: "BluePrint", live: true },
    // The daily team meeting — every discipline takes part, so it sits in the
    // common set rather than any one workspace's role tabs.
    { key: "whiteboard", label: "Whiteboard", live: true },
    { key: "concerns", label: "Concerns", live: true },
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
  psych: withRoleTabs([]),
  // Diet uses an explicit order (role tabs are interleaved with the common set,
  // so the shared withRoleTabs insertion point can't express it).
  diet: [
    { key: "dash", label: "Dashboard", live: true },
    { key: "clients", label: "My Clients", live: true },
    { key: "appts", label: "Appointments", live: true },
    { key: "summaries", label: "Summaries", live: true },
    { key: "bp", label: "BluePrint", live: true },
    { key: "charts", label: "Diet Charts", live: true },
    { key: "meals", label: "Meal Monitoring", live: true },
    { key: "whiteboard", label: "Whiteboard", live: true },
    { key: "concerns", label: "Concerns", live: true },
    { key: "board", label: "MDT", live: true },
    { key: "recipes", label: "Recipes", live: true },
    { key: "library", label: "Resource Library", live: true },
  ],
  trainer: withRoleTabs([
    { key: "planner", label: "Workout Planner", live: true },
    { key: "exlib", label: "Exercise Library", live: true },
  ]),
  coach: withRoleTabs([
    { key: "coaching", label: "Health Coaching", live: true },
    { key: "followups", label: "Follow-ups", live: true },
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
const PSYCH_GOALS = ["regulate mood disorders", "mental wellbeing", "manage stress", "sleep", "anxiety"];

// Which clients belong in a given role's workspace.
export function scopeClients(role: WsRoleKey, clients: WsClient[], trainingClientIds: Set<string>, assignedIds: Set<string> = new Set()): WsClient[] {
  // Care-team assignment is the source of truth — a client assigned to this
  // discipline always shows, regardless of legacy package_id / goal heuristics.
  const assigned = (c: WsClient) => assignedIds.has(c.id);
  switch (role) {
    case "trainer":
      return clients.filter((c) => assigned(c) || trainingClientIds.has(c.id) || isDietPkg(c.package_id));
    case "diet":
      return clients.filter((c) => assigned(c) || isDietPkg(c.package_id));
    case "doctor":
      return clients.filter((c) => assigned(c) || hasCondition(c) || isBluePrint(c.package_id));
    case "coach":
      return clients.filter(
        (c) => assigned(c) || isBluePrint(c.package_id) || (c.goals ?? []).some((g) => COACH_GOALS.includes(g.toLowerCase())),
      );
    case "psych":
      return clients.filter(
        (c) => assigned(c) || isBluePrint(c.package_id) || (c.goals ?? []).some((g) => PSYCH_GOALS.some((p) => g.toLowerCase().includes(p))),
      );
    default:
      return clients;
  }
}
