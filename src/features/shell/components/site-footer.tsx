"use client";

import { useTranslations } from "next-intl";

/**
 * Public portfolio repository (hardcoded — the project is published for
 * portfolio review only, see README disclaimer; not an identifier or secret).
 */
export const GITHUB_REPO_URL = "https://github.com/heliohashinaga/storybook-ai";

/**
 * Global site footer, rendered once in the root layout so the portfolio repo
 * link is visible on every route. Deliberately minimal and discreet — a small
 * text link, never styled like a primary/CTA action.
 */
export function SiteFooter() {
  const t = useTranslations("siteFooter");
  return (
    <footer className="flex justify-center px-4 pb-8">
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <GitHubIcon className="size-3.5" />
        {t("viewSource")}
      </a>
    </footer>
  );
}

/** Inline GitHub brand mark (presentational only). */
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}
