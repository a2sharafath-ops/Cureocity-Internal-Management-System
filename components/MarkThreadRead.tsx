"use client";

import { useEffect } from "react";
import { markThreadRead } from "@/lib/actions";

export default function MarkThreadRead({ clientId }: { clientId: string }) {
  useEffect(() => {
    markThreadRead(clientId);
  }, [clientId]);
  return null;
}
