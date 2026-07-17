import { NextResponse } from "next/server";
import { runDaily } from "@/lib/cron/daily";

export const dynamic = "force-dynamic";

// Daily automation endpoint. Vercel Cron calls this on the schedule in
// vercel.json and (when CRON_SECRET is set) sends "Authorization: Bearer
// <CRON_SECRET>". We require that secret so the endpoint can't be triggered by
// anyone. Set CRON_SECRET in your Vercel project env.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed until configured
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runDaily();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Cron failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
