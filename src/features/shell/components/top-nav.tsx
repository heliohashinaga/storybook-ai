"use client";

import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
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
 * - Right: segmented `LangToggle` (aria-pressed) + icon `ThemeToggle` (Sun/Moon).
 *
 * All state is in-memory only: language and theme pickers drive `useLocaleContext`
 * / `useColorScheme` and nothing is persisted. `signOut` from `next-auth/react`
 * works without a `SessionProvider` (it posts to `/api/auth/signout` directly).
 */
export function TopNav() {
  const t = useTranslations("story.brand");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
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
      <div className="hidden items-center gap-3 sm:flex">
        <LangToggle />
        <ThemeToggle />
        {isPlayground && (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            lang={locale}
            aria-label={tAuth("nav.logout")}
            title={tAuth("nav.logout")}
            className="flex size-11 items-center justify-center rounded-2xl border border-border bg-card text-text shadow-soft transition-all duration-base hover:shadow-lift hover:-translate-y-0.5"
          >
            <LogOutIcon className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Mobile: collapse the actions behind a kebab menu. */}
      <div className="sm:hidden">
        <TopNavMenu label={t("menuLabel")}>
          <LangToggle />
          <div className="flex w-full items-center justify-center rounded-2xl border border-border bg-secondary/40 p-1">
            <ThemeToggle />
          </div>
          {isPlayground && (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              lang={locale}
              className="flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-border bg-card px-4 py-3 text-sm font-bold text-text shadow-soft transition-colors hover:bg-secondary"
            >
              <LogOutIcon className="size-5" aria-hidden="true" />
              <span>{tAuth("nav.logout")}</span>
            </button>
          )}
        </TopNavMenu>
      </div>
    </header>
  );
}

/** Inline log-out icon (blossom-style presentational mark). */
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

/** Inline open-book brand mark (presentation only — no identifiers). */
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
