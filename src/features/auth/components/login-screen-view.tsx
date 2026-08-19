"use client";

import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { OAuthProviderButton, type OAuthProvider } from "./oauth-provider-button";
import { LangToggle } from "../../shell/components/lang-toggle";
import { ThemeToggle } from "../../theme/components/theme-toggle";
import { StarField } from "./star-field";

export interface LoginCredentials {
  google: boolean;
  github: boolean;
}

type SignInError = "accessDenied" | "generic" | null;

/** Resolve the localized message for an OAuth/URL sign-in error. */
function messageFor(error: SignInError, accessDenied: string, signInError: string): string | null {
  if (error === "accessDenied") return accessDenied;
  if (error === "generic") return signInError;
  return null;
}

/**
 * The "Explore the Demo" entry button. Client-side navigation into `/demo`
 * (not a full reload) so the in-memory language / theme chosen on the login
 * screen carries into the demo (spec 015).
 */
function DemoLink({ locale, label }: { locale: string; label: string }) {
  return (
    <Link
      href="/demo"
      lang={locale}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <SparklesIcon className="size-4" />
      {label}
    </Link>
  );
}

/**
 * The demo-only entry card shown when no OAuth provider is configured (zero
 * `AUTH_*`): the not-configured notice, the demo button and its hint share one
 * card (spec 015).
 */
function DemoPanel({
  locale,
  demoLabel,
  demoHint,
  note,
}: {
  locale: string;
  demoLabel: string;
  demoHint: string;
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
      <p className="text-center text-xs text-muted-foreground">{demoHint}</p>
    </section>
  );
}

/**
 * Client login screen (spec 015). Wires the presentational OAuth buttons to
 * Auth.js `signIn()` and the demo button to `/demo`. Provider availability is
 * passed in from the server so buttons are disabled when credentials aren't
 * configured (anonymous/demo-only deploys still work with zero `AUTH_*`).
 */
export function LoginScreenView({ credentials }: { credentials: LoginCredentials }) {
  const t = useTranslations("login");
  const locale = useLocale();
  const searchParams = useSearchParams();

  const anyProvider = credentials.google || credentials.github;

  const [busyProvider, setBusyProvider] = useState<OAuthProvider | null>(null);
  // Transient failures from `signIn()` (network/CSRF) are set in the event
  // handler below — never in an effect.
  const [runtimeError, setRuntimeError] = useState<SignInError>(null);

  // An OAuth provider redirects back with ?error=... (e.g. AccessDenied when
  // the signed-in email isn't in the allowlist). Derive the message from the
  // URL instead of setting state inside an effect (avoids cascading renders,
  // and reads identically during SSR/hydration via useSearchParams).
  const errorParam = searchParams.get("error");
  const urlError: SignInError = errorParam
    ? errorParam === "AccessDenied"
      ? "accessDenied"
      : "generic"
    : null;
  const error: SignInError = urlError ?? runtimeError;

  useEffect(() => {
    // External-system cleanup only: drop the now-consumed ?error= marker from
    // the URL bar (replaceState is not a navigation, so the derived message
    // above stays visible). No setState here.
    if (searchParams.get("error")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url);
    }
  }, [searchParams]);

  const handleOAuth = async (provider: OAuthProvider) => {
    setRuntimeError(null);
    setBusyProvider(provider);
    try {
      await signIn(provider);
      // On success Auth.js handles the redirect; on failure it throws/returns
      // an error URL that lands us back with ?error= handled above.
    } catch {
      setRuntimeError("generic");
    } finally {
      setBusyProvider(null);
    }
  };

  const errorMessage = messageFor(error, t("accessDenied"), t("signInError"));

  return (
    <main className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden px-4 py-12">
      {/* Blossom-style decorative star field behind the login hero. */}
      <StarField />
      {/* The login gate has no app header, so the session-only language + theme
          toggles live here in the top-right corner (ADR 0003, spec 003 US5). */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-sm">
        <LangToggle />
        <ThemeToggle />
      </div>
      {/* Story-blossom style: one centered column — icon, then heading + tagline,
          then the sign-in + demo actions below. (max-w-md, not max-w-sm: this design
          system maps size max-widths to spacing tokens, so max-w-sm = 8px.) */}
      <div className="relative z-10 w-full max-w-md text-center">
        <div className="mb-4 flex justify-center">
          <BrandMark />
        </div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {t("heading")}
        </h1>
        <p className="mt-2 text-lg font-semibold text-foreground">{t("tagline")}</p>

        <div className="mt-8 space-y-5">
          {anyProvider ? (
            <section
              aria-labelledby="playground-heading"
              className="space-y-3 rounded-3xl border border-border bg-card p-5"
            >
              <div className="text-left">
                <h2
                  id="playground-heading"
                  className="font-display text-lg font-bold text-foreground"
                >
                  {t("playgroundHeading")}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("playgroundDescription")}</p>
              </div>

              <div className="space-y-3">
                <OAuthProviderButton
                  provider="google"
                  label={t("google")}
                  disabled={!credentials.google}
                  busy={busyProvider === "google"}
                  onClick={() => handleOAuth("google")}
                />
                <OAuthProviderButton
                  provider="github"
                  label={t("github")}
                  disabled={!credentials.github}
                  busy={busyProvider === "github"}
                  onClick={() => handleOAuth("github")}
                />
              </div>

              {errorMessage && (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="text-center text-sm text-destructive"
                >
                  {errorMessage}
                </p>
              )}

              <div
                aria-hidden="true"
                className="flex items-center gap-3 text-xs text-muted-foreground"
              >
                <span className="h-px flex-1 bg-border" />
                <span>{t("or")}</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <DemoLink locale={locale} label={t("demo")} />
              <p className="text-center text-xs text-muted-foreground">{t("demoHint")}</p>
            </section>
          ) : (
            <DemoPanel
              locale={locale}
              demoLabel={t("demo")}
              demoHint={t("demoHint")}
              note={t("noCredentials")}
            />
          )}
        </div>
      </div>
    </main>
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
