import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import UserRoleSelect from "@/components/UserRoleSelect";
import AddStaffForm from "@/components/AddStaffForm";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  created_at: string;
};

export default async function UsersPage() {
  const me = await getProfile();
  // Admin-only page
  if (!me || (me.role !== "Administrator" && me.role !== "Super Admin")) redirect("/dashboard");

  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, name, role, created_at")
    .order("created_at", { ascending: true });

  const users = (data ?? []) as ProfileRow[];

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Users &amp; Roles</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        Manage staff access · {users.length} user{users.length === 1 ? "" : "s"} · Administrator only
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
                <th style={{ padding: "12px 16px" }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <b>{u.name ?? "—"}</b>
                    {u.id === me.id && (
                      <span style={{ marginLeft: 8, background: "var(--teal-light)", color: "var(--teal-dark)", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>
                        you
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{u.email ?? "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <UserRoleSelect id={u.id} role={u.role} disabled={u.id === me.id} />
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)" }}>
                    No users yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 12 }}>
        Your own role is locked so you can&apos;t accidentally lock yourself out of admin.
      </div>
    </div>
  );
}
