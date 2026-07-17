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

export const PERSONAS: Persona[] = [
  { key: "Doctor",       label: "Doctor",        route: "/pro",     kind: "Doctor",       icon: "🩺" },
  { key: "Dietitian",    label: "Dietitian",     route: "/meals",   kind: "Diet",         icon: "🍽" },
  { key: "Trainer",      label: "Trainer",       route: "/trainer", kind: "Trainer",      icon: "🎽" },
  { key: "Health Coach", label: "Health Coach",  route: "/pro",     kind: "Coach",        icon: "🌿" },
  { key: "Psychologist", label: "Psychologist",  route: "/pro",     kind: "Psychologist", icon: "🧠" },
];

export function getPersona(key: string | null | undefined): Persona | null {
  if (!key) return null;
  return PERSONAS.find((p) => p.key === key) ?? null;
}

export const PERSONA_KEYS = PERSONAS.map((p) => p.key);
