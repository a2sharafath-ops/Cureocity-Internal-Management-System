import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { canSee, isClinician } from "@/lib/roles";
import BackLink from "@/components/BackLink";
import WhiteboardSection from "@/components/WhiteboardSection";

export const dynamic = "force-dynamic";

export default async function WhiteboardPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/whiteboard")) redirect("/dashboard");
  return (
    <div>
      {isClinician(me.role) ? <BackLink href="/workspace" label="my Workspace" /> : <BackLink />}
      <WhiteboardSection me={me} heading />
    </div>
  );
}
