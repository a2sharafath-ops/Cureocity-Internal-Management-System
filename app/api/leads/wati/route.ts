import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestLead, pickOwner, validate } from "@/lib/ingest-lead";
import { isNewContactEvent, mapWatiContact, type WatiWebhook } from "@/lib/wati-leads";

export const dynamic = "force-dynamic";

// Wati (WhatsApp) lead capture webhook.
//
//   Wati → Connectors → Webhooks → Add Webhook
//   URL:     https://<domain>/api/leads/wati
//   Event:   "New Contact Message"
//   Header:  Authorization = Bearer <WATI_WEBHOOK_SECRET>
//
// When a brand-new contact messages your WhatsApp for the first time (including
// via Click-to-WhatsApp ads), Wati POSTs here and the lead lands in CRM & Leads
// — deduped, scored, owner-assigned, with a call task waiting. Same pipeline as
// the website and Meta endpoints, different front door.
//
// Fails closed: without WATI_WEBHOOK_SECRET set, every request is rejected. An
// unsecured public insert endpoint is a spam faucet into the CRM.

/** Constant-time compare so the secret can't be recovered by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorised(req: Request): boolean {
  const secret = process.env.WATI_WEBHOOK_SECRET;
  if (!secret) return false;
  // Accept "Bearer <secret>" (what you set in Wati's header) or the bare secret.
  const header = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return safeEqual(header, secret);
}

export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: WatiWebhook;
  try {
    body = (await req.json()) as WatiWebhook;
  } catch {
    return NextResponse.json({ ok: false, error: "body must be JSON" }, { status: 400 });
  }

  // Wati fires several event types on one webhook; we only create a lead for a
  // genuinely new contact. Everything else is acknowledged and ignored — a
  // non-200 makes Wati retry and eventually disable the webhook.
  if (!isNewContactEvent(body)) {
    return NextResponse.json({ ok: true, status: "ignored", event: body?.eventType ?? null }, { status: 200 });
  }

  const checked = validate(mapWatiContact(body));
  if (!checked.ok) {
    // Still 200: a malformed contact isn't Wati's fault to retry.
    return NextResponse.json({ ok: true, status: "skipped", reason: checked.reason }, { status: 200 });
  }

  // Service-role: a webhook has no signed-in user and RLS on `leads` is written
  // for staff sessions.
  const supabase = createAdminClient();

  // WATI_LEAD_OWNER: one staff id, or several comma-separated to share leads out
  // by least-loaded rotation (same as WEBSITE_LEAD_OWNER). If unset the lead is
  // still captured but surfaces in the "unowned" alerts.
  const configured = (process.env.WATI_LEAD_OWNER ?? "").split(",");
  const ownerId = await pickOwner(supabase, configured);

  const result = await ingestLead(supabase, checked.value, { ownerId });

  // Always 200 to Wati once authorised, even on duplicate/rejected — retries
  // would only produce the same outcome and risk the webhook being disabled.
  return NextResponse.json({ ok: true, status: result.status }, { status: 200 });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "POST Wati webhook events here with an Authorization: Bearer <secret> header." },
    { status: 405 },
  );
}
