"use client";

import { useTranslations } from "next-intl";
import { Button } from "../../../components/ui/button";
import { useColorScheme } from "../client/use-color-scheme";

/**
 * Manual session-only light/dark toggle (spec 003, US5). Shows the *effective*
 * appearance and switches it; nothing is persisted, so on reload the app follows
 * the system again. Uses a labelled button with `aria-pressed`.
 */
export function ThemeToggle() {
  const t = useTranslations("theme");
  const { applied, toggle } = useColorScheme();

  return (
    <Button type="button" variant="secondary" aria-pressed={applied === "dark"} onClick={toggle}>
      {applied === "dark" ? t("toLight") : t("toDark")}
    </Button>
  );
}
