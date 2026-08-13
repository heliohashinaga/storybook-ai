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

const ACTIVE_STATUSES: ReadonlySet<NarrationStatus> = new Set(["busy", "speaking", "stopping"]);

export function NarrationControl({ status, errorMessage = "", onToggle }: NarrationControlProps) {
  const t = useTranslations("story.narration");

  const active = ACTIVE_STATUSES.has(status);
  const labelKey = LABEL_BY_STATUS[status];
  const buttonLabel = t(labelKey);

  return (
    <div>
      <Button variant="secondary" aria-pressed={active} onClick={onToggle}>
        {buttonLabel}
      </Button>
      <span aria-live="polite" className="sr-only">
        {status === "speaking" || status === "busy" ? buttonLabel : ""}
      </span>
      {status === "error" && errorMessage ? (
        <span role="alert" aria-live="assertive" className="text-body text-danger">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
