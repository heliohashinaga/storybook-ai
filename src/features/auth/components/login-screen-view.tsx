"use client";

import { useLocale, useTranslations } from "next-intl";
import { SignIn } from "@clerk/nextjs";
import { enUS, ptBR } from "@clerk/localizations";
import type { ClerkLocalization } from "../client/clerk-localization";
import { ClerkProviderGate } from "../client/clerk-provider";
import { NavMenuContents } from "../../shell/components/nav-menu-contents";
import { TopNavMenu } from "../../shell/components/top-nav-menu";
import { SignOutButton } from "../../shell/components/sign-out-button";
import { StarField } from "./star-field";

/** True when Clerk keys are present (playground enabled). */
const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/** Map the active locale to a Clerk localization resource. */
function clerkLocalizationFor(locale: string): ClerkLocalization {
  return locale === "pt-BR" ? ptBR : enUS;
}

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
  const localization = clerkLocalizationFor(locale);

  return (
    <main className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden px-4 pt-16 pb-12">
      {/* Blossom-style decorative star field behind the login hero. */}
      <StarField />

      {isClerkConfigured ? (
        <ClerkProviderGate localization={localization}>
          {/* Right-aligned kebab (compact, icon-only trigger). Inside the
              provider so the Sign out action can use `useClerk()`. */}
          <ScreenKebab label={tBrand("menuLabel")} showSignOut />
          <ScreenHero heading={t("heading")} tagline={t("tagline")}>
            <div className="flex flex-col items-center gap-4">
              {/* Clerk component: Google + e-mail/senha, sign-up e forgot-password
                  são gerenciados pelo Clerk (decisão B). A localização vem do
                  ClerkProvider (prop acima). `routing="hash"` evita exigir que `/`
                  seja catch-all (Clerk navega via hash, sem esbarrar no middleware).
                  Sem `appearance` custom: o tema padrão do Clerk é usado (ADR 0013
                  aceita a divergência de estilo interno) e evita quebrar o CSS do
                  próprio botão primário. */}
              <div className="flex min-h-[20rem] w-full justify-center">
                <SignIn routing="hash" />
              </div>

              <DemoLink locale={locale} label={t("demo")} />
            </div>
          </ScreenHero>
        </ClerkProviderGate>
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

/** Right-aligned session kebab menu (top-right corner). */
function ScreenKebab({ label, showSignOut }: { label: string; showSignOut?: boolean }) {
  return (
    <div className="absolute right-4 top-4 z-10">
      <TopNavMenu label={label}>
        <NavMenuContents trailing={showSignOut ? <SignOutButton /> : undefined} />
      </TopNavMenu>
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
    Styled as a prominent CTA pill so it draws attention next to the Clerk
    sign-in. */
function DemoLink({ locale, label }: { locale: string; label: string }) {
  return (
    <a
      href="/demo"
      lang={locale}
      className="inline-flex items-center gap-2 rounded-2xl border border-primary/50 bg-primary/10 px-5 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <SparklesIcon className="size-4" />
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

function BrandMark() {
  return (
    <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
      <BookOpenIcon className="size-7" />
    </div>
  );
}

function BookOpenIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2Z" />
      <path d="M19 14l.9 2.6L22.5 17.5l-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-1.9L19 14Z" />
      <path d="M5 15l.7 2L7.5 17.8l-1.8.8L5 20.5l-.7-1.9-1.8-.8 1.8-.8L5 15Z" />
    </svg>
  );
}
