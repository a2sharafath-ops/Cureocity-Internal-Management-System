import BackLink from "@/components/BackLink";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import BlueprintSection from "@/components/BlueprintSection";

export const dynamic = "force-dynamic";

export default async function BlueprintPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/blueprint")) redirect("/dashboard");
  return (
    <div>
      <BackLink />
      <BlueprintSection me={me} heading />
    </div>
  );
}
