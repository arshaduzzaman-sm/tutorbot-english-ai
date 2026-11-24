import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Content-Security-Policy: only this site, the local API and local Supabase. No third-party scripts or trackers.
// Next.js needs inline scripts for hydration; 'unsafe-eval' only in development (React refresh).
function origins(url: string | undefined, fallback: string) {
  const u = new URL(url ?? fallback);
  const alt = u.hostname === "localhost" ? "127.0.0.1" : u.hostname === "127.0.0.1" ? "localhost" : null;
  return [u.origin, ...(alt ? [`${u.protocol}//${alt}${u.port ? `:${u.port}` : ""}`] : [])];
}
const connect = [
  "'self'",
  ...origins(process.env.NEXT_PUBLIC_API_URL, "http://localhost:8000"),
  ...origins(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321"),
].join(" ");
const dev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `media-src 'self' blob: ${connect.replace("'self' ", "")}`,
  `connect-src ${connect}${dev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
];

const nextConfig: NextConfig = {
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
