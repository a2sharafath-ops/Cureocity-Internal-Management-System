import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Device data ingest endpoint. A wearables integration (Fitbit/Google/Apple
// bridge, a mobile app, or a sync worker) POSTs daily readings here. Gated by
// WEARABLES_INGEST_SECRET so only your integration can push. Inert until the
// secret is set.
//
// Expected JSON body:
//   { "client_id": "<uuid>", "readings": [
//       { "date": "2026-07-17", "steps": 8200, "resting_hr": 61,
//         "sleep_min": 415, "active_min": 44, "calories": 2100 } ] }
export async function POST(req: Request) {
  const secret = process.env.WEARABLES_INGEST_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "ingest-not-configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { client_id?: string; readings?: Array<Record<string, unknown>> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 }); }
  const clientId = body.client_id;
  const readings = Array.isArray(body.readings) ? body.readings : [];
  if (!clientId || readings.length === 0) return NextResponse.json({ ok: false, error: "missing client_id or readings" }, { status: 400 });

  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null; };
  const rows = readings
    .filter((r) => typeof r.date === "string")
    .map((r) => ({
      client_id: clientId, date: String(r.date), source: "device",
      steps: num(r.steps), resting_hr: num(r.resting_hr), sleep_min: num(r.sleep_min),
      active_min: num(r.active_min), calories: num(r.calories),
    }));
  if (rows.length === 0) return NextResponse.json({ ok: false, error: "no valid readings" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("wearable_readings").upsert(rows, { onConflict: "client_id,date,source" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ingested: rows.length });
}
