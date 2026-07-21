import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestLead, pickOwner, validate } from "@/lib/ingest-lead";

export const dynamic = "force-dynamic";

// Public lead capture for the website enquiry form.
//
//   POST https://<your-domain>/api/leads/website
//   Content-Type: application/json
//   X-Cureocity-Key: <WEBSITE_LEAD_SECRET>
//
//   { "name": "Rozario Peter", "phone": "8590059059",
//     "email": "r@example.com", "interest": "Personal Training",
//     "goals": "Lose weight", "location": "Kochi", "notes": "..." }
//
// Fails closed: without WEBSITE_LEAD_SECRET set, every request is rejected.
// That is deliberate — an unsecured public insert endpoint is a spam faucet
// into the CRM, and a silently-open one is worse than a closed one.

/** Constant-time compare, so the secret can't be recovered by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorised(req: Request): boolean {
  const secret = process.env.WEBSITE_LEAD_SECRET;
  if (!secret) return false;
  const key = req.headers.get("x-cureocity-key") ?? "";
  return safeEqual(key, secret);
}

export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "body must be JSON" }, { status: 400 });
  }

  // A bot filling every field of a form is common; a bot filling a field the
  // real form hides is the giveaway. If the site includes a hidden "company"
  // input and it arrives populated, drop it — silently, with 200, so the bot
  // gets no signal that it was detected.
  if (String(body.company ?? "").trim()) {
    return NextResponse.json({ ok: true, status: "received" }, { status: 200 });
  }

  const checked = validate({ ...body, source: String(body.source ?? "Website") });
  if (!checked.ok) {
    return NextResponse.json({ ok: false, error: checked.reason }, { status: 400 });
  }

  // Service-role: there is no signed-in user on a public form, and RLS on
  // `leads` is written for staff sessions.
  const supabase = createAdminClient();

  // Every website lead needs an owner or it is invisible to the daily digests
  // and the callback sweep. WEBSITE_LEAD_OWNER takes one staff id, or several
  // comma-separated to share them out:
  //
  //   WEBSITE_LEAD_OWNER=s1                  -> always Sini
  //   WEBSITE_LEAD_OWNER=s1,thamanna-nazer   -> whoever currently has fewer
  //
  // If unset the lead is still captured — losing an enquiry is worse than an
  // unowned one — but it surfaces in the "unowned" alerts rather than vanishing.
  const configured = (process.env.WEBSITE_LEAD_OWNER ?? "").split(",");
  const ownerId = await pickOwner(supabase, configured);

  const result = await ingestLead(supabase, checked.value, { ownerId });

  if (result.status === "rejected") {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 500 });
  }

  // A duplicate is a success from the website's point of view — the visitor
  // submitted successfully and should see a thank-you, not an error. The
  // distinction matters to us, not to them.
  return NextResponse.json(
    result.status === "duplicate"
      ? { ok: true, status: "duplicate" }
      : { ok: true, status: "created", ref: result.num },
    { status: 200 },
  );
}

// A GET is almost always someone pasting the URL into a browser to see if it
// works. Tell them plainly rather than returning a confusing 405.
export async function GET() {
  return NextResponse.json(
    { ok: false, error: "POST JSON to this endpoint with an X-Cureocity-Key header." },
    { status: 405 },
  );
}
