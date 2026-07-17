import { emailConfig } from "./config";

export type SendResult = { status: "sent" | "failed" | "skipped"; providerId?: string; error?: string };

// Sends an email via Resend's REST API. Returns "skipped" (never throws) when
// the provider isn't configured, so callers can log the attempt and move on.
export async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  const cfg = emailConfig();
  if (!cfg.configured) return { status: "skipped" };
  if (!to) return { status: "failed", error: "No recipient" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: cfg.from, to: [to], subject, html }),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      return { status: "failed", error: `Resend ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { status: "sent", providerId: data.id };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "Send error" };
  }
}
