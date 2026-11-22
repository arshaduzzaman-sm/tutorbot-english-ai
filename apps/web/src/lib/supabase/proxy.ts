import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv, serverEnv } from "@/lib/env";
import { publicOrigin } from "@/lib/origin";

export const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/profile", "/reset-password", "/lessons", "/practice", "/review"];

export function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function cookieName() {
  const host = new URL(publicEnv.supabaseUrl).hostname.split(".")[0];
  return `sb-${host}-auth-token`;
}

/** Refreshes the Supabase session cookie and redirects logged-out users away from protected pages. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(serverEnv().supabaseUrl, publicEnv.supabaseAnonKey, {
    cookieOptions: { name: cookieName() },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() validates the token with the auth server (do not trust the cookie alone).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected(request.nextUrl.pathname)) {
    const url = new URL(`/login?next=${encodeURIComponent(request.nextUrl.pathname)}`, publicOrigin(request.headers));
    return NextResponse.redirect(url);
  }
  return response;
}
