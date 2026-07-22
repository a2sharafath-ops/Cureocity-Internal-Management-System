import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestLead, pickOwner, validate } from "@/lib/ingest-lead";
import { verifySignature, parseLeadgenIds, mapFieldData, type FieldEntry } from "@/lib/meta-leads";

export const dynamic = "force-dynamic";

// Meta (Instagram/Facebook) Lead Ads webhook.
//
//   Webhook URL (set in the Meta app):  https://<domain>/api/leads/meta
//   Verify token:                       META_VERIFY_TOKEN
//   Signed with:                        META_APP_SECRET (X-Hub-Signature-256)
//   Lead data fetched with:             META_PAGE_ACCESS_TOKEN
//
// Two verbs:
//   GET  — the one-time subscription handshake. Meta calls with hub.challenge
//          and expects it echoed back if the verify token matches.
//   POST — a lead came in. The body carries only ids, so we call the Graph API
//          to fetch the answers, then hand them to the shared ingestLead().
//
// Inert until the three META_* vars are set: GET fails the handshake, POST
// rejects on signature. Losing a lead is bad, but an unsigned public endpoint
// that writes to the CRM is worse, so this fails closed.

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

// ---- GET: subscription handshake ------------------------------------------
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.META_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected) {
    // Meta wants the raw challenge string echoed, not JSON.
    return new Response(challenge ?? "", { status: 200, headers: { "content-type": "text/plain" } });
  }
  return NextResponse.json({ ok: false, error: "verification failed" }, { status: 403 });
}

// ---- POST: a lead arrived --------------------------------------------------
export async function POST(req: Request) {
  const appSecret = process.env.META_APP_SECRET ?? "";
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN ?? "";

  const raw = await req.text();

  // Verify BEFORE parsing — an unsigned body is not to be trusted at all.
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), appSecret)) {
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
  }

  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const refs = parseLeadgenIds(body as Parameters<typeof parseLeadgenIds>[0]);
  // Always 200 to Meta once the signature is valid, even with nothing to do —
  // a non-200 makes Meta retry and eventually disable the subscription.
  if (!refs.length) return NextResponse.json({ ok: true, processed: 0 });

  if (!pageToken) {
    // Signature was valid but we can't fetch without a token. Acknowledge so
    // Meta doesn't disable the webhook; the lead is lost, which the setup doc
    // warns about.
    return NextResponse.json({ ok: true, processed: 0, warning: "no page token" });
  }

  const supabase = createAdminClient();
  const owners = (process.env.META_LEAD_OWNER ?? "").split(",");

  let created = 0, duplicate = 0, failed = 0;
  for (const ref of refs) {
    // Fetch the actual answers from the Graph API.
    let fieldData: FieldEntry[] = [];
    try {
      const url = `https://graph.facebook.com/${GRAPH_VERSION}/${ref.leadgenId}`
        + `?fields=field_data,ad_id,form_id,created_time&access_token=${encodeURIComponent(pageToken)}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) { failed++; continue; }
      const json = (await res.json()) as { field_data?: FieldEntry[] };
      fieldData = json.field_data ?? [];
    } catch { failed++; continue; }

    const mapped = mapFieldData(fieldData, { adId: ref.adId, formId: ref.formId });
    const checked = validate(mapped);
    if (!checked.ok) { failed++; continue; }   // e.g. no phone AND no email

    const ownerId = await pickOwner(supabase, owners);
    const result = await ingestLead(supabase, checked.value, { ownerId });
    if (result.status === "created") created++;
    else if (result.status === "duplicate") duplicate++;
    else failed++;
  }

  return NextResponse.json({ ok: true, processed: refs.length, created, duplicate, failed });
}
