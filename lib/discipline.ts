// Discipline write-ownership — mirrors the RLS policies in
// supabase/0067_discipline_write_rls.sql. The database is authoritative; this
// exists so server actions can fail fast with a readable message instead of a
// silent RLS rejection. KEEP THE TWO IN SYNC.

const ADMIN = ["Administrator", "Super Admin", "Manager"];
const isAdmin = (role: string) => ADMIN.includes(role);

// discipline login role → workspace key (matches my_ws_key() in SQL)
export function wsKeyForRole(role: string): string | null {
  switch (role) {
    case "Doctor": return "doctor";
    case "Dietitian": return "diet";
    case "Fitness Trainer": return "trainer";
    case "Health Coach": return "coach";
    case "Psychologist": return "psych";
    default: return null;
  }
}

// consultation `kind` owned by this role (matches owns_consult_kind())
export function ownsConsultKind(role: string, kind: string): boolean {
  if (isAdmin(role)) return true;
  switch (role) {
    case "Doctor": return kind === "Doctor";
    case "Dietitian": return kind === "Diet";
    case "Fitness Trainer": return kind === "Trainer";
    case "Health Coach": return kind === "Coach";
    case "Psychologist": return kind === "Psychologist";
    default: return false;
  }
}

// medical records, prescriptions, orders
export function canWriteMedical(role: string): boolean {
  return isAdmin(role) || role === "Doctor";
}

// diet charts + recipes
export function canWriteNutrition(role: string): boolean {
  return isAdmin(role) || role === "Dietitian";
}

// concerns / resource files carry their own `role` column
export function canWriteRoleScoped(role: string, rowRole: string | null, extra: string[] = []): boolean {
  if (isAdmin(role)) return true;
  const mine = wsKeyForRole(role);
  return !!rowRole && (rowRole === mine || extra.includes(rowRole));
}
