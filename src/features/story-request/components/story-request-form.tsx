"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { useLocaleContext } from "../../../i18n/locale-provider";
import { ThemeSelector } from "./theme-selector";
import { deriveAgeBand, type AgeBand } from "../client/age-band";
import { Turnstile } from "./turnstile";
import { isTurnstileSiteKeyConfigured } from "./turnstile-config";
import {
  MAX_SCENES,
  MIN_SCENES,
  type Locale,
  type Theme,
} from "../client/story-preferences-schema";

/**
 * Anonymous story-request form (T031). The parent provides an `onSubmit` that
 * POSTs to `/api/stories`; this component owns field state, local age-band
 * derivation, validation, loading, and localized retry.
 *
 * Privacy: the exact age is derived to an `ageBand` in browser memory and the
 * request payload never contains an exact age or any child identifier — the
 * form has no name field at all.
 */
export interface GenerateStoryRequest {
  ageBand: AgeBand;
  locale: Locale;
  theme: Theme;
  sceneCount: number;
}

export type SubmitResult = { ok: true } | { ok: false; messageKey: string };

export type StoryRequestStatus = "idle" | "submitting" | "success";

const MIN_AGE = 2;
const MAX_AGE = 9;

interface StoryRequestFormProps {
  defaultTheme?: Theme;
  /** Reuse the last in-session scene count (defaults to 3). */
  defaultSceneCount?: number;
  /** Reuse the last in-session age so the slider isn't reset after 'new
   *  story' (generate-another uses lastPreferences directly). */
  defaultAge?: number;
  /**
   * Invoked with the anonymized request (ageBand/locale/theme/sceneCount — the
   * exact wire payload) plus the exact age kept in memory only for session reuse
   * (T050), and the Turnstile proof when the anti-bot widget is configured. The
   * age never goes to the API; the proof travels in a header, not the body.
   */
  onSubmit: (
    request: GenerateStoryRequest,
    age: number,
    turnstileToken?: string
  ) => Promise<SubmitResult>;
  onSuccess?: () => void;
  /** Localized retry `messageKey` (without the `story.error.` prefix) to seed
   *  the submit error when the app remounts the idle form after a failure. */
  initialError?: string;
}

export function StoryRequestForm({
  defaultTheme = "courage",
  defaultSceneCount = MIN_SCENES,
  defaultAge,
  onSubmit,
  onSuccess,
  initialError,
}: StoryRequestFormProps) {
  const t = useTranslations("story");
  const { locale: appLocale } = useLocaleContext();
  const ageInputRef = useRef<HTMLInputElement>(null);
  const submitErrorRef = useRef<HTMLDivElement>(null);
  const initialAge = defaultAge ?? 5;
  const [age, setAge] = useState<number>(initialAge);
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [sceneCount, setSceneCount] = useState<number>(defaultSceneCount);
  // Story locale is chosen independently of the page/UI locale: alternating the
  // header LangToggle switches the UI only, while this selector drives the
  // language the story's scenes are generated in. Defaults to the current UI
  // locale but stays a local, user-editable choice.
  const [locale, setLocale] = useState<Locale>(appLocale);
  const [status, setStatus] = useState<StoryRequestStatus>("idle");
  const [ageError, setAgeError] = useState<string | null>(null);
  // T056/T055: when the app routes a failed request back to the freshly
  // mounted idle form (the form unmounts during the progress panel), seed the
  // localized retry error from the app via this prop on mount.
  const [submitError, setSubmitError] = useState<string | null>(() =>
    initialError ? t(`error.${initialError}`) : null
  );

  const submitting = status === "submitting";
  const disabled = submitting;

  // Turnstile (feature 019). No-op when the site key is unset (feature off).
  const turnstileEnabled = isTurnstileSiteKeyConfigured();
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const onTokenChange = useCallback((token: string) => {
    setTurnstileToken(token);
    if (token) setTurnstileError(false);
  }, []);
  const onTurnstileError = useCallback((errored: boolean) => {
    setTurnstileError(errored);
    if (errored) setTurnstileToken("");
  }, []);
  const bumpReset = useCallback(() => setResetKey((k) => k + 1), []);

  // WCAG 3.3.1 / G194: after a failed generation, move keyboard focus to the
  // submit-error region so assistive tech lands on the failure message.
  useEffect(() => {
    if (submitError) submitErrorRef.current?.focus();
  }, [submitError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const numericAge = Number(age);
    // Single gate for client-side validation + the anti-bot proof (US4/US1
    // negation): without a proof we never submit.
    const gate = evaluateGate(numericAge, turnstileEnabled, turnstileToken);
    if (!gate.ok) {
      if (gate.kind === "age") {
        setAgeError(t("form.age.errorRange"));
        ageInputRef.current?.focus();
      } else {
        setSubmitError(t("error.captchaFailed"));
        setTurnstileError(true);
        bumpReset();
      }
      return;
    }

    setAgeError(null);
    setSubmitError(null);

    setStatus("submitting");

    const result = await onSubmit(
      {
        ageBand: deriveAgeBand(numericAge),
        locale,
        theme,
        sceneCount,
      },
      numericAge,
      turnstileEnabled ? turnstileToken : undefined
    );

    if (result.ok) {
      setStatus("success");
      onSuccess?.();
    } else {
      setStatus("idle");
      setSubmitError(t(`error.${result.messageKey}`));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-busy={submitting || undefined}
      className="flex flex-col gap-lg"
    >
      <ThemeSelector value={theme} onSelect={setTheme} disabled={disabled} />

      {/* Age — range slider (exact age stays in memory only). */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <label htmlFor="story-request-age" className="font-display text-lg font-bold">
          {t("form.age.label")}
        </label>
        <div className="mt-3 flex items-center gap-4">
          <input
            id="story-request-age"
            ref={ageInputRef}
            type="range"
            min={MIN_AGE}
            max={MAX_AGE}
            step={1}
            value={age}
            disabled={disabled}
            aria-label={t("form.age.label")}
            aria-describedby={ageError ? "story-request-age-error" : "story-request-age-hint"}
            aria-invalid={ageError ? true : undefined}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
            onChange={(event) => {
              setAge(Number(event.target.value));
              if (ageError) setAgeError(null);
            }}
          />
          <span className="min-w-16 shrink-0 rounded-xl bg-secondary px-3 py-1 text-center font-bold text-secondary-foreground">
            {age} {t("form.age.years")}
          </span>
        </div>
        <p id="story-request-age-hint" className="mt-3 text-sm text-muted-foreground">
          {t("form.age.hint")}
        </p>
        {ageError ? (
          <span id="story-request-age-error" role="alert" className="text-caption text-danger">
            {ageError}
          </span>
        ) : null}
      </div>

      {/* Story language — chosen independently of the page/UI LangToggle so
          the scenes are generated in this language. */}
      <fieldset
        disabled={disabled}
        aria-labelledby="story-request-locale-label"
        className="rounded-3xl border border-border bg-card p-5 shadow-soft"
      >
        <legend className="sr-only">{t("form.locale.label")}</legend>
        <div id="story-request-locale-label" className="font-display text-lg font-bold">
          {t("form.locale.label")}
        </div>
        <div
          role="group"
          aria-label={t("form.locale.label")}
          className="mt-3 grid grid-cols-2 gap-3"
        >
          {(["en", "pt-BR"] as const).map((option) => {
            const on = locale === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={on}
                onClick={() => setLocale(option)}
                className={`flex min-w-0 items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-center text-sm font-bold leading-snug transition-all hover:-translate-y-0.5 ${
                  on
                    ? "border-primary bg-primary text-primary-foreground shadow-lift"
                    : "border-border bg-background text-text hover:border-primary/50"
                }`}
              >
                {option === "pt-BR" ? t("brand.ptLabel") : t("brand.enLabel")}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Scenes — selectable cards (3/4/5). */}
      <fieldset
        disabled={disabled}
        aria-labelledby="story-request-scenes-label"
        className="rounded-3xl border border-border bg-card p-5 shadow-soft"
      >
        <legend className="sr-only">{t("form.scenes.label")}</legend>
        <div id="story-request-scenes-label" className="font-display text-lg font-bold">
          {t("form.scenes.label")}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[MIN_SCENES, 4, MAX_SCENES].map((count) => {
            const on = sceneCount === count;
            return (
              <button
                key={count}
                type="button"
                onClick={() => setSceneCount(count)}
                aria-pressed={on}
                aria-describedby="story-request-scenes-hint"
                className={`min-h-12 rounded-2xl border-2 font-display text-lg font-bold transition-all hover:-translate-y-0.5 sm:min-h-14 ${
                  on
                    ? "border-primary bg-primary text-primary-foreground shadow-lift"
                    : "border-border bg-background text-text hover:border-primary/50"
                }`}
              >
                {count}
                <span className="ml-1 whitespace-nowrap text-sm font-bold">
                  {t("form.scenes.scene-unit")}
                </span>
              </button>
            );
          })}
        </div>
        <p id="story-request-scenes-hint" className="mt-3 text-sm text-muted-foreground">
          {t("form.scenes.hint")}
        </p>
      </fieldset>

      {submitError ? (
        <div
          ref={submitErrorRef}
          id="story-request-submit-error"
          tabIndex={-1}
          className="focus:outline-none"
        >
          <Alert variant="danger">{submitError}</Alert>
        </div>
      ) : null}

      <SubmitControls
        turnstileEnabled={turnstileEnabled}
        turnstileError={turnstileError}
        onTokenChange={onTokenChange}
        onTurnstileError={onTurnstileError}
        resetKey={resetKey}
        disabled={disabled}
        submitting={submitting}
        submitLabel={t("form.submit")}
        submittingLabel={t("form.submitting")}
      />
    </form>
  );
}

/** Localized submit gate: age validity + anti-bot proof (feature 019). Keeps the
 *  handler's cyclomatic complexity in budget. */
type SubmitGate = { ok: true } | { ok: false; kind: "age" | "captcha" };
function evaluateGate(age: number, turnstileEnabled: boolean, token: string): SubmitGate {
  if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) return { ok: false, kind: "age" };
  if (turnstileEnabled && !token) return { ok: false, kind: "captcha" };
  return { ok: true };
}

interface SubmitControlsProps {
  turnstileEnabled: boolean;
  turnstileError: boolean;
  onTokenChange: (token: string) => void;
  onTurnstileError: (errored: boolean) => void;
  resetKey: number;
  disabled: boolean;
  submitting: boolean;
  submitLabel: string;
  submittingLabel: string;
}

/** Submit region (feature 019): the optional anti-bot widget and the submit
 *  button. Extracted so the form keeps its complexity budget and never touches
 *  the submit-error ref (which stays inline in the form). */
function SubmitControls(p: SubmitControlsProps) {
  return (
    <>
      {p.turnstileEnabled ? (
        <div
          className="flex justify-center"
          aria-live="polite"
          aria-busy={p.turnstileError || undefined}
        >
          <Turnstile
            onTokenChange={p.onTokenChange}
            onError={p.onTurnstileError}
            resetKey={p.resetKey}
          />
        </div>
      ) : null}

      <Button
        type="submit"
        size="md"
        loading={p.submitting}
        className="w-full !rounded-3xl sm:px-lg sm:py-md"
      >
        <SparklesIcon className="size-5" />
        {p.submitting ? p.submittingLabel : p.submitLabel}
      </Button>
    </>
  );
}

/** Inline Sparkles icon (lucide-style) — the core icon for story creation. */
function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3l1.9 5.7a2 2 0 0 0 1.2 1.2L20.8 12l-5.7 1.9a2 2 0 0 0-1.2 1.2L12 20.8l-1.9-5.7a2 2 0 0 0-1.2-1.2L3.2 12l5.7-1.9a2 2 0 0 0 1.2-1.2z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
