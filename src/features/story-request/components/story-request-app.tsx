"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "../../../components/ui/button";
import { ExportStoryButton } from "../../story-export/components/export-story-button";
import { parseStoryResponse } from "../../story-reader/client/story-response";
import { StoryReader } from "../../story-reader/components/story-reader";
import { StorySessionProvider, useStorySession } from "../client/story-session-context";
import { StoryGenerationProgress } from "./story-generation-progress";
import {
  StoryRequestForm,
  type GenerateStoryRequest,
  type SubmitResult,
} from "./story-request-form";

/**
 * Request → story container (T033). Hosts the anonymous request form and the
 * first approved-story state. Submits only `ageBand`/`locale`/`theme`, parses
 * the response through `story-response` (typed, sanitized), and shows the
 * approved three-scene story locally in memory (never persisted).
 */
export function StoryRequestApp() {
  return (
    <StorySessionProvider>
      <StoryRequestFlow />
    </StorySessionProvider>
  );
}

function StoryRequestFlow() {
  const t = useTranslations("story");
  const { status, story, begin, succeed, fail, reset } = useStorySession();
  const [elapsed, setElapsed] = useState(0);

  const submitting = status === "submitting";

  // While the anonymous request is in flight, tick the elapsed clock that
  // drives the localized progress copy (writing → reviewing → timeout cue).
  useEffect(() => {
    if (!submitting) return;
    const id = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(id);
  }, [submitting]);

  if (submitting) {
    // Keep the request form mounted (internally disabled/announcing) so its
    // localized retry error still renders on failure; the progress panel sits
    // above it while the anonymous request is in flight.
    return (
      <section className="flex flex-col gap-md">
        <StoryGenerationProgress elapsedSeconds={elapsed} />
        <StoryRequestForm onSubmit={handleSubmit} />
      </section>
    );
  }

  async function handleSubmit(request: GenerateStoryRequest): Promise<SubmitResult> {
    setElapsed(0);
    begin();
    const response = await fetch("/api/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const result = await parseStoryResponse(response);
    if (result.status === "success") {
      succeed(result.story);
      return { ok: true };
    }
    fail(result.error);
    return { ok: false, messageKey: result.error.messageKey.replace(/^story\.error\./, "") };
  }

  if (story) {
    return (
      <section className="flex flex-col gap-md">
        <StoryReader story={story} />
        <div className="flex flex-row items-center gap-sm">
          <ExportStoryButton story={story} />
          <Button variant="secondary" onClick={reset}>
            {t("reader.newStory")}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-md">
      <h1 className="font-title text-title">{t("form.title")}</h1>
      <StoryRequestForm onSubmit={handleSubmit} />
    </section>
  );
}
