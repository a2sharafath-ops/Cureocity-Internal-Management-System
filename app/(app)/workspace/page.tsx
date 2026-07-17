import { redirect } from "next/navigation";
import { getProfile, getViewRole } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { getPersona } from "@/lib/personas";

export const dynamic = "force-dynamic";

// "My Workspace" — lands each professional on their discipline's workspace tab.
// Uses the active "View as…" persona when one is set; otherwise defaults to
// Consultations. The tab bar (WorkspaceTabs) lets them switch between all four.
export default async function WorkspacePage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/workspace")) redirect("/dashboard");

  const { profession } = await getViewRole();
  const persona = getPersona(profession);
  const route = persona?.kind === "Trainer" ? "/trainer"
    : persona?.kind === "Diet" ? "/meals"
    : "/pro"; // Doctor / Coach / Psychologist / default
  redirect(route);
}
