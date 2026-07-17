import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { createLeadIntake } from "@/lib/actions";

export const dynamic = "force-dynamic";

const input: React.CSSProperties = { padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 12, fontSize: 16, background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 13, color: "var(--muted)", marginBottom: 4, display: "block" };

export default async function IntakePage({ searchParams }: { searchParams: { done?: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/intake")) redirect("/dashboard");
  const done = searchParams.done === "1";

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{ width: 54, height: 54, borderRadius: 14, background: "var(--teal)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 26, margin: "0 auto 10px" }}>✚</div>
        <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Welcome to Cureocity</h1>
        <p style={{ color: "var(--muted)", fontSize: 15, margin: 0 }}>Tell us a little about you — our team will take it from here.</p>
      </div>

      {done ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "36px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🎉</div>
          <h2 style={{ fontSize: 20, margin: "0 0 6px" }}>Thank you!</h2>
          <p style={{ color: "var(--muted)", fontSize: 15, margin: "0 0 20px" }}>Your details are in. A team member will be with you shortly.</p>
          <Link href="/intake" style={{ background: "var(--teal)", color: "#fff", borderRadius: 12, padding: "12px 22px", fontSize: 15, fontWeight: 700, textDecoration: "none" }}>+ New intake</Link>
        </div>
      ) : (
        <form action={createLeadIntake} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "24px", display: "grid", gap: 16 }}>
          <div><label style={lbl}>Your name *</label><input style={input} name="name" required autoFocus placeholder="Full name" /></div>
          <div><label style={lbl}>Phone</label><input style={input} name="phone" inputMode="tel" placeholder="Mobile number" /></div>
          <div><label style={lbl}>What are you interested in?</label>
            <select style={input} name="interest" defaultValue="">
              <option value="">Select…</option>
              <option>Personal Training</option><option>Diet/Nutrition</option><option>Full Package (Medical+Diet+PT)</option>
              <option>Gym/Fitness</option><option>Assessment/Testing</option><option>Just Exploring</option>
            </select>
          </div>
          <div><label style={lbl}>Your main goal</label>
            <select style={input} name="goals" defaultValue="">
              <option value="">Select…</option>
              <option>Specific weight loss target</option><option>Manage health condition (diabetes/BP etc)</option>
              <option>Build muscle/body composition</option><option>Rehab/pain management</option>
              <option>General fitness/energy</option><option>No specific goal</option>
            </select>
          </div>
          <div><label style={lbl}>How soon do you want to start?</label>
            <select style={input} name="urgency" defaultValue="">
              <option value="">Select…</option>
              <option>Strong - wants to start now</option><option>Medical advice to exercise</option>
              <option>Event/deadline (wedding etc.)</option><option>Just exploring options</option><option>No clear urgency</option>
            </select>
          </div>
          <input type="hidden" name="source" value="Walk-in (tablet)" />
          <button type="submit" style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>Submit</button>
          <div style={{ textAlign: "center" }}><Link href="/leads" style={{ color: "var(--muted)", fontSize: 12, textDecoration: "none" }}>Exit kiosk →</Link></div>
        </form>
      )}
    </div>
  );
}
