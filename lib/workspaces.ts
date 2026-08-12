// Professional role workspaces (the "role cockpit" model).
// Five disciplines, each with its own tab set. Every tab renders inside the
// workspace — there are no stubs and no bridges to standalone pages any more.

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
  { key: "trainer", label: "Fitness Trainer Workspace", short: "Fitness Trainer", kind: "Trainer", icon: "🎽", color: "var(--purple)" },
  { key: "coach",   label: "Health Coach Workspace",   short: "Health Coach", kind: "Coach",   icon: "🌿", color: "#e11f34" },
  { key: "psych",   label: "Psychologist Workspace", short: "Psychologist", kind: "Psychologist", icon: "💬", color: "#db2777" },
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
// The Medical Director is here rather than in roleFromStaffRole below: mapping
// them to one discipline would hide the other four, and the diet-chart queue
// they exist to approve lives in the DIET workspace, not the doctor's.
const WS_OVERSIGHT = ["Administrator", "Super Admin", "Manager", "Medical Director"];

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

// `live`, `href` and `note` were Phase-1 scaffolding: a tab could be a stub
// with a "coming later" note, or a bridge to a standalone page. Every tab is
// now rendered in-place, so all three were dead — the stub renderer could never
// match, and no tab ever set an href. Removed along with the two tab branches
// (`team`, `monitor`) that were rendered but listed in no workspace.
export type WsTab = {
  key: string;
  label: string;
};

// Tabs shared by every workspace (order matters).
function commonTabs(): WsTab[] {
  return [
    { key: "dash", label: "Today" },
    { key: "clients", label: "My clients" },
    { key: "appts", label: "Appointments" },
    { key: "summaries", label: "Summaries" },
    { key: "bp", label: "BluePrint" },
    // The daily team meeting — every discipline takes part, so it sits in the
    // common set rather than any one workspace's role tabs.
    { key: "whiteboard", label: "Whiteboard" },
    { key: "concerns", label: "Concerns" },
    { key: "library", label: "Resource library" },
    { key: "board", label: "MDT board" },
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
    { key: "dash", label: "Today" },
    { key: "clients", label: "My clients" },
    { key: "appts", label: "Appointments" },
    { key: "summaries", label: "Summaries" },
    { key: "bp", label: "BluePrint" },
    { key: "charts", label: "Diet charts" },
    { key: "meals", label: "Meal monitoring" },
    { key: "whiteboard", label: "Whiteboard" },
    { key: "concerns", label: "Concerns" },
    { key: "board", label: "MDT board" },
    { key: "recipes", label: "Recipes" },
    // The costed recipe library: ingredients in grams against the ICMR food
    // table, so a chart's calories are calculated rather than recalled.
    { key: "dishes", label: "Dish library" },
    { key: "library", label: "Resource library" },
  ],
  trainer: withRoleTabs([
    { key: "planner", label: "Workout planner" },
    { key: "exlib", label: "Exercise library" },
  ]),
  coach: withRoleTabs([
    { key: "coaching", label: "Health coaching" },
    { key: "followups", label: "Follow-ups" },
    { key: "quality", label: "Quality" },
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
export function scopeClients(role: WsRoleKey, clients: WsClient[], trainingClientIds: Set<string>, assignedIds: Set<string> = new Set(), otherClinicianIds: Set<string> = new Set()): WsClient[] {
  // Care-team assignment is the source of truth — a client assigned to THIS
  // clinician always shows, regardless of legacy package_id / goal heuristics.
  const assigned = (c: WsClient) => assignedIds.has(c.id);
  // …and a client explicitly assigned to a *different* clinician of the same
  // discipline must never leak in via those heuristics (so a new coach doesn't
  // inherit another coach's roster just because the client is Comprehensive).
  const ownedByOther = (c: WsClient) => otherClinicianIds.has(c.id) && !assignedIds.has(c.id);
  const heuristic = (c: WsClient, match: boolean) => match && !ownedByOther(c);
  switch (role) {
    case "trainer":
      return clients.filter((c) => assigned(c) || heuristic(c, trainingClientIds.has(c.id) || isDietPkg(c.package_id)));
    case "diet":
      return clients.filter((c) => assigned(c) || heuristic(c, isDietPkg(c.package_id)));
    case "doctor":
      return clients.filter((c) => assigned(c) || heuristic(c, hasCondition(c) || isBluePrint(c.package_id)));
    case "coach":
      return clients.filter(
        (c) => assigned(c) || heuristic(c, isBluePrint(c.package_id) || (c.goals ?? []).some((g) => COACH_GOALS.includes(g.toLowerCase()))),
      );
    case "psych":
      return clients.filter(
        (c) => assigned(c) || heuristic(c, isBluePrint(c.package_id) || (c.goals ?? []).some((g) => PSYCH_GOALS.some((p) => g.toLowerCase().includes(p)))),
      );
    default:
      return clients;
  }
}
