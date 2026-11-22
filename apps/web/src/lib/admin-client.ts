"use client";

import { adminFetch } from "@/lib/admin";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

export async function adminCall<T>(path: string, method: string, body?: unknown): Promise<T> {
  const { data } = await createClient().auth.getSession();
  return adminFetch<T>(publicEnv.apiUrl, data.session?.access_token ?? "", path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
