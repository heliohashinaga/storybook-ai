"use client";

import { useTranslations } from "next-intl";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Progress } from "../../../components/ui/progress";

/**
 * Localized generation status (T032).
 *
 * Shows the anonymous generation progress while `POST /api/stories` runs, and
 * the localized failure + retry affordance when the provider errors. The
 * progress copy advances from "writing/illustrating" to "safety review" and
 * finally to a patient timeout cue — all driven by the injected
 * `elapsedSeconds` so behavior is deterministic in tests (no wall-clock or
 * timer dependence). Nothing here receives or renders request/story content.
 */

export const ILLUSTRATING_AT_SECONDS = 8;
export const REVIEWING_AT_SECONDS = 16;
export const TIMEOUT_CUE_AT_SECONDS = 30;

export type StoryGenerationProgressPhase =
  "generating" | "timeout" | "safety-retry" | "provider-failure";

export interface StoryGenerationProgressProps {
  /** Which status message family to show (default "generating"). */
  phase?: StoryGenerationProgressPhase;
  /** Seconds elapsed since the request started — injected for determinism. */
  elapsedSeconds?: number;
  /** Retry action for the provider-failure state (rendered only when set). */
  onRetry?: () => void;
}

export function StoryGenerationProgress({
  phase = "generating",
  elapsedSeconds = 0,
  onRetry,
}: StoryGenerationProgressProps) {
  const t = useTranslations("story.progress");

  if (phase === "provider-failure") {
    return (
      <Alert variant="danger">
        <p className="text-text">{t("providerFailure")}</p>
        {onRetry ? (
          <Button variant="secondary" onClick={onRetry} className="mt-sm">
            {t("retry")}
          </Button>
        ) : null}
      </Alert>
    );
  }

  const isTimeout = phase === "timeout" || elapsedSeconds >= TIMEOUT_CUE_AT_SECONDS;
  const message =
    phase === "safety-retry"
      ? t("safetyRetry")
      : isTimeout
        ? t("timeout")
        : elapsedSeconds >= REVIEWING_AT_SECONDS
          ? t("reviewing")
          : elapsedSeconds >= ILLUSTRATING_AT_SECONDS
            ? t("illustrating")
            : t("generating");

  return (
    <div className="flex flex-col gap-sm rounded-2xl border border-border bg-card p-lg shadow-soft">
      <Progress label={message} busy>
        {message}
      </Progress>
      <p className="text-caption text-text-subtle leading-caption">
        {isTimeout ? t("stillWorkingHint") : t("activeHint")}
      </p>
    </div>
  );
}
