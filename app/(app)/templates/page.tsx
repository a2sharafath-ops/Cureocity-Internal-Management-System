import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { getAppSettings } from "@/lib/settings";
import TemplatesEditor from "@/components/TemplatesEditor";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/templates")) redirect("/dashboard");
  const settings = await getAppSettings();
  const canEdit = me.role === "Administrator" || me.role === "Super Admin";

  return (
    <div>
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Templates &amp; Branding</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        Update the logo, brand colour, font and document templates in one place — changes apply across the app and every PDF.
      </p>
      <TemplatesEditor initial={settings} canEdit={canEdit} />
    </div>
  );
}
