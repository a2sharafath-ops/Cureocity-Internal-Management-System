// Turning a printable page into an actual PDF file.
//
// Every printable document in the app is a web page styled for A4. That is
// right for a person — they press Print and their browser makes the PDF — but
// it means no PDF FILE exists anywhere. WhatsApp can't use it: Wati sends a
// document by fetching a URL and expecting PDF bytes back, and it cannot sign
// in, load a page and press Ctrl-P.
//
// There is a second reason, and it matters more than the first. The print page
// renders TODAY'S data. Revise a diet plan and yesterday's URL silently shows
// the new one — so there is no way to show what a client was actually given on
// the day. A stored file is frozen at the moment of issue.
//
// Two providers behind one interface. Neither is wired by default: with no
// environment configured, `pdfProvider()` returns null and every caller reports
// that plainly instead of half-working.

import crypto from "crypto";

export type PdfProvider = {
  /** Shown in the UI and the audit trail, so a bad render is traceable. */
  name: string;
  /** Fetch `url`, render it as A4, return the PDF bytes. */
  render: (url: string) => Promise<Uint8Array>;
};

/** The documents that can be rendered. Each maps to a print route. */
export const DOC_KINDS = ["plan", "rx", "lab", "summary", "assess"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const DOC_LABEL: Record<DocKind, string> = {
  plan: "Diet plan",
  rx: "Prescription",
  lab: "Lab requisition",
  summary: "Consultation summary",
  assess: "Dietary assessment summary",
};

/** Where each document's printable page lives. */
export function printPath(kind: DocKind, id: string): string {
  switch (kind) {
    case "plan": return `/diet-plan/${id}/print`;
    case "rx": return `/rx/${id}/print`;
    case "lab": return `/lab/${id}/print`;
    case "summary": return `/consult/${id}/print`;
    case "assess": return `/diet-assessment/${id}/print`;
  }
}

/** Storage path inside the private `documents` bucket. Versioned by issue time
 *  so re-issuing never overwrites the file a client was already sent. */
export function storagePath(kind: DocKind, id: string, issuedAt: Date = new Date()): string {
  // Avoid a bracket character class here: Tailwind scans lib/**/*.ts comments
  // too and can mistake that regex syntax for an arbitrary CSS utility. The
  // alternation removes the same three characters without creating a token.
  const stamp = issuedAt.toISOString().replace(/-|:|T/g, "").slice(0, 14);
  return `${kind}/${id}-${stamp}.pdf`;
}

/** "Diet plan — Arun joy — 21 Jul 2026.pdf" — what the client sees when they
 *  save the attachment. A filename of `a3f9c2…pdf` helps nobody. */
export function fileName(kind: DocKind, clientName: string, issuedOn?: string | null): string {
  const when = issuedOn
    ? new Date(`${issuedOn}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const safe = clientName.replace(/[^\w\s.-]/g, "").trim() || "Client";
  return `${DOC_LABEL[kind]} — ${safe} — ${when}.pdf`;
}

// ---- access for a renderer that has no session ------------------------------
//
// The print pages are behind auth, and rightly so. A rendering service is an
// outside machine with no cookie, so it needs some other way in. Making the
// pages public is not an option — they carry clinical detail.
//
// So: a short-lived token, signed with a server secret, naming exactly one
// document. It cannot be guessed, it cannot be widened to another document, and
// it expires in minutes. The print page verifies it and, if valid, renders for
// that one id.

const TOKEN_TTL_MS = 10 * 60 * 1000;   // long enough for a slow render, no more

function secret(): string | null {
  return process.env.DOC_TOKEN_SECRET || null;
}

function hmac(payload: string, key: string): string {
  return crypto.createHmac("sha256", key).update(payload).digest("hex");
}

/** Sign a token for one document. Returns null when no secret is configured —
 *  the caller must treat that as "rendering is not set up", not as "allow". */
export function signDocToken(kind: DocKind, id: string, now: number = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  const exp = now + TOKEN_TTL_MS;
  const payload = `${kind}.${id}.${exp}`;
  return `${exp}.${hmac(payload, key)}`;
}

/**
 * Verify a token against the document being asked for.
 *
 * Fails closed in every ambiguous case: no secret, malformed token, expired,
 * or a signature that doesn't match THIS kind and id. The comparison is
 * timing-safe — a plain `===` on an HMAC leaks the signature a byte at a time
 * to anyone willing to make enough requests.
 */
export function verifyDocToken(token: string | null | undefined, kind: DocKind, id: string, now: number = Date.now()): boolean {
  const key = secret();
  if (!key || !token) return false;
  const [expRaw, sig] = String(token).split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || !sig) return false;
  if (exp < now) return false;
  const expected = hmac(`${kind}.${id}.${exp}`, key);
  const a = Buffer.from(sig, "hex"), b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ---- providers --------------------------------------------------------------

/**
 * Browserless — hosted headless Chrome. Renders the same page a person prints,
 * so the file is identical to what comes out of the office printer.
 */
function browserless(token: string, base = "https://production-sfo.browserless.io"): PdfProvider {
  return {
    name: "Browserless",
    async render(url: string) {
      const res = await fetch(`${base}/pdf?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          // printBackground is essential: the coral cover and the black meal
          // section are backgrounds. Without it the plan renders as white paper
          // with white text on it.
          options: { format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } },
          gotoOptions: { waitUntil: "networkidle2", timeout: 45000 },
        }),
      });
      if (!res.ok) throw new Error(`Browserless ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}

/** PDFShift — same job, different vendor. Kept so a switch is a config change. */
function pdfshift(apiKey: string): PdfProvider {
  return {
    name: "PDFShift",
    async render(url: string) {
      const res = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
        },
        body: JSON.stringify({ source: url, format: "A4", margin: "0", use_print: true }),
      });
      if (!res.ok) throw new Error(`PDFShift ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}

/**
 * Whichever provider is configured, or null.
 *
 * Null is a real answer, not a failure to handle: it means nobody has set this
 * up yet, and the UI should say so rather than offering a button that errors.
 */
export function pdfProvider(): PdfProvider | null {
  if (process.env.BROWSERLESS_TOKEN) {
    return browserless(process.env.BROWSERLESS_TOKEN, process.env.BROWSERLESS_URL || undefined);
  }
  if (process.env.PDFSHIFT_API_KEY) return pdfshift(process.env.PDFSHIFT_API_KEY);
  return null;
}

/** Everything a render needs, or a plain reason it can't happen. */
export function pdfReadiness(): { ready: boolean; provider: string | null; missing: string[] } {
  const missing: string[] = [];
  const p = pdfProvider();
  if (!p) missing.push("a rendering provider (BROWSERLESS_TOKEN or PDFSHIFT_API_KEY)");
  if (!secret()) missing.push("DOC_TOKEN_SECRET");
  if (!appBaseUrl()) missing.push("NEXT_PUBLIC_APP_URL");
  return { ready: missing.length === 0, provider: p?.name ?? null, missing };
}

/**
 * The app's own public address.
 *
 * The renderer fetches over the internet, so a relative path is useless to it
 * and localhost is worse — it would render whatever is running on the RENDERING
 * service's own machine.
 */
export function appBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  if (!raw) return null;
  const url = raw.startsWith("http") ? raw : `https://${raw}`;
  return url.replace(/\/+$/, "");
}

/** The absolute, token-carrying URL a renderer should fetch. */
export function renderUrl(kind: DocKind, id: string): string | null {
  const base = appBaseUrl();
  const token = signDocToken(kind, id);
  if (!base || !token) return null;
  return `${base}${printPath(kind, id)}?doc_token=${encodeURIComponent(token)}`;
}
