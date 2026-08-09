import { getRequestConfig } from "next-intl/server";
import { routing, getMessages } from "./config";
import type { Locale } from "../features/story-request/client/story-preferences-schema";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = (await requestLocale) as Locale | undefined;

  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale as Locale;
  }

  return {
    locale,
    // Feature message catalogs resolved in src/i18n/config.ts (US4: pt-BR + en).
    messages: getMessages(locale),
  };
});
