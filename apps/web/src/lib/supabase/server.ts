import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv, serverEnv } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(serverEnv().supabaseUrl, publicEnv.supabaseAnonKey, {
    cookieOptions: { name: cookieName() },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** Browser and server must use the same cookie name even if the server reaches Supabase via another host. */
export function cookieName() {
  const host = new URL(publicEnv.supabaseUrl).hostname.split(".")[0];
  return `sb-${host}-auth-token`;
}
