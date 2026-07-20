import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canManagePackages } from "@/lib/roles";
import { BRANCHES } from "@/lib/branches";
import PackageCatalog, { type CatPkg, type CatSvc } from "@/components/PackageCatalog";

export const dynamic = "force-dynamic";

type PkgRow = {
  id: string; name: string; sessions: number; validity: number; price: number; is_facility: boolean; active: boolean;
  one_time: boolean; requires_slot: boolean; delivery_mode: string; tags: string[] | null; mrp: number | null;
};

const LINE_LABEL: Record<string, string> = { fm: "Facility Membership", pt: "Personal Training (PT)", comp: "Comprehensive", bp: "BluePrint" };
function lineOf(id: string) {
  if (id.startsWith("fm")) return "fm";
  if (id.startsWith("pt")) return "pt";
  if (id.startsWith("comp")) return "comp";
  if (id.startsWith("bp")) return "bp";
  return id; // custom packages are their own line
}

export default async function PackagesPage() {
  const me = await getProfile();
  const canManage = canManagePackages(me?.role ?? "");

  const supabase = createClient();
  const [pkgR, priceR, psR, clientR] = await Promise.all([
    supabase.from("packages").select("id, name, sessions, validity, price, is_facility, active, one_time, requires_slot, delivery_mode, tags, mrp").order("price"),
    supabase.from("package_prices").select("package_id, branch, price"),
    supabase.from("package_services").select("package_id, services(name, category, slot_based)"),
    supabase.from("clients").select("package_id"),
  ]);

  const rows = (pkgR.data ?? []) as PkgRow[];
  const priceMap = new Map<string, Record<string, number>>();
  for (const r of (priceR.data ?? []) as { package_id: string; branch: string; price: number }[]) {
    const m = priceMap.get(r.package_id) ?? {}; m[r.branch] = Number(r.price); priceMap.set(r.package_id, m);
  }
  const svcMap = new Map<string, CatSvc[]>();
  for (const r of (psR.data ?? []) as unknown as { package_id: string; services: { name: string; category: string; slot_based: boolean } | null }[]) {
    if (!r.services) continue;
    const arr = svcMap.get(r.package_id) ?? []; arr.push({ name: r.services.name, category: r.services.category, slot: r.services.slot_based }); svcMap.set(r.package_id, arr);
  }
  const countMap = new Map<string, number>();
  for (const c of (clientR.data ?? []) as { package_id: string | null }[]) { if (c.package_id) countMap.set(c.package_id, (countMap.get(c.package_id) ?? 0) + 1); }

  const CAT_ORDER = ["Doctor Consultation", "Fitness Services", "Diet Consultation"];
  const packages: CatPkg[] = rows.map((p) => {
    const line = lineOf(p.id);
    const prices = priceMap.get(p.id) ?? {}; for (const b of BRANCHES) if (prices[b] == null) prices[b] = Number(p.price);
    const services = (svcMap.get(p.id) ?? []).sort((a, b) => CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category));
    return {
      id: p.id, name: p.name, line, lineLabel: LINE_LABEL[line] ?? p.name,
      weeks: p.id === "bp1" || p.one_time ? null : Math.round(p.validity / 7),
      sessions: p.sessions, validity: p.validity, is_facility: p.is_facility, active: p.active,
      one_time: p.one_time, requires_slot: p.requires_slot, delivery_mode: p.delivery_mode, tags: p.tags ?? [],
      prices, mrp: p.mrp, clientCount: countMap.get(p.id) ?? 0, services,
    };
  });

  return (
    <div style={{ maxWidth: 1200 }}>
      <h1 style={{ fontSize: 20, margin: "0 0 2px" }}>Packages</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>Bundled service packages with branch pricing</p>

      {pkgR.error ? (
        <div style={{ background: "var(--red-bg)", color: "var(--red-text)", border: "1px solid #fecaca", borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 14 }}>
          <b>Couldn&apos;t load packages.</b> {pkgR.error.message}
        </div>
      ) : (
        <PackageCatalog packages={packages} branches={[...BRANCHES]} canManage={canManage} />
      )}
    </div>
  );
}
