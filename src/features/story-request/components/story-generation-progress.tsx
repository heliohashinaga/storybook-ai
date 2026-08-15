"use client";

import { useTranslations } from "next-intl";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";

/**
 * Localized generation status — blossom-design step loading screen (§7.3).
 *
 * Rendered as a full-screen centered card while `POST /api/stories` runs. It
 * shows a spinner, an adaptive title, a progress bar, step badges (✓ / number)
 * and a lock notice. The pipeline is **data-driven**: every step lives in
 * {@link GENERATION_STAGES} and each one occupies an **equal** slice of the
 * timeline (`STEP_DURATION_SECONDS` each), so adding a new step is a single
 * array entry plus its localized label — the stage mapping, bar width, ARIA
 * value range and adaptive title all re-derive automatically. Status advances
 * from "writing" to "illustrating" to "safety review" to a patient timeout cue,
 * all driven by the injected `elapsedSeconds` so behavior is deterministic in
 * tests (no wall-clock or timer dependence). Nothing here receives or renders
 * request/story content.
 */

/**
 * The generation pipeline steps, in order. Adding a step = add its i18n key
 * (`story.progress.stageXxx` in both locale catalogs) plus one entry here.
 */
export const GENERATION_STAGES = ["stageWriting", "stageIllustrating", "stageReviewing"] as const;

/** Stage index of the last step — used as the ARIA max and clamp boundary. */
export const MAX_STAGE = GENERATION_STAGES.length - 1;

/**
 * Equal length of every pipeline step, in seconds. Keeping stage boundaries
 * evenly spaced means a new step can be slotted in without re-tuning any
 * threshold: step `i` simply begins at `i * STEP_DURATION_SECONDS`, so the
 * last step starts at `MAX_STAGE * STEP_DURATION_SECONDS` (here 2×8 = 16 s,
 * matching the legacy reviewing threshold for three steps).
 */
export const STEP_DURATION_SECONDS = 8;

/** No-progress grace period after the full pipeline before the timeout cue. */
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
  /**
   * Override the equal, per-step duration (default `STEP_DURATION_SECONDS`).
   * Squeezing every step to speed up the whole pipeline while keeping them
   * evenly spaced (e.g. `3` in fake mode so the three steps complete fast).
   */
  stepDurationSeconds?: number;
}

/**
 * Pure stage mapping: elapsed seconds → stage index, with **equal-width**
 * steps. Stage `i` spans `[i * stepDuration, (i+1) * stepDuration)` and the
 * result clamps to the final stage. `stepDurationSeconds` defaults to
 * `STEP_DURATION_SECONDS` and `stageCount` to `GENERATION_STAGES.length`, so
 * the legacy three-stage timings (0 → writing, 8 → illustrating, 16 →
 * reviewing) are preserved out of the box.
 */
export function getGenerationStage(
  elapsedSeconds: number,
  stepDuration = STEP_DURATION_SECONDS,
  stageCount = GENERATION_STAGES.length
): number {
  const maxStage = stageCount - 1;
  return Math.min(maxStage, Math.max(0, Math.floor(elapsedSeconds / stepDuration)));
}

/**
 * Bar width tied to the current step, generalised over `stageCount` steps:
 * step `i` shows `(i / stageCount) * 100`% (0%, 33%, 66% … with three steps)
 * and 100% once concluded. The `done` flag raises the bar to 100% so the
 * final step is reached just short of the bar's end and only completion fills
 * it. `done` is the optional third arg to stay source-compatible with tests/
 * stories that call `barPercent(stage, done)`.
 */
export function barPercent(stage: number, stageCountOrDone?: number | boolean): number;
export function barPercent(
  stage: number,
  stageCountOrDone: number | boolean = GENERATION_STAGES.length,
  done = false
): number {
  if (typeof stageCountOrDone === "boolean") {
    done = stageCountOrDone;
    stageCountOrDone = GENERATION_STAGES.length;
  }
  if (done) return 100;
  return Math.floor((stage / stageCountOrDone) * 100);
}

/** Resolve the adaptive title for a given stage index (matches the step text). */
function stageMessage(t: (key: string) => string, stage: number): string {
  return t(GENERATION_STAGES[stage] ?? GENERATION_STAGES[0]!);
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
  stepDurationSeconds = STEP_DURATION_SECONDS,
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
  const stage = getGenerationStage(elapsedSeconds, stepDurationSeconds);

  const message = isSafetyRetry
    ? t("safetyRetry")
    : isTimeout
      ? t("timeout")
      : stageMessage(t, stage);

  const percent = barPercent(stage);

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

        <div
          role="progressbar"
          aria-busy="true"
          aria-label={message}
          aria-valuemin={0}
          aria-valuemax={MAX_STAGE}
          aria-valuenow={stage}
          aria-valuetext={message}
          className="mt-6 h-3 overflow-hidden rounded-full bg-secondary"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-slow"
            style={{ width: `${percent}%` }}
          />
        </div>

        <ol className="mt-4 flex flex-col items-start gap-3">
          {GENERATION_STAGES.map((stageKey, index) => {
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
                  aria-hidden="true"
                  className={[
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    isDone
                      ? "bg-accent text-accent-foreground"
                      : isCurrent
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground",
                  ].join(" ")}
                >
                  {isDone ? "✓" : index + 1}
                </span>
                <span
                  className={[
                    "font-display text-sm",
                    isCurrent ? "font-bold text-text" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {t(stageKey)}
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
