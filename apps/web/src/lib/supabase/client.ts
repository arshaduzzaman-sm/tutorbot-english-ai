"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

export function createClient() {
  const host = new URL(publicEnv.supabaseUrl).hostname.split(".")[0];
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookieOptions: { name: `sb-${host}-auth-token` },
  });
}
