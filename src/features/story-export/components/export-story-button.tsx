"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "../../../components/ui/button";
import type { GeneratedStory } from "../../story-generation/server/schemas";
import { buildStoryPdf } from "../client/build-story-pdf";

type ExportStatus = "idle" | "exporting" | "success" | "error";

/**
 * Export-to-PDF button with clear feedback states (spec 003, US4).
 *
 * Exposes `idle → exporting → success | error` with:
 *  - `aria-busy` on the region while generating,
 *  - an `aria-live="polite"` region announcing success/error,
 *  - a localized retry action after a failure (the export is re-runnable).
 * On success the "Download PDF" label returns with a transient success note.
 *
 * Download happens purely client-side (dynamic import of @react-pdf/renderer);
 * nothing is sent over the network or persisted.
 */
export function ExportStoryButton({ story }: { story: GeneratedStory }) {
  const t = useTranslations("story.reader");
  const [status, setStatus] = useState<ExportStatus>("idle");

  const exporting = status === "exporting";

  const handleExport = async () => {
    if (exporting) return;
    setStatus("exporting");
    try {
      await buildStoryPdf(story, { download: browserDownload });
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-xs" aria-busy={exporting} aria-live="polite">
      <Button
        variant={status === "error" ? "danger" : "secondary"}
        onClick={handleExport}
        disabled={exporting}
        className="gap-2!"
      >
        <DownloadIcon className="size-4" />
        {status === "success" ? t("exportSuccess") : exporting ? t("exporting") : t("exportPdf")}
      </Button>
      {status === "error" ? (
        <p className="text-caption text-error">
          {t("exportError")}{" "}
          <button
            type="button"
            className="text-text underline underline-offset-2 hover:text-accent"
            onClick={handleExport}
          >
            {t("retryExport")}
          </button>
        </p>
      ) : null}
    </div>
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
