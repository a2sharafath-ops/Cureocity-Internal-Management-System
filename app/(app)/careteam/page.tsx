import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import CareTeamSection from "@/components/CareTeamSection";

export const dynamic = "force-dynamic";

export default async function CareTeamPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/careteam")) redirect("/dashboard");
  return <CareTeamSection me={me} heading />;
}
