"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TopNavMenu } from "./top-nav-menu";

/**
 * Sign-out action for the kebab menu. Ends the gatekeeper session via
 * `POST /api/gate/logout` and returns to the porteiro (`/`). It is rendered
 * exclusively on the configured playground routes — the demo path has no
 * session to end (ADR 0015). No provider or auth SDK needed.
 */
export function SignOutButton() {
  const t = useTranslations("auth");
  const router = useRouter();

  return (
    <TopNavMenu.Item
      icon={<LogOutIcon className="size-5" />}
      tone="danger"
      onPress={async () => {
        await fetch("/api/gate/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
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
