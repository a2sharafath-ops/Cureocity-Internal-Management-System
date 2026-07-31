import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { getAppSettings, brandLogo } from "@/lib/settings";
import KioskAttendance from "@/components/KioskAttendance";

export const dynamic = "force-dynamic";

// Full-screen attendance kiosk for a desk phone/tablet. The device stays signed
// in as a staff/front-desk account; individual staff punch in/out by scanning
// their QR badge or entering name + PIN.
export default async function AttendanceKioskPage() {
  const me = await getProfile();
  if (!me) redirect("/login");
  const supabase = createClient();
  const { data } = await supabase.from("staff").select("id, name").order("name");
  const staff = (data ?? []) as { id: string; name: string }[];
  const logo = brandLogo(await getAppSettings());
  return <KioskAttendance staff={staff} logo={logo} />;
}
