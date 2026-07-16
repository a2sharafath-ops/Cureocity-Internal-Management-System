type Pkg = { id: string; name: string };
type ClientData = {
  id?: string;
  name?: string; phone?: string | null; email?: string | null;
  package_id?: string | null; branch?: string | null; gender?: string | null;
  occupation?: string | null; height?: number | null; weight?: number | null;
  conditions?: string | null; goals?: string[] | null; joined?: string | null;
};

const label: React.CSSProperties = {
  display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4, marginTop: 12,
};
const input: React.CSSProperties = {
  width: "100%", padding: "8px 10px", border: "1px solid var(--border)",
  borderRadius: 8, fontSize: 14, background: "#fff",
};

export default function ClientForm({
  action, packages, client, submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  packages: Pkg[];
  client?: ClientData;
  submitLabel: string;
}) {
  const c = client ?? {};
  return (
    <form
      action={action}
      style={{
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
        boxShadow: "var(--shadow)", padding: "20px 22px", maxWidth: 640,
      }}
    >
      {c.id && <input type="hidden" name="id" value={c.id} />}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label style={label}>Full name *</label>
          <input style={input} name="name" defaultValue={c.name ?? ""} required />
        </div>
        <div>
          <label style={label}>Phone</label>
          <input style={input} name="phone" defaultValue={c.phone ?? ""} />
        </div>
        <div>
          <label style={label}>Email</label>
          <input style={input} name="email" defaultValue={c.email ?? ""} />
        </div>
        <div>
          <label style={label}>Joined date</label>
          <input style={input} type="date" name="joined" defaultValue={c.joined ?? "2026-07-02"} />
        </div>
        <div>
          <label style={label}>Package</label>
          <select style={input} name="package_id" defaultValue={c.package_id ?? ""}>
            <option value="">— none —</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={label}>Branch</label>
          <select style={input} name="branch" defaultValue={c.branch ?? "Kochi"}>
            <option>Kochi</option>
            <option>Kozhikode</option>
          </select>
        </div>
        <div>
          <label style={label}>Gender</label>
          <select style={input} name="gender" defaultValue={c.gender ?? ""}>
            <option value="">—</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label style={label}>Occupation</label>
          <input style={input} name="occupation" defaultValue={c.occupation ?? ""} />
        </div>
        <div>
          <label style={label}>Height (cm)</label>
          <input style={input} type="number" name="height" defaultValue={c.height ?? ""} />
        </div>
        <div>
          <label style={label}>Weight (kg)</label>
          <input style={input} type="number" step="0.1" name="weight" defaultValue={c.weight ?? ""} />
        </div>
      </div>

      <label style={label}>Medical conditions</label>
      <input style={input} name="conditions" defaultValue={c.conditions ?? ""} placeholder="e.g. None, or Prediabetes" />

      <label style={label}>Goals (comma-separated)</label>
      <input style={input} name="goals" defaultValue={(c.goals ?? []).join(", ")} placeholder="Fat loss, Strength & flexibility" />

      <div style={{ marginTop: 12, fontSize: 11, color: "var(--muted)" }}>
        PT &amp; Comprehensive packages auto-schedule 12 strength sessions per 4 weeks on alternate days from the joined date.
      </div>

      <div style={{ marginTop: 18 }}>
        <button
          type="submit"
          style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
