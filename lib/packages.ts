// Package taxonomy + the membership-prerequisite business rule.
//
// Rule: Personal Training (PT) and Comprehensive packages can only be sold to a
// client who holds a *valid, in-date* membership (a facility membership package)
// that covers the start date of the PT/Comprehensive package.

export type PkgCategory = "membership" | "training" | "comprehensive" | "blueprint" | "other";

// Derive a package's category from its id + facility flag.
export function packageCategory(pkgId: string | null | undefined, isFacility: boolean): PkgCategory {
  if (isFacility) return "membership";              // fm4 / fm12 / fm24 / fm48
  if (!pkgId) return "other";
  if (pkgId.startsWith("pt")) return "training";     // pt4 / pt12
  if (pkgId.startsWith("comp")) return "comprehensive"; // comp4 / comp12
  if (pkgId === "bp1") return "blueprint";
  return "other";
}

// PT + Comprehensive require an active membership first.
export function requiresMembership(cat: PkgCategory): boolean {
  return cat === "training" || cat === "comprehensive";
}

export type MembershipRow = { category: string; start_date: string | null; end_date: string | null };

// Is there a membership active on `date` (default today)?
export function hasActiveMembership(rows: MembershipRow[], date: string): boolean {
  return rows.some(
    (r) =>
      r.category === "membership" &&
      (!r.start_date || r.start_date <= date) &&
      (!r.end_date || r.end_date >= date)
  );
}

// Add `days` to an ISO date → ISO date.
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const MEMBERSHIP_RULE_MSG =
  "This client needs an active membership before a PT or Comprehensive package can be purchased. Sell (or renew) a facility membership that covers the start date first.";
