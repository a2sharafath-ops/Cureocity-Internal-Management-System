"use client";

import RuntimeErrorView from "@/components/RuntimeErrorView";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RuntimeErrorView error={error} reset={reset} />;
}
