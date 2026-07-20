// Bridges a login (profiles) to the care-provider directory (staff).
//
// A login on its own can sign in but can't be booked — appointments, sessions,
// classes and HR all reference staff(id). Every non-client login therefore gets
// a matching directory row, created at invite time.

export type DirectoryDefaults = {
  designation: string;
  department: string;
  is_trainer: boolean;
  color: string;
};

// designation is read by the appointments page to derive a booking discipline,
// so for clinical roles it must stay equal to the role name.
const BY_ROLE: Record<string, DirectoryDefaults> = {
  "Doctor": { designation: "Doctor", department: "Clinical", is_trainer: false, color: "#dc2626" },
  "Dietitian": { designation: "Dietitian", department: "Clinical", is_trainer: false, color: "var(--blue)" },
  "Fitness Trainer": { designation: "Fitness Trainer", department: "Fitness", is_trainer: true, color: "#e11f34" },
  "Health Coach": { designation: "Health Coach", department: "Clinical", is_trainer: false, color: "var(--purple)" },
  "Psychologist": { designation: "Psychologist", department: "Clinical", is_trainer: false, color: "#db2777" },
  "Front Desk": { designation: "Front Desk", department: "Front Desk", is_trainer: false, color: "#0891b2" },
  "Manager": { designation: "Manager", department: "Management", is_trainer: false, color: "#475569" },
  "Administrator": { designation: "Administrator", department: "Management", is_trainer: false, color: "#1f2937" },
  "Super Admin": { designation: "Founder", department: "Management", is_trainer: false, color: "#111827" },
  "Finance": { designation: "Finance Executive", department: "Finance", is_trainer: false, color: "#ca8a04" },
  "HR": { designation: "HR Executive", department: "People", is_trainer: false, color: "#9333ea" },
  "Staff": { designation: "Staff", department: "Operations", is_trainer: false, color: "#64748b" },
};

export function directoryDefaults(role: string): DirectoryDefaults {
  return BY_ROLE[role] ?? BY_ROLE["Staff"];
}

/** Clients live in `clients`, never in the staff directory. */
export function needsDirectoryRow(role: string): boolean {
  return role !== "Client";
}

/**
 * Human-readable, stable id from a name (falling back to the email local-part),
 * de-duplicated against ids already in use: "Sini Antony" -> "sini-antony".
 */
export function staffIdFor(name: string, email: string, taken: string[] = []): string {
  const source = (name || "").trim() || (email || "").split("@")[0] || "staff";
  const base =
    source
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "staff";

  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/** Names match when they're equal, or one is a prefix of the other ("Sini" ~ "Sini Antony"). */
export function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = (a ?? "").trim().toLowerCase();
  const y = (b ?? "").trim().toLowerCase();
  if (!x || !y) return false;
  return x === y || x.startsWith(y + " ") || y.startsWith(x + " ");
}
