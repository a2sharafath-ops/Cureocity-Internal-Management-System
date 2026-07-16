"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Subscribes to Postgres changes on the given tables and refreshes the current
// route's server data when anything relevant changes. The refetch runs through
// RLS server-side, so this only ever shows data the user is allowed to see.
export default function RealtimeRefresh({ tables }: { tables: string[] }) {
  const router = useRouter();
  const key = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("rt:" + key);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 350);
    };
    for (const table of key.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, bump);
    }
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [key, router]);

  return null;
}
