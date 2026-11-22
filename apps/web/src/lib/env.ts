// Public values are inlined at build time; server values are read at runtime.
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export function serverEnv() {
  return {
    supabaseUrl: process.env.SUPABASE_URL_INTERNAL ?? publicEnv.supabaseUrl,
    apiUrl: process.env.API_URL_INTERNAL ?? publicEnv.apiUrl,
  };
}
