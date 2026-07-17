// Email configuration. Key-ready scaffold: stays inert until env vars are set.
//
// To activate (later), set in Vercel / .env.local:
//   RESEND_API_KEY=re_xxx
//   EMAIL_FROM="Cureocity <no-reply@cureo.city>"
// (The from-address domain must be verified in the Resend dashboard.)

export function emailConfig() {
  const apiKey = process.env.RESEND_API_KEY ?? "";
  const from = process.env.EMAIL_FROM ?? "Cureocity <no-reply@cureo.city>";
  return {
    provider: "resend" as const,
    configured: Boolean(apiKey),
    from,
  };
}

export function emailStatus() {
  const { provider, configured, from } = emailConfig();
  return { provider, configured, from };
}
