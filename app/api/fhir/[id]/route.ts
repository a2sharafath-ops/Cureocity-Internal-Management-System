import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canEmr } from "@/lib/roles";
import { buildFhirBundle } from "@/lib/fhir";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const me = await getProfile();
  if (!me || !canEmr(me.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const cid = params.id;
  const supabase = createClient();
  const { data: client } = await supabase.from("clients").select("id, name, gender, dob, phone, email").eq("id", cid).maybeSingle();
  if (!client) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  const [problemsR, allergiesR, medsR, vitalsR] = await Promise.all([
    supabase.from("problems").select("id, description, code, status, onset_date").eq("client_id", cid),
    supabase.from("allergies").select("id, substance, reaction, severity").eq("client_id", cid),
    supabase.from("medications").select("id, name, dose, frequency, status").eq("client_id", cid),
    supabase.from("vitals").select("id, date, systolic, diastolic, pulse, temp_c, spo2, weight").eq("client_id", cid).order("date", { ascending: false }).limit(30),
  ]);

  const bundle = buildFhirBundle(
    client as { id: string; name: string; gender: string | null; dob: string | null; phone: string | null; email: string | null },
    (problemsR.data ?? []) as never,
    (allergiesR.data ?? []) as never,
    (medsR.data ?? []) as never,
    (vitalsR.data ?? []) as never,
  );

  const safeName = (client.name ?? "patient").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/fhir+json",
      "Content-Disposition": `attachment; filename="fhir-${safeName}-${cid.slice(0, 8)}.json"`,
    },
  });
}
