// Field-level PHI masking helpers. Masking is display-only; access control is
// still enforced by RLS + role checks. These produce redacted renderings for
// lower-privilege views and audit surfaces.

export function maskName(name: string | null | undefined): string {
  if (!name) return "—";
  return name.split(/\s+/).map((part) => part ? part[0].toUpperCase() + "•".repeat(Math.max(1, part.length - 1)) : part).join(" ");
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return "••• ••• " + digits.slice(-4);
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  const shown = user.slice(0, 1);
  return `${shown}${"•".repeat(Math.max(1, user.length - 1))}@${domain}`;
}

export function maskId(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 4) return "••••";
  return "••••" + value.slice(-4);
}

/** Generic masker used by the access log. */
export function mask(value: string | null | undefined, kind: "name" | "phone" | "email" | "id" = "name"): string {
  switch (kind) {
    case "phone": return maskPhone(value);
    case "email": return maskEmail(value);
    case "id": return maskId(value);
    default: return maskName(value);
  }
}
