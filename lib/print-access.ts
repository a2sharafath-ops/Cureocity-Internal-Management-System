import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyDocToken, type DocKind } from "@/lib/pdf";

/**
 * The Supabase client a print page should read with.
 *
 * Normally the request-scoped client, so RLS decides: staff see everything,
 * a client sees only their own published, shared document.
 *
 * A rendering service is different. It is an outside machine fetching a URL
 * with no cookie and no session, so RLS would hand it nothing and the PDF would
 * come out empty. Making these pages public is not an option — they carry
 * clinical detail — so instead the app signs a short-lived token naming exactly
 * one document, and only that token unlocks a service-role read.
 *
 * The important property: the token binds BOTH the document type and its id, so
 * a token minted for one diet plan cannot be pointed at a prescription, at
 * another client's plan, or at a list. It is a key to one door, and it expires
 * in ten minutes.
 */
export async function printClient(kind: DocKind, id: string, token?: string | null) {
  if (token && verifyDocToken(token, kind, id)) {
    // Render-only. Nothing downstream writes; this widens reads for one row.
    return createAdminClient();
  }
  return await createClient();
}

/** True when this request is a renderer rather than a person — used to hide
 *  the on-screen Print button, which would otherwise print into the PDF. */
export function isRenderRequest(kind: DocKind, id: string, token?: string | null): boolean {
  return Boolean(token && verifyDocToken(token, kind, id));
}
