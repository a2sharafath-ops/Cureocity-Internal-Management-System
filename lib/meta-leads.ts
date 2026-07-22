// Meta (Instagram/Facebook) Lead Ads — webhook parsing + field mapping.
//
// The awkward part of Meta lead ads, and the reason this is more code than the
// website form: the webhook does NOT contain the lead. It contains a
// `leadgen_id` and effectively says "a lead came in, come and fetch it". The
// route then has to call the Graph API with a page token to retrieve the actual
// answers. This file holds the pure, testable pieces of that dance:
//
//   verifySignature  — is this POST genuinely from Meta?
//   parseLeadgenIds  — pull the lead ids out of the webhook envelope
//   mapFieldData     — turn Meta's field_data array into our IngestInput
//
// Kept separate from the route so the mapping (the bit most likely to be
// wrong) can be unit-tested without a live webhook or a Graph token.

import { createHmac, timingSafeEqual } from "crypto";
import type { IngestInput } from "@/lib/ingest-lead";

/**
 * Verify the `X-Hub-Signature-256` header against the raw body using the app
 * secret. Meta signs every webhook; without this check anyone who learns the
 * URL could inject fake leads.
 */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret) return false;
  // Header format: "sha256=<hex>"
  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(a, b); } catch { return false; }
}

/** The shape Meta POSTs. Only the parts we use are typed. */
export type LeadgenWebhook = {
  object?: string;
  entry?: {
    id?: string;
    changes?: {
      field?: string;
      value?: {
        leadgen_id?: string;
        form_id?: string;
        page_id?: string;
        ad_id?: string;
        adgroup_id?: string;
        created_time?: number;
      };
    }[];
  }[];
};

export type LeadgenRef = {
  leadgenId: string;
  formId: string | null;
  adId: string | null;
};

/**
 * Extract every leadgen id from the envelope. A single webhook can batch
 * several, and Meta retries, so the caller must dedupe downstream (ingestLead
 * already does, by phone).
 */
export function parseLeadgenIds(body: LeadgenWebhook): LeadgenRef[] {
  if (body.object !== "page" && body.object !== "instagram") return [];
  const out: LeadgenRef[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const v = change.value;
      if (!v?.leadgen_id) continue;
      out.push({ leadgenId: v.leadgen_id, formId: v.form_id ?? null, adId: v.ad_id ?? null });
    }
  }
  return out;
}

/** One answer on the lead form, as the Graph API returns it. */
export type FieldEntry = { name?: string; values?: string[] };

const first = (f?: FieldEntry): string => (f?.values?.[0] ?? "").trim();

/**
 * Map Meta's `field_data` to our IngestInput.
 *
 * Standard Meta field keys are stable (`full_name`, `phone_number`, `email`,
 * `city`, …). Custom questions ("What's your goal?") come back under
 * whatever key the advertiser named them, which we can't know ahead of time —
 * so anything unrecognised is preserved into `notes` rather than dropped. A
 * lead where we couldn't find a name still gets a placeholder so it is never
 * silently lost; the phone or email is what makes it workable anyway.
 */
export function mapFieldData(fields: FieldEntry[], meta?: { adId?: string | null; formId?: string | null }): IngestInput {
  const byName = new Map<string, FieldEntry>();
  for (const f of fields) if (f.name) byName.set(f.name.toLowerCase(), f);

  const get = (...keys: string[]): string => {
    for (const k of keys) { const v = first(byName.get(k)); if (v) return v; }
    return "";
  };

  const fullName = get("full_name", "name");
  const firstName = get("first_name");
  const lastName = get("last_name");
  const name = fullName || [firstName, lastName].filter(Boolean).join(" ").trim() || "Instagram lead";

  const phone = get("phone_number", "work_phone_number", "phone");
  const email = get("email", "work_email");
  const city = get("city");
  const state = get("state");
  const location = [city, state].filter(Boolean).join(", ") || null;

  // Interest / goals often ARE custom questions, so probe the common phrasings.
  const interest = get("interest", "which_service", "service", "what_are_you_interested_in") || null;
  const goals = get("goal", "goals", "what_is_your_goal", "fitness_goal") || null;

  // Everything we didn't explicitly map (extra custom questions) is worth
  // keeping — the sales rep will want it on the call.
  const mappedKeys = new Set([
    "full_name", "name", "first_name", "last_name", "phone_number", "work_phone_number",
    "phone", "email", "work_email", "city", "state",
    "interest", "which_service", "service", "what_are_you_interested_in",
    "goal", "goals", "what_is_your_goal", "fitness_goal",
  ]);
  const extras: string[] = [];
  for (const f of fields) {
    const k = (f.name ?? "").toLowerCase();
    if (!k || mappedKeys.has(k)) continue;
    const v = first(f);
    if (v) extras.push(`${f.name}: ${v}`);
  }
  const noteParts: string[] = [];
  if (meta?.adId) noteParts.push(`ad ${meta.adId}`);
  if (extras.length) noteParts.push(extras.join(" · "));
  const notes = noteParts.join(" — ") || null;

  return {
    name,
    phone: phone || null,
    email: email || null,
    source: "Instagram",
    campaign: meta?.formId ? `form ${meta.formId}` : null,
    interest,
    goals,
    location,
    notes,
  };
}
