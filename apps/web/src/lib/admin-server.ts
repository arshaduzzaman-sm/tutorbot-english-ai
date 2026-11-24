import { notFound } from "next/navigation";
import { adminFetch, isStaff } from "@/lib/admin";
import { serverEnv } from "@/lib/env";
import { RolesQuery } from "@/graphql/queries";
import { requireSession, serverQuery } from "@/lib/session";

/** Signed-in staff only. Everyone else gets a 404, so the admin area is not even shown to exist. */
export async function requireStaff(path: string, adminOnly = false) {
  const { accessToken } = await requireSession(path);
  const roles = (await serverQuery(accessToken, RolesQuery)).viewer.roles;
  if (adminOnly ? !roles.includes("admin") : !isStaff(roles)) notFound();
  return {
    token: accessToken,
    roles,
    isAdmin: roles.includes("admin"),
    get: <T,>(p: string) => adminFetch<T>(serverEnv().apiUrl, accessToken, p),
  };
}
