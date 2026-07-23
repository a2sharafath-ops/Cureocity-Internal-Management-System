import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestLead, pickOwner, validate } from "@/lib/ingest-lead";
import { isLeadEvent, mapWatiContact, type WatiWebhook } from "@/lib/wati-leads";

export const dynamic = "force-dynamic";

// Wati (WhatsApp) lead capture webhook.
//
//   Wati → Connectors → Webhooks → Add Webhook
//   URL:     https://<domain>/api/leads/wati?token=<WATI_WEBHOOK_SECRET>
//   Event:   "New Contact Message" (or "Message Received" — both handled)
//
// Wati's simple webhook UI has no custom-header field, so the secret travels as
// a `token` query param instead of an Authorization header (the header is still
// accepted if a plan offers it). Keep the URL private — it is the credential.
//
// When someone messages your WhatsApp (including via Click-to-WhatsApp ads),
// Wati POSTs here and the lead lands in CRM & Leads — deduped, scored,
// owner-assigned, with a call task. Same pipeline as the website/Meta endpoints.
//
// Fails closed: without WATI_WEBHOOK_SECRET set, every request is rejected.

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
  // Primary: ?token=<secret> in the URL (Wati has no header field).
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (token && safeEqual(token, secret)) return true;
  // Fallback: Authorization: Bearer <secret>, if the plan supports headers.
  const header = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return Boolean(header) && safeEqual(header, secret);
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

  // Wati fires several event types; we only act on a new inbound enquiry.
  // Everything else (delivery/read receipts, outbound messages) is acknowledged
  // and ignored — a non-200 makes Wati retry and eventually disable the webhook.
  if (!isLeadEvent(body)) {
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
  // Surface the reason on rejection so a failed insert is visible in Wati's
  // webhook log (rather than a silent 200 that looks fine).
  const reason = result.status === "rejected" || result.status === "duplicate" ? result.reason : undefined;
  return NextResponse.json({ ok: true, status: result.status, owner: ownerId, reason }, { status: 200 });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "POST Wati webhook events here with ?token=<secret> in the URL." },
    { status: 405 },
  );
}
