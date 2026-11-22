import { publicEnv } from "@/lib/env";

/**
 * The browser-facing origin. Inside Docker, Next.js binds to 0.0.0.0, so request.nextUrl.origin
 * would be wrong; use the Host header the browser sent, falling back to NEXT_PUBLIC_SITE_URL.
 */
export function publicOrigin(headers: Headers): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (host && /^[a-z0-9.\-]+(:\d+)?$/i.test(host) && !host.startsWith("0.0.0.0")) {
    const proto = headers.get("x-forwarded-proto") ?? "http";
    return `${proto === "https" ? "https" : "http"}://${host}`;
  }
  return publicEnv.siteUrl;
}
