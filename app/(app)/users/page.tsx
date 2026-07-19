import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { ROLE_LIST, accessAreas, accessAreaList, roleCapabilities } from "@/lib/roles";
import UserRoleSelect from "@/components/UserRoleSelect";
import UserBranchSelect from "@/components/UserBranchSelect";
import UserNameEdit from "@/components/UserNameEdit";
import DeleteStaffButton from "@/components/DeleteStaffButton";
import AddStaffForm from "@/components/AddStaffForm";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  branch: string | null;
  created_at: string;
  staff_id: string | null;
};

export default async function UsersPage() {
  const me = await getProfile();
  // Admin-only page
  if (!me || (me.role !== "Administrator" && me.role !== "Super Admin")) redirect("/dashboard");

  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, name, role, branch, created_at, staff_id")
    // Clients are not staff. Filter on both signals: the role, and the link to a
    // client record — a portal login stays off this list even if its role is
    // ever mis-set.
    .neq("role", "Client")
    .is("client_id", null)
    .order("created_at", { ascending: true });

  const users = (data ?? []) as ProfileRow[];

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Users &amp; Roles</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        Team access — roles, permissions and RBAC · {users.length} staff
      </p>

      <AddStaffForm />

      {error ? (
        <div style={{ background: "var(--red-bg)", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 14 }}>
          <b>Couldn&apos;t load users.</b> {error.message}
        </div>
      ) : (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12 }}>
                <th style={{ padding: "12px 16px" }}>User</th>
                <th style={{ padding: "12px 16px" }}>Email</th>
                <th style={{ padding: "12px 16px" }}>Branch</th>
                <th style={{ padding: "12px 16px" }}>Role</th>
                <th style={{ padding: "12px 16px" }}>Access</th>
                <th style={{ padding: "12px 16px" }} />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 16px" }}>
                    <UserNameEdit id={u.id} name={u.name} isYou={u.id === me.id} />
                    {!u.staff_id && (
                      <div
                        title="This login isn't linked to a care-team directory row, so they can't be booked as a provider."
                        style={{ marginTop: 3, fontSize: 11, color: "#b45309" }}
                      >
                        not in care-team directory
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{u.email ?? "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <UserBranchSelect id={u.id} branch={u.branch} />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <UserRoleSelect id={u.id} role={u.role} disabled={u.id === me.id} />
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--muted)", fontSize: 13, whiteSpace: "nowrap" }}>
                    {(() => { const a = accessAreas(u.role); return a === "all" ? "All areas" : `${a} areas`; })()}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    {u.id !== me.id && <DeleteStaffButton id={u.id} name={u.name} />}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)" }}>
                    No users yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 12 }}>
        Your own role is locked so you can&apos;t accidentally lock yourself out of admin. Clients don&apos;t appear here — they&apos;re managed on the Clients page.
      </div>

      {/* Roles & permissions */}
      <h2 style={{ fontSize: 15, margin: "26px 0 10px" }}>Roles &amp; permissions</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {ROLE_LIST.map((r) => {
          const count = users.filter((u) => u.role === r).length;
          const areas = accessAreaList(r);
          const caps = roleCapabilities(r);
          return (
            <div key={r} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <b style={{ fontSize: 14 }}>{r}</b>
                <span style={{ flex: 1 }} />
                <span style={{ background: "#eef2f1", color: "var(--muted)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{count} user{count === 1 ? "" : "s"}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}><b style={{ color: "var(--ink)" }}>Access:</b> {areas === "all" ? "All areas" : areas.join(", ")}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6 }}><b style={{ color: "var(--ink)" }}>Capabilities:</b> {caps.length ? caps.join(", ") : "—"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
