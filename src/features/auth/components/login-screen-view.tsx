"use client";

import { useLocale, useTranslations } from "next-intl";
import { SignIn } from "@clerk/nextjs";
import { enUS, ptBR } from "@clerk/localizations";
import type { ClerkLocalization } from "../client/clerk-localization";
import { ClerkProviderGate } from "../client/clerk-provider";
import { NavMenuContents } from "../../shell/components/nav-menu-contents";
import { TopNavMenu } from "../../shell/components/top-nav-menu";
import { BrandLogo } from "../../../components/ui/brand-logo";
import { StarField } from "./star-field";

/** True when Clerk keys are present (playground enabled). */
const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/** Map the active locale to a Clerk localization resource.
 *
 *  The app's own hero (brand + tagline) already renders above the `<SignIn>`,
 *  so Clerk's default header (`title`/`subtitle`, e.g. "Sign in to
 *  Storybook AI" / "Welcome back! Please sign in to continue") is redundant.
 *  We blank those two strings out to avoid the duplication (decision: option B
 *  — remove, not re-copy). */
function clerkLocalizationFor(locale: string): ClerkLocalization {
  const base = locale === "pt-BR" ? ptBR : enUS;
  const signIn = base.signIn;
  // enUS/ptBR always ship `signIn`, but the Clerk type marks it optional; guard
  // so we don't spread `undefined` (and keep the return type intact).
  if (!signIn) return base;
  return {
    ...base,
    signIn: {
      ...signIn,
      start: { ...signIn.start, title: "", subtitle: "" },
    },
  };
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
      {/* Decorative star field behind the login hero. */}
      <StarField />

      {isClerkConfigured ? (
        <ClerkProviderGate localization={localization}>
          {/* Right-aligned kebab (compact, icon-only trigger): lang/theme only.
              No Sign out here — on the login gate you're starting a session, not
              ending one; signing out only makes sense in the app header (top-nav),
              which renders it inside its own scoped provider. `SignIn` embeds via
              `useClerk()` internally under this provider. */}
          <ScreenKebab label={tBrand("menuLabel")} />
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

/** Right-aligned session kebab menu (top-right corner): lang/theme only. */
function ScreenKebab({ label }: { label: string }) {
  return (
    <div className="absolute right-4 top-4 z-10">
      <TopNavMenu label={label}>
        <NavMenuContents />
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

function BrandMark() {
  return (
    <div className="mb-3 flex justify-center">
      <BrandLogo className="size-14 object-contain" />
    </div>
  );
}
