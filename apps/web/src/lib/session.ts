import { redirect } from "next/navigation";
import type { TypedDocumentNode } from "@urql/core";
import { graphqlClient } from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Returns the verified user and access token, or redirects to /login. */
export async function requireSession(nextPath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!user || !session) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return { user, accessToken: session.access_token };
}

/** Runs one GraphQL query on the server with the user's token. Throws on errors (caught by error.tsx). */
export async function serverQuery<T, V extends object>(
  accessToken: string,
  doc: TypedDocumentNode<T, V>,
  variables: V = {} as V,
): Promise<T> {
  const result = await graphqlClient(serverEnv().apiUrl, accessToken).query(doc, variables).toPromise();
  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "No data returned from the API");
  }
  return result.data;
}
