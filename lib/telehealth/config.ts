// Telehealth configuration. Works immediately with public Jitsi rooms (no key).
// For private / recorded rooms, set a provider:
//   TELEHEALTH_PROVIDER=daily|twilio         # provider name
//   TELEHEALTH_API_KEY=xxx                    # provider API key
//   TELEHEALTH_BASE_URL=https://your.daily.co # room host
// With no provider set, sessions use https://meet.jit.si rooms.

export function telehealthConfig() {
  const provider = (process.env.TELEHEALTH_PROVIDER || "jitsi").toLowerCase();
  const baseUrl = process.env.TELEHEALTH_BASE_URL || "https://meet.jit.si";
  // Jitsi public rooms need no key; other providers do.
  const secure = provider !== "jitsi" && Boolean(process.env.TELEHEALTH_API_KEY);
  return { provider, baseUrl, secure };
}

export function telehealthStatus() {
  const { provider, secure } = telehealthConfig();
  return { provider, secure };
}
