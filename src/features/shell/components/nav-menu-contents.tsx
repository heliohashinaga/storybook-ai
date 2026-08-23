"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useLocaleContext } from "../../../i18n/locale-provider";
import type { Locale } from "../../story-request/client/story-preferences-schema";
import { useColorScheme } from "../../theme/client/use-color-scheme";
import { TopNavMenu } from "./top-nav-menu";

/**
 * Shared language + theme rows for the top-nav kebab menu, reused verbatim on
 * the shell header and the login gate so both expose the exact same menu.
 *
 * Renders a labelled "Idioma" section with the two locale rows (the active one
 * marked with a trailing check) followed by a divider and a theme toggle row.
 * All state comes from `useLocaleContext` / `useColorScheme`, so nothing is
 * persisted — render inside a component tree that provides both providers.
 *
 * An optional `trailing` node (e.g. a Sign out item) is appended after a
 * divider, matching the header's playground layout.
 */
export function NavMenuContents({ trailing }: { trailing?: ReactNode }) {
  const t = useTranslations("story.brand");
  const tTheme = useTranslations("theme");
  const { locale, setLocale } = useLocaleContext();
  const { applied, toggle } = useColorScheme();

  const themeLabel = applied === "dark" ? tTheme("toLight") : tTheme("toDark");
  const localeOptions: Array<{ value: Locale; label: string }> = [
    { value: "pt-BR", label: t("portuguese") },
    { value: "en", label: t("english") },
  ];

  return (
    <>
      <span className="block px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-text-subtle">
        {t("languageLabel")}
      </span>
      {localeOptions.map((option) => {
        const active = option.value === locale;
        return (
          <TopNavMenu.Item
            key={option.value}
            icon={<GlobeIcon className="size-5" />}
            trailing={active ? <CheckIcon className="size-4 text-primary" /> : undefined}
            onPress={() => setLocale(option.value)}
          >
            {option.label}
          </TopNavMenu.Item>
        );
      })}

      <TopNavMenu.Divider />

      <TopNavMenu.Item
        icon={applied === "dark" ? <MoonIcon className="size-5" /> : <SunIcon className="size-5" />}
        onPress={toggle}
      >
        <span className="truncate">{themeLabel}</span>
      </TopNavMenu.Item>

      {trailing ? (
        <>
          <TopNavMenu.Divider />
          {trailing}
        </>
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Icons (inline, blossom-style presentational marks).
 * ------------------------------------------------------------------------- */

/** Globe icon (language rows). */
function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

/** Check mark (active language). */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Sun icon (light mode active / toggle turns the app light). */
function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

/** Moon icon (dark mode active / toggle turns the app dark). */
function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
