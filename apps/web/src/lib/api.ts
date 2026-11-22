import createFetchClient from "openapi-fetch";
import { Client, fetchExchange } from "@urql/core";
import type { paths } from "@/api/schema";

/** Typed REST client generated from the FastAPI OpenAPI schema. */
export function restClient(baseUrl: string, accessToken: string) {
  return createFetchClient<paths>({ baseUrl, headers: { Authorization: `Bearer ${accessToken}` } });
}

/** urql GraphQL client; every request carries the Supabase access token. */
export function graphqlClient(baseUrl: string, accessToken: string) {
  return new Client({
    url: `${baseUrl}/graphql`,
    exchanges: [fetchExchange],
    requestPolicy: "network-only",
    fetchOptions: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
