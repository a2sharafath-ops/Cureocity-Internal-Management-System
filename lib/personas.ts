// Professional "workspace personas" an Administrator can step into. Each maps
// to the clinician permission lens (Health Professional) plus a discipline that
// routes to that professional's actual workspace and filters what they see.

export type Persona = {
  key: string;          // stored in the preview_profession cookie
  label: string;        // shown in the switcher
  route: string;        // where entering the persona lands you
  kind?: string;        // consultation "kind" to filter by (for /pro workspaces)
  icon: string;
};

// Keys match the real discipline role names (lib/roles CLINICIAN_ROLES) so an
// Administrator previewing a persona gets that discipline's role + workspace.
export const PERSONAS: Persona[] = [
  { key: "Doctor",          label: "Doctor",         route: "/workspace?role=doctor",  kind: "Doctor",       icon: "🩺" },
  { key: "Dietitian",       label: "Dietitian",      route: "/workspace?role=diet",    kind: "Diet",         icon: "🍽" },
  { key: "Fitness Trainer", label: "Fitness Trainer", route: "/workspace?role=trainer", kind: "Trainer",     icon: "🎽" },
  { key: "Health Coach",    label: "Health Coach",   route: "/workspace?role=coach",   kind: "Coach",        icon: "🌿" },
  { key: "Psychologist",    label: "Psychologist",   route: "/workspace?role=psych",   kind: "Psychologist", icon: "🧠" },
];

export function getPersona(key: string | null | undefined): Persona | null {
  if (!key) return null;
  return PERSONAS.find((p) => p.key === key) ?? null;
}

export const PERSONA_KEYS = PERSONAS.map((p) => p.key);
