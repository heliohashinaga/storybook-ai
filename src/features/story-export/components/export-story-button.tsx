"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "../../../components/ui/button";
import type { GeneratedStory } from "../../story-generation/server/schemas";
import { buildStoryPdf } from "../client/build-story-pdf";

type ExportStatus = "idle" | "exporting" | "success" | "error";

/**
 * Export-to-PDF icon button with clear feedback states (spec 003, US4).
 *
 * Renders as a compact icon-only trigger (consistent on mobile and desktop)
 * that downloads the story as a PDF entirely client-side. The export runs
 * through `idle → exporting → success | error` with:
 *  - `idle` — a plain download glyph;
 *  - `exporting` — an inline spinner (delegated to `Button`'s `loading`), the
 *    trigger is disabled and `aria-busy` so the action can't be re-triggered;
 *  - `success` — announced to assistive tech via `aria-live="polite"` (the
 *    trigger label doesn't change, keeping the layout stable);
 *  - `error` — a localized message rendered below the trigger (`role="alert"`);
 *    retry is done by clicking the trigger itself again.
 *
 * The trigger keeps a **static accessible label** ("Download PDF") so the
 * button never jumps or re-labels mid-flow; state is communicated by the
 * spinner, the busy state and the `aria-live`/`alert` regions.
 *
 * Download is purely client-side (dynamic import of @react-pdf/renderer);
 * nothing is sent over the network or persisted.
 */
export function ExportStoryButton({ story }: { story: GeneratedStory }) {
  const t = useTranslations("story.reader");

  const [status, setStatus] = useState<ExportStatus>("idle");

  const exporting = status === "exporting";
  const success = status === "success";
  const error = status === "error";

  const handleExport = async () => {
    // Reset any previous error/success so the button is always re-runnable.
    setStatus("exporting");
    try {
      await buildStoryPdf(story, { download: browserDownload });
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  const label = t("exportPdf");

  return (
    <span className="flex flex-col items-end gap-xs" aria-busy={exporting || undefined}>
      <Button
        variant="secondary"
        onClick={handleExport}
        disabled={exporting}
        aria-label={label}
        aria-busy={exporting || undefined}
        className="size-12 justify-center! rounded-2xl! bg-secondary! p-0! text-secondary-foreground! hover:brightness-95!"
      >
        {exporting ? <SpinnerIcon className="size-5" /> : <DownloadIcon className="size-5" />}
      </Button>
      {/* Success is announced to screen readers; the trigger label is static. */}
      {success ? (
        <span role="status" aria-live="polite" className="sr-only">
          {t("exportSuccess")}
        </span>
      ) : null}
      {
        /* Error feedback only — retry is done by clicking the download trigger
           itself (the same action that started it), so there's no separate
           retry link to keep it a single predictable control. */
        error ? (
          <span role="alert" aria-live="assertive" className="text-right text-body text-danger">
            {t("exportError")}
          </span>
        ) : null
      }
    </span>
  );
}

/** Inline spinner (ring arc) shown while exporting — matches NarrationControl's
 *  spinner so the reader controls feel consistent. */
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

/** Inline Download (arrow into a tray) icon — lucide-style. */
function DownloadIcon({ className }: { className?: string }) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}

/**
 * Browser downloader: converts the PDF blob to an object URL and clicks an
 * anchor. Purely client-side — nothing touches the network.
 */
function browserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
