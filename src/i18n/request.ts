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
    // Dates are shown in one zone on the server and in the browser (as in the PDF reports).
    timeZone: "Europe/Moscow",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
