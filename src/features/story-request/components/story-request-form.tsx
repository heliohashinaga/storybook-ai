"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Select } from "../../../components/ui/select";
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
  defaultLocale?: Locale;
  defaultTheme?: Theme;
  onSubmit: (request: GenerateStoryRequest) => Promise<SubmitResult>;
  onSuccess?: () => void;
}

export function StoryRequestForm({
  defaultLocale = "pt-BR",
  defaultTheme = "courage",
  onSubmit,
  onSuccess,
}: StoryRequestFormProps) {
  const t = useTranslations("story");
  const [age, setAge] = useState("");
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [status, setStatus] = useState<StoryRequestStatus>("idle");
  const [ageError, setAgeError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitting = status === "submitting";
  const disabled = submitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const numericAge = Number(age);
    if (!Number.isInteger(numericAge) || numericAge < 2 || numericAge > 12) {
      setAgeError(t("form.age.errorRange"));
      return;
    }

    setAgeError(null);
    setSubmitError(null);
    setStatus("submitting");

    const result = await onSubmit({
      ageBand: deriveAgeBand(numericAge),
      locale,
      theme,
    });

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
          type="number"
          min="2"
          max="12"
          inputMode="numeric"
          className="w-full rounded-md border border-disabled bg-surface px-md py-sm text-body text-text shadow-sm disabled:bg-disabled disabled:text-text-subtle"
          value={age}
          disabled={disabled}
          placeholder={t("form.age.placeholder")}
          aria-invalid={ageError ? true : undefined}
          aria-describedby={ageError ? "story-request-age-error" : "story-request-age-hint"}
          onChange={(event) => {
            setAge(event.target.value);
            if (ageError) setAgeError(null);
          }}
        />
        <span id="story-request-age-hint" className="text-caption text-text-subtle">
          {t("form.age.hint")}
        </span>
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
        onChange={(event) => setLocale(event.target.value as Locale)}
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
            {entry.label}
          </option>
        ))}
      </Select>

      {submitError ? <Alert variant="danger">{submitError}</Alert> : null}

      <Button type="submit" loading={submitting}>
        {submitting ? t("form.submitting") : t("form.submit")}
      </Button>
    </form>
  );
}
