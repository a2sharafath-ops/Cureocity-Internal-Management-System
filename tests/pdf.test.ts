import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { signDocToken, verifyDocToken, printPath, storagePath, fileName, pdfReadiness, appBaseUrl, renderUrl } from "@/lib/pdf";

const SECRET = "test-secret-value";
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {
    DOC_TOKEN_SECRET: process.env.DOC_TOKEN_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    BROWSERLESS_TOKEN: process.env.BROWSERLESS_TOKEN,
    PDFSHIFT_API_KEY: process.env.PDFSHIFT_API_KEY,
  };
  process.env.DOC_TOKEN_SECRET = SECRET;
  process.env.NEXT_PUBLIC_APP_URL = "https://app.cureo.city";
  delete process.env.BROWSERLESS_TOKEN;
  delete process.env.PDFSHIFT_API_KEY;
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

describe("document tokens", () => {
  it("verifies a token it just signed", () => {
    const t = signDocToken("plan", "abc")!;
    expect(verifyDocToken(t, "plan", "abc")).toBe(true);
  });

  it("refuses a token issued for a different document", () => {
    const t = signDocToken("plan", "abc")!;
    expect(verifyDocToken(t, "plan", "xyz")).toBe(false);
  });

  it("refuses a token issued for a different document TYPE", () => {
    // Without binding the kind, a diet-plan token would open the prescription
    // with the same row id.
    const t = signDocToken("plan", "abc")!;
    expect(verifyDocToken(t, "rx", "abc")).toBe(false);
  });

  it("expires", () => {
    const now = Date.now();
    const t = signDocToken("plan", "abc", now)!;
    expect(verifyDocToken(t, "plan", "abc", now + 60_000)).toBe(true);
    expect(verifyDocToken(t, "plan", "abc", now + 11 * 60_000)).toBe(false);
  });

  it("refuses a tampered expiry — the signature covers it", () => {
    const now = Date.now();
    const t = signDocToken("plan", "abc", now)!;
    const [, sig] = t.split(".");
    const stretched = `${now + 10 * 365 * 24 * 3600_000}.${sig}`;
    expect(verifyDocToken(stretched, "plan", "abc")).toBe(false);
  });

  it("refuses rubbish without throwing", () => {
    for (const bad of ["", "   ", "nonsense", "123", "123.", ".abc", "abc.def", null, undefined]) {
      expect(verifyDocToken(bad as string | null, "plan", "abc")).toBe(false);
    }
  });

  it("fails closed when no secret is configured", () => {
    const t = signDocToken("plan", "abc")!;
    delete process.env.DOC_TOKEN_SECRET;
    expect(signDocToken("plan", "abc")).toBeNull();
    expect(verifyDocToken(t, "plan", "abc")).toBe(false);
  });

  it("refuses a token signed with a different secret", () => {
    const t = signDocToken("plan", "abc")!;
    process.env.DOC_TOKEN_SECRET = "someone-elses-secret";
    expect(verifyDocToken(t, "plan", "abc")).toBe(false);
  });
});

describe("paths and names", () => {
  it("points at the right print route per document", () => {
    expect(printPath("plan", "1")).toBe("/diet-plan/1/print");
    expect(printPath("rx", "1")).toBe("/rx/1/print");
    expect(printPath("lab", "1")).toBe("/lab/1/print");
    expect(printPath("summary", "1")).toBe("/consult/1/print");
  });

  it("versions the stored file by issue time so a re-issue never overwrites", () => {
    const a = storagePath("plan", "abc", new Date("2026-07-21T10:00:00Z"));
    const b = storagePath("plan", "abc", new Date("2026-08-05T09:30:00Z"));
    expect(a).not.toBe(b);
    expect(a.startsWith("plan/abc-")).toBe(true);
    expect(a.endsWith(".pdf")).toBe(true);
  });

  it("names the file for a human, not a database", () => {
    expect(fileName("plan", "Arun joy", "2026-07-21")).toBe("Diet plan — Arun joy — 21 Jul 2026.pdf");
  });

  it("strips characters that break a download", () => {
    const n = fileName("rx", 'A/B\\C:"*?<>|', "2026-07-21");
    expect(n).not.toMatch(/[/\\:"*?<>|]/);
  });

  it("falls back to a usable name when the client has none", () => {
    expect(fileName("lab", "   ", "2026-07-21")).toContain("Client");
  });
});

describe("base url", () => {
  it("adds a scheme and trims a trailing slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "app.cureo.city/";
    expect(appBaseUrl()).toBe("https://app.cureo.city");
  });
  it("is null when unset — a renderer cannot fetch a relative path", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(appBaseUrl()).toBeNull();
  });
});

describe("readiness", () => {
  it("reports exactly what is missing rather than just failing", () => {
    delete process.env.DOC_TOKEN_SECRET;
    delete process.env.NEXT_PUBLIC_APP_URL;
    const r = pdfReadiness();
    expect(r.ready).toBe(false);
    expect(r.provider).toBeNull();
    expect(r.missing.join(" ")).toMatch(/BROWSERLESS_TOKEN/);
    expect(r.missing.join(" ")).toMatch(/DOC_TOKEN_SECRET/);
    expect(r.missing.join(" ")).toMatch(/NEXT_PUBLIC_APP_URL/);
  });

  it("is ready once a provider and the secrets are set", () => {
    process.env.BROWSERLESS_TOKEN = "tok";
    const r = pdfReadiness();
    expect(r.ready).toBe(true);
    expect(r.provider).toBe("Browserless");
  });

  it("builds an absolute, token-carrying url only when configured", () => {
    process.env.BROWSERLESS_TOKEN = "tok";
    const u = renderUrl("plan", "abc")!;
    expect(u.startsWith("https://app.cureo.city/diet-plan/abc/print?doc_token=")).toBe(true);
    delete process.env.DOC_TOKEN_SECRET;
    expect(renderUrl("plan", "abc")).toBeNull();
  });
});

describe("the assessment is its own document kind", () => {
  it("routes to its own print page", () => {
    expect(printPath("assess", "abc")).toBe("/diet-assessment/abc/print");
  });

  it("a consultation-summary token cannot open an assessment with the same id", () => {
    // The token exists to name ONE document. Sharing a kind between two tables
    // would make that property depend on ids never colliding, which is not the
    // guarantee it was built to give.
    const t = signDocToken("summary", "abc")!;
    expect(verifyDocToken(t, "assess", "abc")).toBe(false);
    const a = signDocToken("assess", "abc")!;
    expect(verifyDocToken(a, "summary", "abc")).toBe(false);
    expect(verifyDocToken(a, "assess", "abc")).toBe(true);
  });

  it("stores under its own prefix", () => {
    expect(storagePath("assess", "abc").startsWith("assess/")).toBe(true);
  });
});
