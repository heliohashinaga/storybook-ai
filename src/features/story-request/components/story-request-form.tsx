"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Select } from "../../../components/ui/select";
import { useLocaleContext } from "../../../i18n/locale-provider";
import { localeCatalog, themeCatalog } from "../../../lib/story-catalog";
import { deriveAgeBand, type AgeBand } from "../client/age-band";
import type { Locale, Theme } from "../client/story-preferences-schema";

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
}

export type SubmitResult = { ok: true } | { ok: false; messageKey: string };

export type StoryRequestStatus = "idle" | "submitting" | "success";

interface StoryRequestFormProps {
  defaultTheme?: Theme;
  /**
   * Invoked with the anonymized request (ageBand/locale/theme — the exact
   * payload) plus the exact age kept in memory only for session reuse
   * (T050). The age is never part of the payload sent to the API.
   */
  onSubmit: (request: GenerateStoryRequest, age: number) => Promise<SubmitResult>;
  onSuccess?: () => void;
}

export function StoryRequestForm({
  defaultTheme = "courage",
  onSubmit,
  onSuccess,
}: StoryRequestFormProps) {
  const t = useTranslations("story");
  const { locale: appLocale, setLocale: setAppLocale } = useLocaleContext();
  const ageInputRef = useRef<HTMLInputElement>(null);
  const submitErrorRef = useRef<HTMLDivElement>(null);
  const [age, setAge] = useState("");
  const [locale, setLocale] = useState<Locale>(appLocale);
  const [theme, setTheme] = useState<Theme>(defaultTheme);
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
    if (!Number.isInteger(numericAge) || numericAge < 2 || numericAge > 12) {
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
    <form onSubmit={handleSubmit} noValidate aria-busy={submitting || undefined}>
      <div className="flex flex-col gap-xs">
        <label htmlFor="story-request-age" className="text-body font-title">
          {t("form.age.label")}
        </label>
        <input
          id="story-request-age"
          ref={ageInputRef}
          type="number"
          min="2"
          max="12"
          inputMode="numeric"
          className="w-full rounded-md border border-disabled bg-surface px-md py-sm text-body text-text shadow-sm disabled:bg-disabled disabled:text-text-subtle"
          value={age}
          disabled={disabled}
          placeholder={t("form.age.placeholder")}
          aria-invalid={ageError ? true : undefined}
          aria-describedby={ageError ? "story-request-age-error" : undefined}
          onChange={(event) => {
            setAge(event.target.value);
            if (ageError) setAgeError(null);
          }}
        />
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

      <Select
        label={t("form.theme.label")}
        value={theme}
        disabled={disabled}
        onChange={(event) => setTheme(event.target.value as Theme)}
      >
        {themeCatalog.map((entry) => (
          <option key={entry.value} value={entry.value}>
            {t(`catalog.theme.${entry.value}`)}
          </option>
        ))}
      </Select>

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

      <Button type="submit" loading={submitting}>
        {submitting ? t("form.submitting") : t("form.submit")}
      </Button>
    </form>
  );
}
