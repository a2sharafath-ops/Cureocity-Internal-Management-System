"use client";

import RuntimeErrorView from "@/components/RuntimeErrorView";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <RuntimeErrorView error={error} reset={reset} global />
      </body>
    </html>
  );
}
