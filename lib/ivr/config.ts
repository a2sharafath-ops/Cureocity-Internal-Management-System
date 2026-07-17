// IVR / click-to-call configuration. Key-ready scaffold: until a provider is
// configured, the Call button falls back to a device `tel:` dialer link.
//
// To activate click-to-call (later), set:
//   IVR_PROVIDER=exotel|knowlarity|twilio
//   IVR_API_KEY=xxx
//   IVR_CALLER_ID=+91XXXXXXXXXX     # your virtual number
//   IVR_AGENT_NUMBER=+91XXXXXXXXXX  # front-desk phone the call bridges to

export function ivrConfig() {
  const provider = (process.env.IVR_PROVIDER || "").toLowerCase();
  const configured = Boolean(provider && process.env.IVR_API_KEY);
  return { provider, configured };
}

export function ivrStatus() {
  const { provider, configured } = ivrConfig();
  return { provider: provider || "none", configured };
}
