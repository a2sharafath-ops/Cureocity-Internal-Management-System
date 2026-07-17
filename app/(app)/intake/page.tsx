import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { submitTabletIntake } from "@/lib/actions";

export const dynamic = "force-dynamic";

const GOALS = ["Fat loss", "Muscle gain", "Manage health condition", "Strength & flexibility", "General fitness", "Rehab / recovery"];

const input: React.CSSProperties = { padding: "11px 13px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 15, background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 13, color: "var(--muted)", margin: "12px 0 5px", display: "block", fontWeight: 500 };
const row2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };

export default async function IntakePage({ searchParams }: { searchParams: { done?: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/intake")) redirect("/dashboard");
  const done = searchParams.done === "1";

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {/* kiosk header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--teal)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>✚</div>
        <b style={{ fontSize: 17 }}>Cureocity</b>
        <span style={{ background: "var(--teal-light)", color: "var(--teal-dark)", borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 600 }}>New Client Registration</span>
        <span style={{ flex: 1 }} />
        <Link href="/clients" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 13, textDecoration: "none", color: "var(--muted)" }}>✕ Front desk view</Link>
      </div>

      {done ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>📨</div>
          <h2 style={{ fontSize: 20, margin: "0 0 6px" }}>Intake submitted</h2>
          <p style={{ color: "var(--muted)", fontSize: 15, margin: "0 0 20px" }}>Your details have synced to the front desk. Registration is completed there with OTP verification.</p>
          <Link href="/intake" style={{ background: "var(--teal)", color: "#fff", borderRadius: 10, padding: "12px 22px", fontSize: 15, fontWeight: 700, textDecoration: "none" }}>+ New registration</Link>
        </div>
      ) : (
        <form action={submitTabletIntake} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "22px 24px" }}>
          <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>Welcome to Cureocity 👋</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 6px" }}>Please fill in your details below. Our front desk will complete your registration.</p>

          <div style={row2}>
            <div><label style={lbl}>First name *</label><input style={input} name="first_name" required autoFocus /></div>
            <div><label style={lbl}>Last name</label><input style={input} name="last_name" /></div>
          </div>
          <div style={row2}>
            <div><label style={lbl}>Phone number *</label><input style={input} name="phone" inputMode="tel" required /></div>
            <div><label style={lbl}>Email</label><input style={input} name="email" type="email" /></div>
          </div>
          <div style={row2}>
            <div><label style={lbl}>Date of birth</label><input style={input} name="dob" placeholder="DD/MM/YYYY" /></div>
            <div><label style={lbl}>Gender</label><select style={input} name="gender" defaultValue="Female"><option>Female</option><option>Male</option><option>Other</option></select></div>
          </div>
          <div style={row2}>
            <div><label style={lbl}>Occupation</label><input style={input} name="occupation" /></div>
            <div><label style={lbl}>Emergency contact number</label><input style={input} name="emergency" inputMode="tel" /></div>
          </div>
          <div style={row2}>
            <div><label style={lbl}>Height (cm)</label><input style={input} name="height" type="number" /></div>
            <div><label style={lbl}>Weight (kg)</label><input style={input} name="weight" type="number" step="0.1" /></div>
          </div>

          <label style={lbl}>Any medical conditions?</label>
          <input style={input} name="conditions" placeholder="e.g. Diabetes, PCOS/PCOD — or None" />

          <label style={lbl}>Your goals</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            {GOALS.map((g) => (
              <label key={g} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px", fontSize: 14, cursor: "pointer", background: "#fff" }}>
                <input type="checkbox" name="goals" value={g} /> {g}
              </label>
            ))}
          </div>

          <label style={lbl}>Street address</label>
          <input style={input} name="street" />
          <div style={row2}>
            <div><label style={lbl}>City</label><input style={input} name="city" defaultValue="Kochi" /></div>
            <div><label style={lbl}>State</label><input style={input} name="state" defaultValue="Kerala" /></div>
          </div>
          <div style={row2}>
            <div><label style={lbl}>Postal code</label><input style={input} name="postal" /></div>
            <div><label style={lbl}>Referral ID / Code <span style={{ fontWeight: 400 }}>(optional)</span></label><input style={input} name="ref_id" placeholder="Only if you have one" /></div>
          </div>

          <label style={lbl}>Terms &amp; Conditions</label>
          <details style={{ background: "#fafafa", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "var(--muted)" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--ink)" }}>Tap to read the Terms &amp; Conditions</summary>
            <p style={{ marginBottom: 0 }}>I understand that Cureocity provides fitness and wellness services, that results vary between individuals, and that I am responsible for disclosing accurate health information. Membership fees, cancellation and refund policies apply as per the current price list.</p>
          </details>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, border: "1px solid var(--border)", borderRadius: 10, padding: "8px 14px", fontSize: 14, cursor: "pointer" }}><input type="radio" name="tnc" value="Agree" required /> Agree</label>
            <label style={{ display: "flex", alignItems: "center", gap: 7, border: "1px solid var(--border)", borderRadius: 10, padding: "8px 14px", fontSize: 14, cursor: "pointer" }}><input type="radio" name="tnc" value="Disagree" /> Disagree</label>
          </div>

          <label style={lbl}>Informed Consent (medical)</label>
          <details style={{ background: "#fafafa", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "var(--muted)" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--ink)" }}>Tap to read the informed consent statement</summary>
            <p style={{ marginBottom: 0 }}>I consent to a health/fitness assessment and to the collection of my health information for the purpose of designing my program. I confirm I have disclosed any conditions that may affect my ability to exercise safely, and I will consult a physician where appropriate.</p>
          </details>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, border: "1px solid var(--border)", borderRadius: 10, padding: "8px 14px", fontSize: 14, cursor: "pointer" }}><input type="radio" name="consent" value="Agree" required /> Agree</label>
            <label style={{ display: "flex", alignItems: "center", gap: 7, border: "1px solid var(--border)", borderRadius: 10, padding: "8px 14px", fontSize: 14, cursor: "pointer" }}><input type="radio" name="consent" value="Disagree" /> Disagree</label>
          </div>

          <button type="submit" style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 12, padding: "13px 0", fontSize: 16, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 22 }}>Submit</button>
          <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--muted)", margin: "12px 0 0" }}>Your details sync securely to the front desk — registration is completed there with OTP verification.</p>
        </form>
      )}
    </div>
  );
}
