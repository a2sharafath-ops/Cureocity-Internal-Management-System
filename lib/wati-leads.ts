// Wati (WhatsApp) lead capture — webhook payload → IngestInput.
//
// Wati is the WhatsApp/Instagram conversation layer; we only want the lead.
// Two Wati events can signal a new enquiry, and which one a given account can
// subscribe to depends on its plan, so we handle both:
//
//   newContactMessageReceived — fires once, the first time an unknown contact
//                               messages. Ideal, but not on every plan.
//   message                   — fires on EVERY inbound message. We accept it
//                               too (inbound only, owner === false) and rely on
//                               ingestLead's phone dedupe so only the first
//                               message from a new number becomes a lead; the
//                               rest are no-ops.
//
// Either way we get the WhatsApp number + display name, which is all a workable
// lead needs. Kept as a pure mapper (no I/O) so it can be unit-tested.

import type { IngestInput } from "@/lib/ingest-lead";

/** The subset of Wati's webhook body we rely on (both event shapes). */
export type WatiWebhook = {
  eventType?: string;
  waId?: string;              // full international number, e.g. "919876543210"
  senderName?: string;
  text?: string | null;      // present on "message" events — the enquiry itself
  owner?: boolean;           // "message" events: true = business sent it, skip
  sourceId?: string | null;
  sourceUrl?: string | null; // set for ad-referred (Click-to-WhatsApp) contacts
  sourceType?: number | null;
};

export const NEW_CONTACT_EVENT = "newContactMessageReceived";
export const MESSAGE_EVENT = "message";

/**
 * Should this webhook create/attempt a lead?
 *
 * - New-contact events always qualify.
 * - Plain message events qualify only if inbound (owner !== true); a message the
 *   business itself sent must never become a lead.
 */
export function isLeadEvent(body: WatiWebhook): boolean {
  if (body?.eventType === NEW_CONTACT_EVENT) return true;
  if (body?.eventType === MESSAGE_EVENT && body?.owner !== true) return true;
  return false;
}

/**
 * Map a Wati webhook to our IngestInput.
 *
 * A contact with no name still becomes a workable lead — the phone is what
 * matters — so we fall back to a placeholder. Ad-referred contacts carry a
 * sourceUrl, kept in notes along with the first message text so the sales rep
 * sees what the person actually asked.
 */
export function mapWatiContact(body: WatiWebhook): IngestInput {
  const name = String(body.senderName ?? "").trim() || "WhatsApp lead";
  const phone = String(body.waId ?? "").trim() || null;

  const noteParts: string[] = [];
  const msg = String(body.text ?? "").trim();
  if (msg) noteParts.push(`First message: "${msg.slice(0, 300)}"`);
  if (body.sourceUrl) noteParts.push(`Ad/source: ${body.sourceUrl}`);
  if (body.sourceId) noteParts.push(`sourceId ${body.sourceId}`);
  const notes = noteParts.join(" · ") || null;

  return {
    name,
    phone,
    email: null,
    // Click-to-WhatsApp ads carry a sourceUrl; treat those as ad-driven while
    // organic WhatsApp enquiries are just "WhatsApp".
    source: body.sourceUrl ? "WhatsApp Ad" : "WhatsApp",
    campaign: null,
    interest: null,
    goals: null,
    location: null,
    notes,
  };
}
