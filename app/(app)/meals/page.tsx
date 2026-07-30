import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import MealMonitoringSection from "@/components/MealMonitoringSection";

export const dynamic = "force-dynamic";

export default async function MealsPage({ searchParams }: { searchParams: { d?: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/meals")) redirect("/dashboard");
  return <MealMonitoringSection me={me} heading date={searchParams.d} />;
}
