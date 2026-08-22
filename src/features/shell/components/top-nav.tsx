"use client";

import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useLocaleContext } from "../../../i18n/locale-provider";
import type { Locale } from "../../story-request/client/story-preferences-schema";
import { useColorScheme } from "../../theme/client/use-color-scheme";
import { ThemeToggle } from "../../theme/components/theme-toggle";
import { LangToggle } from "./lang-toggle";
import { TopNavMenu } from "./top-nav-menu";

/**
 * Top bar (blossom-design §7.1): home brand mark + language + theme.
 *
 * Layout mirrors the reference — `max-w-5xl grid grid-cols-[1fr_auto]`.
 * - Left: a home button (primary, BookOpenText mark + display name).
 *   Home is route-aware: on the anonymous demo routes (`/demo`, `/demo/reader`)
 *   it navigates back to the demo form `/demo`; everywhere else it navigates to
 *   the login gate `/` (which the server redirects to `/form` when authed — Spec
 *   015). On the playground routes (`/form`, `/reader`) a **Sign out** action
 *   appears.
 * - Right: on `sm+` the segmented `LangToggle` + icon `ThemeToggle` (+ Sign out
 *   on the playground) are shown inline. Below `sm` they collapse behind a
 *   kebab menu (`TopNavMenu`) rendered as a proper menu of rows.
 *
 * All state is in-memory only: language and theme pickers drive
 * `useLocaleContext` / `useColorScheme` and nothing is persisted. `signOut`
 * from `next-auth/react` works without a `SessionProvider` (it posts to
 * `/api/auth/signout` directly).
 */
export function TopNav() {
  const t = useTranslations("story.brand");
  const tTheme = useTranslations("theme");
  const tAuth = useTranslations("auth");
  const { locale, setLocale } = useLocaleContext();
  const { applied, toggle } = useColorScheme();
  const router = useRouter();
  // Navigation home is the login gate `/`; it redirects to `/form` when authed.
  const pathname = usePathname();
  // The login gate `/` is a standalone, center-focused screen: it has no app
  // header/nav — the brand is already presented by the login hero itself.
  // Return after all hooks so hook order stays stable across renders.
  if (pathname === "/") return null;
  // Home is route-aware: on the demo routes the brand returns to the demo form
  // (/demo); everywhere else it returns to the login gate `/`.
  const isDemo = pathname === "/demo" || pathname.startsWith("/demo/");
  const homePath = isDemo ? "/demo" : "/";
  const onHome = pathname === homePath;
  // Sign out is meaningful only on the protected playground routes.
  const isPlayground = pathname === "/form" || pathname === "/reader";

  // Menu items for the mobile kebab. Locale options mirror LangToggle.
  const themeLabel = applied === "dark" ? tTheme("toLight") : tTheme("toDark");
  const localeOptions: Array<{ value: Locale; label: string }> = [
    { value: "pt-BR", label: t("portuguese") },
    { value: "en", label: t("english") },
  ];

  return (
    <header className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_auto] items-center gap-2 px-3 py-4 sm:gap-3 sm:px-6 sm:py-5 lg:px-12">
      <button
        type="button"
        onClick={() => router.push(homePath)}
        aria-label={t("home")}
        aria-current={onHome ? "page" : undefined}
        className="flex min-w-0 items-center gap-2 whitespace-nowrap rounded-2xl text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring sm:gap-3"
      >
        <span className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft transition-all duration-base hover:-translate-y-0.5 hover:shadow-lift motion-safe:active:translate-y-0 motion-safe:active:shadow-soft sm:size-11">
          <BookOpenText className="size-5 sm:size-6" aria-hidden="true" />
        </span>
        <span className="min-w-0 truncate font-display text-base font-bold sm:text-lg">
          {t("name")}
        </span>
      </button>

      {/* Desktop: lang + theme ( + sign out on playground) inline. */}
      <div className="hidden items-center gap-3 sm:flex">
        <LangToggle />
        <ThemeToggle />
        {isPlayground && (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            aria-label={tAuth("nav.logout")}
            title={tAuth("nav.logout")}
            className="flex size-11 items-center justify-center rounded-2xl border border-border bg-card text-text shadow-soft transition-all duration-base hover:shadow-lift hover:-translate-y-0.5"
          >
            <LogOutIcon className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Mobile: collapse the actions behind a kebab menu of rows. */}
      <div className="sm:hidden">
        <TopNavMenu label={t("menuLabel")}>
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
            icon={
              applied === "dark" ? <MoonIcon className="size-5" /> : <SunIcon className="size-5" />
            }
            onPress={toggle}
          >
            <span className="truncate">{themeLabel}</span>
          </TopNavMenu.Item>

          {isPlayground && (
            <>
              <TopNavMenu.Divider />
              <TopNavMenu.Item
                icon={<LogOutIcon className="size-5" />}
                tone="danger"
                onPress={() => signOut({ callbackUrl: "/" })}
              >
                {tAuth("nav.logout")}
              </TopNavMenu.Item>
            </>
          )}
        </TopNavMenu>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------------------
 * Icons (inline, blossom-style presentational marks).
 * ------------------------------------------------------------------------- */

/** Inline log-out icon. */
function LogOutIcon({ className }: { className?: string }) {
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
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/** Inline open-book brand mark. */
function BookOpenText({ className }: { className?: string }) {
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
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      <path d="M12 7v14" />
    </svg>
  );
}

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
