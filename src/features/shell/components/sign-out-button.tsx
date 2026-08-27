"use client";

import { useClerk } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { TopNavMenu } from "./top-nav-menu";

/**
 * Sign-out action for the kebab menu. Lives as its own client component so the
 * `useClerk()` hook is only ever called *inside* a `ClerkProvider` — it must be
 * rendered exclusively where the playground provider is mounted (spec 018 /
 * ADR 0013). The caller gates rendering on `isClerkConfigured`, so the demo
 * path never mounts it (no provider, no session to sign out of).
 */
export function SignOutButton() {
  const t = useTranslations("auth");
  const { signOut } = useClerk();

  return (
    <TopNavMenu.Item
      icon={<LogOutIcon className="size-5" />}
      tone="danger"
      onPress={() => signOut({ redirectUrl: "/" })}
    >
      {t("nav.logout")}
    </TopNavMenu.Item>
  );
}

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
