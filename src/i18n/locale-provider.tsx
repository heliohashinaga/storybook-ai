"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { DEFAULT_TIME_ZONE, getMessages } from "./config";
import { resolveLocale } from "../lib/story-catalog";
import type { Locale } from "../features/story-request/client/story-preferences-schema";

/**
 * Single-locale experience (ADR 0003 / T056).
 *
 * The selected story language also drives the whole UI: `setLocale` re-renders
 * every `useTranslations` consumer (form chrome, reader, aria-live) in that
 * locale. The selection lives in React state only — anonymous by design, no
 * cookies/storage, and it is never sent anywhere except as the story-language
 * field in the generation payload.
 *
 * Components rendered outside this provider (Storybook stories, isolated
 * tests) get a safe pt-BR fallback from `useLocaleContext`.
 */

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const FALLBACK: LocaleContextValue = { locale: "pt-BR", setLocale: () => {} };

export function useLocaleContext(): LocaleContextValue {
  return useContext(LocaleContext) ?? FALLBACK;
}

export function LocaleProvider({
  defaultLocale = "pt-BR",
  children,
}: {
  defaultLocale?: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => resolveLocale(defaultLocale));

  // Announce the experience language to assistive tech and browsers (a11y):
  // screen readers announce UI + story in the same language the child picked.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next: Locale) => setLocaleState(resolveLocale(next));

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider
        locale={locale}
        messages={getMessages(locale)}
        timeZone={DEFAULT_TIME_ZONE}
      >
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
