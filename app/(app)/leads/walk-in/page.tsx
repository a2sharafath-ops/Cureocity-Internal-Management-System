import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { canWrite } from "@/lib/roles";
import { createWalkInLead } from "@/lib/actions";
import BackLink from "@/components/BackLink";

export const dynamic = "force-dynamic";

// Dedicated walk-in capture page. Same fields and behaviour as the old inline
// form on the CRM & Leads header — name, phone, location, source "Walk-in" —
// just given its own screen. Submitting creates the lead and returns to /leads.
export default async function WalkInPage() {
  const me = await getProfile();
  if (!me) redirect("/login");
  if (!canWrite(me.role)) redirect("/leads");

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff", width: "100%", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "var(--muted)", marginBottom: 4, display: "block" };

  return (
    <div style={{ maxWidth: 560 }}>
      <BackLink />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Add walk-in</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>Quick front-desk capture. Creates a lead (source Walk-in) with an owner, a first-response task and a score, just like any other lead.</p>

      <form action={createWalkInLead} style={{ ...box, padding: 20, display: "grid", gap: 14 }}>
        <input type="hidden" name="source" value="Walk-in" />
        <div>
          <label style={lbl}>Name</label>
          <input name="name" placeholder="Full name" required autoFocus style={inp} />
        </div>
        <div>
          <label style={lbl}>Phone</label>
          <input name="phone" placeholder="Phone number" inputMode="tel" style={inp} />
        </div>
        <div>
          <label style={lbl}>Location</label>
          <input name="location" placeholder="Area / locality" style={inp} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button type="submit" style={{ background: "var(--brand-fill)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Add walk-in</button>
          <Link href="/leads" style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, color: "var(--ink)", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}
