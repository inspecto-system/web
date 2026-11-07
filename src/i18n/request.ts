import { getRequestConfig } from "next-intl/server";

/** Languages of the interface (ADR-019): Russian now, English prepared. */
export const locales = ["ru", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ru";

// No locale in the URL: the interface is Russian; the language switch comes with English texts.
export default getRequestConfig(async () => {
  const locale = defaultLocale;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
