"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { NavMenuContents } from "../../shell/components/nav-menu-contents";
import { TopNavMenu } from "../../shell/components/top-nav-menu";
import { BrandLogo } from "../../../components/ui/brand-logo";
import { StarField } from "./star-field";

/**
 * Client porteiro screen (ADR 0015). Renders the shared-password form plus the
 * always-available Demo entry point, wrapped by the app's visual frame
 * (StarField, brand, top-right kebab).
 *
 * Demo-only deploy (no gatekeeper vars server-side): the server renders this
 * component with `gateConfigured={false}`, so only the anonymous demo panel is
 * shown (zero cookies). The password itself is never stored, logged, or sent
 * anywhere except `POST /api/gate/login`; a wrong password yields the same
 * generic error as a disabled gate (no enumeration).
 */
export function LoginScreenView({ gateConfigured }: { gateConfigured: boolean }) {
  const tBrand = useTranslations("story.brand");
  const t = useTranslations("login");

  return (
    <main className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden px-4 pt-16 pb-12">
      {/* Decorative star field behind the login hero. */}
      <StarField />

      <ScreenKebab label={tBrand("menuLabel")} />
      <ScreenHero heading={t("heading")} tagline={t("tagline")}>
        {gateConfigured ? (
          <PasswordPanel
            passwordLabel={t("password")}
            submitLabel={t("submit")}
            demoLabel={t("demo")}
          />
        ) : (
          <DemoPanel demoLabel={t("demo")} note={t("noCredentials")} />
        )}
      </ScreenHero>
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
        {/* pointer-events-auto re-enables clicking the kebab trigger + panel;
            the strip itself stays pointer-events-none so empty surroundings
            never block the centered hero behind it. */}
        <div className="pointer-events-auto flex justify-end">
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

/** Shared-password form. On success the server sets the httpOnly gatekeeper
 *  cookie and the client navigates into the playground; on failure a generic,
 *  localized error is announced (no enumeration of "wrong" vs "disabled"). */
function PasswordPanel({
  passwordLabel,
  submitLabel,
  demoLabel,
}: {
  passwordLabel: string;
  submitLabel: string;
  demoLabel: string;
}) {
  const t = useTranslations("login");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/gate/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        router.push("/form");
        router.refresh();
        return;
      }
      setError(t("invalidCredentials"));
    } catch {
      setError(t("invalidCredentials"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-label={submitLabel}
      className="space-y-4 rounded-3xl border border-border bg-card p-5"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2 text-left">
          <label htmlFor="gatekeeper-password" className="text-sm font-semibold text-foreground">
            {passwordLabel}
          </label>
          <input
            id="gatekeeper-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={200}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "gatekeeper-error" : undefined}
            disabled={pending}
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
          />
        </div>
        {error ? (
          <p id="gatekeeper-error" role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="w-full rounded-2xl bg-primary px-4 py-3 text-base font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </form>
      <DemoLink label={demoLabel} />
    </section>
  );
}

/** The "Explore the Demo" entry link (client-side nav into `/demo`).
    A prominent text link (bold + underlined), not a button, so it draws
    attention without competing as a second CTA. */
function DemoLink({ label }: { label: string }) {
  return (
    <a
      href="/demo"
      className="text-base font-bold text-primary underline underline-offset-4 transition-colors hover:text-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {label}
    </a>
  );
}

/** Anonymous demo-only entry card (zero gatekeeper config). */
function DemoPanel({ demoLabel, note }: { demoLabel: string; note: string }) {
  return (
    <section
      aria-label={demoLabel}
      className="space-y-4 rounded-3xl border border-border bg-card p-5"
    >
      <p role="note" className="text-center text-sm text-muted-foreground">
        {note}
      </p>
      <DemoLink label={demoLabel} />
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
