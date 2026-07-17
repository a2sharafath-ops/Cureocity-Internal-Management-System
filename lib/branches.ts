// The centres Cureocity operates. Used for branch labels + filters across the app.
export const BRANCHES = ["Kochi", "Calicut"] as const;
export type Branch = (typeof BRANCHES)[number];
