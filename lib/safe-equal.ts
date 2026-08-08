/**
 * Constant-time string comparison for shared secrets.
 *
 * `a === b` on strings short-circuits at the first differing character, so the
 * time it takes leaks how much of the secret you guessed right. Over a network
 * that is a hard attack to land — but the same codebase already did this
 * properly in two webhook routes and sloppily in three others, and having one
 * answer is worth more than the argument about exploitability.
 *
 * Length is compared first and separately: nothing here hides the LENGTH of a
 * secret, only its contents.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** `Authorization: Bearer <secret>` checked in constant time. Fails closed. */
export function bearerOk(header: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  return safeEqual(header ?? "", `Bearer ${secret}`);
}
