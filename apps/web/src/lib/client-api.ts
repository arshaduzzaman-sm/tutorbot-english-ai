"use client";

import { restClient } from "@/lib/api";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

/** Typed REST client with the current user's token, or null when logged out. */
export async function browserApi() {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  return token ? restClient(publicEnv.apiUrl, token) : null;
}
