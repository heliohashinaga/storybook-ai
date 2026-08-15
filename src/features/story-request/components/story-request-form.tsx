"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Select } from "../../../components/ui/select";
import { useLocaleContext } from "../../../i18n/locale-provider";
import { localeCatalog } from "../../../lib/story-catalog";
import { ThemeSelector } from "./theme-selector";
import { deriveAgeBand, type AgeBand } from "../client/age-band";
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
  /** Reuse the last in-session age so the slider isn't reset after 'nova
   *  história' (generate-another uses lastPreferences directly). */
  defaultAge?: number;
  /**
   * Invoked with the anonymized request (ageBand/locale/theme/sceneCount — the
   * exact payload) plus the exact age kept in memory only for session reuse
   * (T050). The age is never part of the payload sent to the API.
   */
  onSubmit: (request: GenerateStoryRequest, age: number) => Promise<SubmitResult>;
  onSuccess?: () => void;
}

export function StoryRequestForm({
  defaultTheme = "courage",
  defaultSceneCount = MIN_SCENES,
  defaultAge,
  onSubmit,
  onSuccess,
}: StoryRequestFormProps) {
  const t = useTranslations("story");
  const { locale: appLocale, setLocale: setAppLocale } = useLocaleContext();
  const ageInputRef = useRef<HTMLInputElement>(null);
  const submitErrorRef = useRef<HTMLDivElement>(null);
  const initialAge = defaultAge ?? 5;
  const [age, setAge] = useState<number>(initialAge);
  const [locale, setLocale] = useState<Locale>(appLocale);
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [sceneCount, setSceneCount] = useState<number>(defaultSceneCount);
  const [status, setStatus] = useState<StoryRequestStatus>("idle");
  const [ageError, setAgeError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitting = status === "submitting";
  const disabled = submitting;

  // WCAG 3.3.1 / G194: after a failed generation, move keyboard focus to the
  // submit-error region so assistive tech lands on the failure message.
  useEffect(() => {
    if (submitError) submitErrorRef.current?.focus();
  }, [submitError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const numericAge = Number(age);
    if (!Number.isInteger(numericAge) || numericAge < MIN_AGE || numericAge > MAX_AGE) {
      setAgeError(t("form.age.errorRange"));
      ageInputRef.current?.focus();
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
      numericAge
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

      {/* Age — blossom-style range slider (exact age stays in memory only). */}
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

      <Select
        label={t("form.locale.label")}
        value={locale}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value as Locale;
          setLocale(next);
          // The story language drives the whole UI (ADR 0003 / T056).
          setAppLocale(next);
        }}
      >
        {localeCatalog.map((entry) => (
          <option key={entry.value} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </Select>

      {/* Scenes — blossom-style selectable cards (3/4/5). */}
      <fieldset
        disabled={disabled}
        className="rounded-3xl border border-border bg-card p-5 shadow-soft"
      >
        <legend className="px-1 font-display text-lg font-bold">{t("form.scenes.label")}</legend>
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
                className={`min-h-14 rounded-2xl border-2 font-display text-lg font-bold transition-all hover:-translate-y-0.5 ${
                  on
                    ? "border-primary bg-primary text-primary-foreground shadow-lift"
                    : "border-border bg-background text-text hover:border-primary/50"
                }`}
              >
                {count}
                <span className="ml-1 text-sm font-bold">{t("form.scenes.scene-unit")}</span>
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

      <Button type="submit" size="lg" loading={submitting}>
        <span aria-hidden="true">✨</span>
        {submitting ? t("form.submitting") : t("form.submit")}
      </Button>
    </form>
  );
}
