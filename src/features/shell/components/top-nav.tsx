"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { NavMenuContents } from "./nav-menu-contents";
import { TopNavMenu } from "./top-nav-menu";
import { SignOutButton } from "./sign-out-button";

/**
 * Top bar: home brand mark + a kebab (⋮) menu.
 *
 * Layout mirrors the reference — `max-w-5xl grid grid-cols-[1fr_auto]`.
 * - Left: a home button (primary, BookOpenText mark + display name).
 *   Home is route-aware: on the anonymous demo routes (`/demo`, `/demo/reader`)
 *   it navigates back to the demo form `/demo`; everywhere else it navigates to
 *   the login gate `/` (which the server redirects to `/form` when authed — Spec
 *   015). On the playground routes (`/form`, `/reader`) a **Sign out** action
 *   appears.
 * - Right: the actions (language, theme and, on the playground, Sign out)
 *   live behind a single kebab menu (`TopNavMenu`) on **every** breakpoint —
 *   mobile and desktop share the exact same compact menu experience.
 *
 * All state is in-memory only: language and theme pickers drive
 * `useLocaleContext` / `useColorScheme` and nothing is persisted. `SignOutButton`
 * (mounted only on the configured playground) ends the Clerk session.
 */
export function TopNav() {
  const t = useTranslations("story.brand");
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
  // Sign out is meaningful only on the protected playground routes and only
  // when Clerk is configured (the demo path has no session to end).
  const isPlayground = pathname === "/form" || pathname === "/reader";
  const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

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

      {/* Actions: collapsed behind a kebab menu of rows on every breakpoint, so
          mobile and desktop share the exact same menu experience. */}
      <TopNavMenu label={t("menuLabel")}>
        <NavMenuContents
          trailing={isPlayground && isClerkConfigured ? <SignOutButton /> : undefined}
        />
      </TopNavMenu>
    </header>
  );
}

/* ---------------------------------------------------------------------------
 * Icons (inline, blossom-style presentational marks).
 * ------------------------------------------------------------------------- */

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
