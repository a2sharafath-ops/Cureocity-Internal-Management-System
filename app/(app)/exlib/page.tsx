import BackLink from "@/components/BackLink";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import ExerciseLibrarySection from "@/components/ExerciseLibrarySection";

export const dynamic = "force-dynamic";

export default async function ExlibPage(props: { searchParams: Promise<{ client?: string }> }) {
  const searchParams = await props.searchParams;
  const me = await getProfile();
  if (!me || !canSee(me.role, "/exlib")) redirect("/dashboard");
  return (
    <div>
      <BackLink />
      <ExerciseLibrarySection heading focusClientId={searchParams.client} />
    </div>
  );
}
