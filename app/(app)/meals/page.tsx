import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import MealMonitoringSection from "@/components/MealMonitoringSection";

export const dynamic = "force-dynamic";

export default async function MealsPage(props: { searchParams: Promise<{ d?: string }> }) {
  const searchParams = await props.searchParams;
  const me = await getProfile();
  if (!me || !canSee(me.role, "/meals")) redirect("/dashboard");
  return <MealMonitoringSection me={me} heading date={searchParams.d} />;
}
