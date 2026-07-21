import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { moduleScope, scopeAllows } from "@/lib/deployment";

export async function updateSession(request: NextRequest) {
  // ---- API routes are exempt from the cookie redirect -----------------------
  //
  // Everything under /api is called server-to-server: Vercel Cron, the Razorpay
  // webhook, wearable device uploads, and (soon) the public website form. None
  // of those callers can hold a Supabase session cookie, so redirecting them to
  // /login was not "protection" — it made the routes unreachable.
  //
  // This was silently breaking the entire nightly automation. Vercel Cron hit
  // /api/cron/daily every night at 03:00 UTC and received an HTML login page
  // instead of running: no renewals, no reminders, no SLA sweeps, no lead
  // digests. The same applied to the payments webhook.
  //
  // Exempting this is safe because every route under /api authenticates itself
  // and fails closed when its secret is missing:
  //   /api/cron/daily        Bearer CRON_SECRET             -> 401 if unset
  //   /api/wearables/ingest  Bearer WEARABLES_INGEST_SECRET -> 503 if unset
  //   /api/payments/webhook  HMAC signature verification    -> 400 on mismatch
  //   /api/fhir/[id]         getProfile() + canEmr() role   -> 403 with no session
  //
  // The cookie check is simply the wrong gate for machine callers; the right
  // gate is a shared secret, and each route already has one.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin = path === "/login";

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = moduleScope()?.home ?? "/dashboard";
    return NextResponse.redirect(url);
  }

  // A module-scoped deployment serves only its own routes; anything else lands
  // back on the module rather than 404-ing or half-rendering.
  const scope = moduleScope();
  if (user && scope && !isLogin && !scopeAllows(path)) {
    const url = request.nextUrl.clone();
    url.pathname = scope.home;
    return NextResponse.redirect(url);
  }

  return response;
}
