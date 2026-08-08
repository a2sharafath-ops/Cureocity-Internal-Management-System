import { describe, it, expect } from "vitest";
import { printPath, type DocKind } from "@/lib/pdf";

// The first live PDF render came back as a photograph of the sign-in screen:
// middleware redirected the renderer (which has no session cookie) to /login
// before the print page could check its token.
//
// Middleware now skips the redirect for a print URL carrying a doc_token. This
// is the pattern it matches — kept here because the regex lives in the edge
// middleware, where printPath() cannot be imported, so the two can drift.
const PRINT_ROUTE = /^\/(diet-plan|rx|lab|consult|diet-assessment)\/[^/]+\/print$/;

const KINDS: DocKind[] = ["plan", "rx", "lab", "summary", "assess"];

describe("middleware print-route pattern", () => {
  it("matches the print URL of every document kind", () => {
    for (const k of KINDS) {
      const path = printPath(k, "b3214ae4-e159-455b-81b4-13f381de02bb");
      expect(PRINT_ROUTE.test(path), `${k} → ${path}`).toBe(true);
    }
  });

  it("does not match anything else in the app", () => {
    for (const p of [
      "/dashboard", "/login", "/workspace", "/clients/abc",
      "/consult/abc",                  // the console, not the printable
      "/diet-plan/abc",                // ditto
      "/rx/abc/print/extra",           // deeper path
      "/api/cron/daily",
    ]) {
      expect(PRINT_ROUTE.test(p), p).toBe(false);
    }
  });

  it("does not match a print path with a missing id", () => {
    expect(PRINT_ROUTE.test("/rx//print")).toBe(false);
  });
});
