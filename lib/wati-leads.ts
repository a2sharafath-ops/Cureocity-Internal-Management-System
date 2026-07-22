// Wati (WhatsApp) lead capture — webhook payload → IngestInput.
//
// Wati is the WhatsApp/Instagram conversation layer; we only want the lead.
// The cleanest "a new person reached out" signal Wati emits is the
// **New Contact Message** webhook (eventType "newContactMessageReceived"),
// which fires once, the first time an unknown contact messages the business —
// including people who arrive via Click-to-WhatsApp ads. It carries their
// WhatsApp number and display name, which is all a workable lead needs.
//
// Kept as a pure mapper (no I/O) so it can be unit-tested without a live
// webhook, mirroring lib/meta-leads.ts. The route does auth + ingest.

import type { IngestInput } from "@/lib/ingest-lead";

/** The subset of Wati's webhook body we rely on. */
export type WatiWebhook = {
  eventType?: string;
  waId?: string;         // full international number, e.g. "919876543210"
  senderName?: string;
  sourceId?: string | null;
  sourceUrl?: string | null;   // set for ad-referred (Click-to-WhatsApp) contacts
  sourceType?: number | null;
};

/** Only a brand-new contact's first message is treated as a fresh lead. */
export const NEW_CONTACT_EVENT = "newContactMessageReceived";

export function isNewContactEvent(body: WatiWebhook): boolean {
  return body?.eventType === NEW_CONTACT_EVENT;
}

/**
 * Map a Wati New-Contact webhook to our IngestInput.
 *
 * A contact with no name still becomes a workable lead — the phone number is
 * what matters — so we fall back to a placeholder rather than dropping it. If
 * the contact came from an ad, Wati includes a sourceUrl; we keep it in notes
 * so the sales rep can see which ad produced the enquiry.
 */
export function mapWatiContact(body: WatiWebhook): IngestInput {
  const name = String(body.senderName ?? "").trim() || "WhatsApp lead";
  const phone = String(body.waId ?? "").trim() || null;

  const noteParts: string[] = [];
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
