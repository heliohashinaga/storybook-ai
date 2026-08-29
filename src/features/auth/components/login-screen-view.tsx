"use client";

import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";

/**
 * Clerk's `<SignIn>` statically imports clerk-js (~400 KiB). It is dynamically
 * imported (client-only) so it stays out of the initial `/` bundle and the 250
 * KiB initial-JS budget is respected (AGENTS.md: heavy libs are lazy). A small
 * spinner fills the reserved slot while the chunk loads.
 */
const SignIn = dynamic(() => import("@clerk/nextjs").then((m) => m.SignIn), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-20 w-full items-center justify-center"
      role="status"
      aria-label="Loading sign in"
    >
      <span
        className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      />
    </div>
  ),
});
import { buildClerkLocalization, type ClerkLocalization } from "../client/clerk-localization";
import { ClerkProviderGate } from "../client/clerk-provider";
import { NavMenuContents } from "../../shell/components/nav-menu-contents";
import { TopNavMenu } from "../../shell/components/top-nav-menu";
import { BrandLogo } from "../../../components/ui/brand-logo";
import { StarField } from "./star-field";

/** True when Clerk keys are present (playground enabled). */
const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/**
 * Client login screen (spec 018). Renders the Clerk `<SignIn>` component
 * (Google + e-mail/senha, plus sign-up and forgot-password handled by Clerk),
 * wrapped by the app's visual frame (StarField, brand, top-right kebab menu).
 *
 * Demo-only deploy (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`): no Clerk provider
 * is mounted, so we render only the anonymous demo panel (zero cookies). The
 * kebab's Sign out action is only mounted inside the provider (configured
 * mode), never on the anonymous demo path.
 */
export function LoginScreenView() {
  const tBrand = useTranslations("story.brand");
  const t = useTranslations("login");
  const locale = useLocale();
  // App-consistent Clerk localization: blanks the default sign-in hero and
  // surfaces our localized "access denied" copy on the restricted sign-up
  // screen (feature 020). Only title is overridden; subtitle stays Clerk's.
  const localization = buildClerkLocalization(
    locale === "pt-BR" ? "pt-BR" : "en",
    t("accessDenied")
  );

  return (
    <main className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden px-4 pt-16 pb-12">
      {/* Decorative star field behind the login hero. */}
      <StarField />

      {isClerkConfigured ? (
        <>
          {/* Right-aligned kebab (compact, icon-only trigger): lang/theme only.
              No Sign out here — on the login gate you're starting a session, not
              ending one; signing out only makes sense in the app header (top-nav),
              which renders it inside its own scoped provider. */}
          <ScreenKebab label={tBrand("menuLabel")} />
          <ScreenHero heading={t("heading")} tagline={t("tagline")}>
            {/* Clerk's provider + `<SignIn>` mount via a lazy slot so the hero
                above paints immediately and clerk-js stays out of the initial
                bundle (250 KiB budget). `routing="hash"` avoids requiring `/`
                to be a catch-all (Clerk navigates via hash). No custom `appearance`:
                Clerk's default theme is used (ADR 0013 accepts the internal style
                divergence) and avoids breaking Clerk's own primary-button CSS. */}
            <ClerkSignInSlot localization={localization} />

            <DemoLink locale={locale} label={t("demo")} />
          </ScreenHero>
        </>
      ) : (
        <>
          {/* Anonymous demo path: kebab without Sign out (no provider). */}
          <ScreenKebab label={tBrand("menuLabel")} />
          <ScreenHero heading={t("heading")} tagline={t("tagline")}>
            <DemoPanel locale={locale} demoLabel={t("demo")} note={t("noCredentials")} />
          </ScreenHero>
        </>
      )}
    </main>
  );
}

/** Right-aligned session kebab, placed like the app header (top-right of the
 *  centered `max-w-7xl` container) so it lines up with the kebab on `/form`
 *  and `/demo` at every width — not just flush to the viewport edge. Mirrors
 *  the shell `<header>` insets (px-3 py-4 / sm:px-6 sm:py-5 / lg:px-12).
 *  `z-40` keeps it above the centered hero card. */
function ScreenKebab({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center">
      <div className="w-full max-w-7xl px-3 pt-4 sm:px-6 sm:pt-5 lg:px-12">
        <div className="flex justify-end">
          <TopNavMenu label={label}>
            <NavMenuContents />
          </TopNavMenu>
        </div>
      </div>
    </div>
  );
}

/** The centered hero column (brand, heading, tagline, then the slot below). */
function ScreenHero({
  heading,
  tagline,
  children,
}: {
  heading: string;
  tagline: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-10 w-full max-w-md text-center">
      <div className="mb-4 flex justify-center">
        <BrandMark />
      </div>
      <h1 className="text-balance font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        {heading}
      </h1>
      <p className="mt-2 text-balance text-lg font-semibold text-foreground">{tagline}</p>
      <div className="mt-8 space-y-5">{children}</div>
    </div>
  );
}

/** The "Explore the Demo" entry link (client-side nav into `/demo`).
    A prominent text link (bold + underlined), not a button, so it draws
    attention beside the Clerk sign-in without competing as a second CTA. */
function DemoLink({ locale, label }: { locale: string; label: string }) {
  return (
    <a
      href="/demo"
      lang={locale}
      className="text-base font-bold text-primary underline underline-offset-4 transition-colors hover:text-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {label}
    </a>
  );
}

/** Anonymous demo-only entry card (zero Clerk keys). */
function DemoPanel({
  locale,
  demoLabel,
  note,
}: {
  locale: string;
  demoLabel: string;
  note: string;
}) {
  return (
    <section
      aria-label={demoLabel}
      className="space-y-4 rounded-3xl border border-border bg-card p-5"
    >
      <p role="note" className="text-center text-sm text-muted-foreground">
        {note}
      </p>
      <DemoLink locale={locale} label={demoLabel} />
    </section>
  );
}

/** Lazily mounts the Clerk provider + `<SignIn>`. The surrounding hero paints
 *  immediately; only this slot waits for the clerk-js chunk (budget guard). */
function ClerkSignInSlot({ localization }: { localization: ClerkLocalization }) {
  return (
    <ClerkProviderGate localization={localization}>
      <div className="flex min-h-[20rem] w-full justify-center">
        <SignIn routing="hash" />
      </div>
    </ClerkProviderGate>
  );
}

function BrandMark() {
  return (
    <div className="mb-3 flex justify-center">
      <BrandLogo className="size-14 object-contain" />
    </div>
  );
}
