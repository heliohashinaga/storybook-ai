"use client";

import { useTranslations } from "next-intl";
import { Button } from "../../../components/ui/button";
import type { NarrationMode, NarrationStatus } from "../client/tts-state";

/**
 * Accessible AI narration control (spec 004, T015/T020/T029).
 *
 * Single toggle for "listen to this scene". Renders a localized label per
 * `status`, surfaces an accessible error via `aria-live` when AI narration
 * fails (US2), and exposes the active `mode` for stories/tests. The audio
 * itself is handled by the parent hook (`useAiReadAloud`).
 *
 * Accessibility (WCAG A/AA): native `<button>` for keyboard/focus, `aria-live`
 * for the busy/error announcements, `aria-pressed` for the toggle state, and
 * `prefers-reduced-motion` respected by never animating this control.
 */
export interface NarrationControlProps {
  /** Status of the narration state machine. */
  status: NarrationStatus;
  /** Active voice path (`ai` or `system`). */
  mode: NarrationMode;
  /** Localized error message (shown when `status === 'error'`). */
  errorMessage?: string;
  /** The single start/stop trigger. */
  onToggle: () => void;
}

const LABEL_BY_STATUS: Record<NarrationStatus, string> = {
  idle: "idle",
  busy: "busy",
  speaking: "reading",
  stopping: "stopping",
  error: "idle",
};

// The active "speaking" label depends on the voice path: AI audio reads the
// scene with the SSML voice, while the Web Speech fallback (system) reads it
// with the browser voice and exposes a plain "Stop reading" toggle.
const SPEAKING_LABEL_BY_MODE: Record<NarrationMode, string> = {
  ai: "reading",
  system: "stop",
};

const ACTIVE_STATUSES: ReadonlySet<NarrationStatus> = new Set(["busy", "speaking", "stopping"]);

export function NarrationControl({
  status,
  mode,
  errorMessage = "",
  onToggle,
}: NarrationControlProps) {
  const t = useTranslations("story.narration");

  const active = ACTIVE_STATUSES.has(status);
  const labelKey = status === "speaking" ? SPEAKING_LABEL_BY_MODE[mode] : LABEL_BY_STATUS[status];
  const buttonLabel = t(labelKey);

  return (
    <span
      aria-busy={active || undefined}
      role="group"
      aria-label={t("control")}
      className="flex flex-col items-center"
    >
      <Button
        variant="secondary"
        aria-pressed={active}
        aria-label={buttonLabel}
        title={buttonLabel}
        onClick={onToggle}
        className="min-h-12 min-w-12 justify-center! rounded-2xl! bg-secondary! text-secondary-foreground! hover:brightness-95!"
      >
        {status === "busy" ? (
          <SpinnerIcon className="size-5" />
        ) : active ? (
          <PauseIcon className="size-5" />
        ) : (
          <Volume2Icon className="size-5" />
        )}
      </Button>
      <span aria-live="polite" className="sr-only">
        {status === "speaking" || status === "busy" ? buttonLabel : ""}
      </span>
      {status === "error" && errorMessage ? (
        <span
          role="alert"
          aria-live="assertive"
          className="absolute top-full left-1/2 z-10 mt-1 -translate-x-1/2 whitespace-nowrap text-body text-danger"
        >
          {errorMessage}
        </span>
      ) : null}
    </span>
  );
}

/** Inline spinner shown while the audio is being synthesized (`busy`).
 * Animates only when the user has not requested reduced motion. */
function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={`motion-safe:animate-spin ${className ?? ""}`}
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.2-8.56" />
    </svg>
  );
}

/** Inline Pause icon shown while narration is playing (lucide-style). */
function PauseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

/** Inline Volume2 (speaker with sound waves) icon (lucide-style). */
function Volume2Icon({ className }: { className?: string }) {
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
      <path d="M11 4.7 6.6 9H3v6h3.6L11 19.3a1.5 1.5 0 0 0 2.6-1V5.7a1.5 1.5 0 0 0-2.6-1Z" />
      <path d="M15 9.3a4 4 0 0 1 0 5.4" />
      <path d="M18.3 6a8 8 0 0 1 0 12" />
    </svg>
  );
}
