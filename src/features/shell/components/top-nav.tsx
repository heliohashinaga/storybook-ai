"use client";

import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { ThemeToggle } from "../../theme/components/theme-toggle";
import { LangToggle } from "./lang-toggle";

/**
 * Top bar (blossom-design §7.1): home brand mark + language + theme.
 *
 * Layout mirrors the reference — `max-w-5xl grid grid-cols-[1fr_auto]`.
 * - Left: a home button (primary, BookOpenText mark + display name + tagline).
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
    <header className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_auto] items-center gap-3 px-4 py-5 sm:px-6 lg:px-12">
      <button
        type="button"
        onClick={() => router.push(homePath)}
        aria-label={t("home")}
        aria-current={onHome ? "page" : undefined}
        className="flex items-center gap-3 rounded-2xl text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex size-11 cursor-pointer items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft transition-all duration-base hover:-translate-y-0.5 hover:shadow-lift motion-safe:active:translate-y-0 motion-safe:active:shadow-soft">
          <BookOpenText className="size-6" aria-hidden="true" />
        </span>
        <span className="flex flex-col items-start">
          <span className="font-display text-lg leading-title font-bold">{t("name")}</span>
          <span className="text-xs leading-caption text-text-subtle">{t("tagline")}</span>
        </span>
      </button>
      <div className="flex items-center gap-3">
        {isPlayground && (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            lang={locale}
            className="rounded-2xl border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {tAuth("nav.logout")}
          </button>
        )}
        <LangToggle />
        <ThemeToggle />
      </div>
    </header>
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
