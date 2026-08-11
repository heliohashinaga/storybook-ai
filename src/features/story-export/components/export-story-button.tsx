"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "../../../components/ui/button";
import type { GeneratedStory } from "../../story-generation/server/schemas";
import { buildStoryPdf } from "../client/build-story-pdf";

/**
 * Export-to-PDF button (T043).
 *
 * On click it lazily loads the PDF builder (browser-only, dynamic import of
 * @react-pdf/renderer) and downloads the composed PDF. Downloads happen purely
 * client-side via an injected browser downloader; nothing is sent over the
 * network or persisted. The button disables while generating and shows a
 * localized error on failure.
 */
export function ExportStoryButton({ story }: { story: GeneratedStory }) {
  const t = useTranslations("story.reader");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setError(false);
    try {
      await buildStoryPdf(story, { download: browserDownload });
    } catch {
      setError(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-xs">
      <Button variant="secondary" onClick={handleExport} disabled={exporting}>
        {exporting ? t("exporting", {}) : t("exportPdf")}
      </Button>
      {error ? <p className="text-caption text-error">{t("exportError")}</p> : null}
    </div>
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
