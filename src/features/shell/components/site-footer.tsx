"use client";

import { useTranslations } from "next-intl";
import { GitHubIcon } from "../../auth/components/oauth-provider-button";

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
