import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { moduleScope, scopeAllows } from "@/lib/deployment";

export async function updateSession(request: NextRequest) {
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
