import { getRequestConfig } from "next-intl/server";

// English first. More locales (and RTL) can be added by adding messages/<locale>.json
// and choosing the locale here from a cookie or the profile (SPEC 9.3).
export const defaultLocale = "en";

export default getRequestConfig(async () => {
  const locale = defaultLocale;
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
