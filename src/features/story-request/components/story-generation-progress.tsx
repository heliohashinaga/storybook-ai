"use client";

import { useTranslations } from "next-intl";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";

/**
 * Localized generation status — blossom-design step loading screen (§7.3).
 *
 * Rendered as a full-screen centered card while `POST /api/stories` runs. It
 * shows a spinner, an adaptive title, a 3-stage progress bar
 * (width = ((stage + 1) / 3) * 100), three step badges (✓ / number) and a lock
 * notice. Status advances from "writing/illustrating" to "safety review" to a
 * patient timeout cue, all driven by the injected `elapsedSeconds` so behavior
 * is deterministic in tests (no wall-clock or timer dependence). Nothing here
 * receives or renders request/story content.
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

/** Pure stage mapping: elapsed seconds → stage index (0 writing, 1 illustrating, 2 reviewing). */
export function getGenerationStage(elapsedSeconds: number): 0 | 1 | 2 {
  if (elapsedSeconds >= REVIEWING_AT_SECONDS) return 2;
  if (elapsedSeconds >= ILLUSTRATING_AT_SECONDS) return 1;
  return 0;
}

/** §7.3 bar width formula for a given stage index. */
export function stageProgressPercent(stage: number): number {
  return ((stage + 1) / 3) * 100;
}

const STAGES = ["stageWriting", "stageIllustrating", "stageReviewing"] as const;

/** Resolve the adaptive title for a given stage index. */
function stageMessage(t: (key: string) => string, stage: 0 | 1 | 2): string {
  if (stage === 0) return t("generating");
  if (stage === 1) return t("illustrating");
  return t("reviewing");
}

/** Loader2 spinner path (lucide-style) — decorative, no icon library needed. */
function LoaderSpinner() {
  return (
    <svg
      aria-hidden="true"
      className="size-10 animate-spin text-primary motion-reduce:animate-none"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
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
  const isSafetyRetry = phase === "safety-retry";
  const stage = getGenerationStage(elapsedSeconds);

  const message = isSafetyRetry
    ? t("safetyRetry")
    : isTimeout
      ? t("timeout")
      : stageMessage(t, stage);

  const percent = stageProgressPercent(stage);

  return (
    <section
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center p-4"
    >
      <div className="w-full max-w-3xl rounded-4xl border border-border bg-card p-8 text-center shadow-lift">
        <div
          aria-hidden="true"
          className="mx-auto flex size-24 items-center justify-center rounded-full bg-secondary"
        >
          <LoaderSpinner />
        </div>

        <h2 className="mt-5 text-2xl font-bold">{message}</h2>
        {isTimeout ? null : <p className="mt-1 text-sm text-muted-foreground">{t("hint")}</p>}

        <div
          role="progressbar"
          aria-busy="true"
          aria-label={message}
          aria-valuemin={0}
          aria-valuemax={2}
          aria-valuenow={stage}
          aria-valuetext={message}
          className="mt-6 h-3 overflow-hidden rounded-full bg-secondary"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-slow"
            style={{ width: `${percent}%` }}
          />
        </div>

        <ol className="mt-4 flex items-center justify-center gap-3">
          {STAGES.map((stageKey, index) => {
            const isDone = index < stage;
            const isCurrent = index === stage;
            return (
              <li
                key={stageKey}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={t(stageKey)}
                className="flex items-center gap-2"
              >
                <span
                  className={[
                    "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                    isDone
                      ? "bg-accent text-accent-foreground"
                      : isCurrent
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground",
                  ].join(" ")}
                >
                  {isDone ? "✓" : index + 1}
                </span>
              </li>
            );
          })}
        </ol>

        <p className="mt-6 rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground">
          {t("lockNotice")}
        </p>
      </div>
    </section>
  );
}
