import { getProfile } from "@/lib/auth";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const me = await getProfile();

  return (
    <div style={{ maxWidth: 620 }}>
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>My Account</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        {me?.name} · {me?.email} · {me?.role}
      </p>

      <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>Change password</h2>
      <ChangePasswordForm />
    </div>
  );
}
