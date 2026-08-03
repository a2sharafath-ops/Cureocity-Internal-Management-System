import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { canWrite } from "@/lib/roles";
import { createWalkInLead } from "@/lib/actions";
import SubmitButton from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

// Dedicated walk-in capture page. Same fields and behaviour as the old inline
// form on the CRM & Leads header — name, phone, location, source "Walk-in" —
// just given its own screen. Submitting creates the lead and returns to /leads.
export default async function WalkInPage() {
  const me = await getProfile();
  if (!me) redirect("/login");
  if (!canWrite(me.role)) redirect("/leads");

  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff", width: "100%", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "var(--muted)", marginBottom: 6, display: "block" };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingTop: 8 }}>
      {/* compact back button */}
      <Link href="/leads" aria-label="Back" title="Back" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, border: "1px solid var(--border)", borderRadius: 8, background: "#fff", color: "var(--ink)", textDecoration: "none", fontSize: 16, marginBottom: 16 }}>←</Link>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 28 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Welcome to Cureocity</h1>
        </div>

        <form action={createWalkInLead} style={{ display: "grid", gap: 16 }}>
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
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            {/* SubmitButton disables itself while the action runs — a plain
                button let an impatient double-click create two identical leads.
                createLead also guards server-side (same phone within 2 min). */}
            <SubmitButton pendingLabel="Adding…" doneLabel="Adding…" style={{ flex: 1, background: "var(--brand-fill)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Add walk-in</SubmitButton>
            <Link href="/leads" style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "11px 20px", fontSize: 14, fontWeight: 600, color: "var(--ink)", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
