"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "../../../components/ui/button";
import { ExportStoryButton } from "../../story-export/components/export-story-button";
import { parseStoryResponse } from "../../story-reader/client/story-response";
import { StoryHistory } from "../../story-reader/components/story-history";
import { StoryReader } from "../../story-reader/components/story-reader";
import { StorySessionProvider, useStorySession } from "../client/story-session-context";
import { deriveAgeBand } from "../client/age-band";
import { StoryGenerationProgress } from "./story-generation-progress";
import {
  StoryRequestForm,
  type GenerateStoryRequest,
  type SubmitResult,
} from "./story-request-form";

/**
 * Request → story container (T033). Hosts the anonymous request form and the
 * first approved-story state. Submits only `ageBand`/`locale`/`theme`/
 * `sceneCount`, parses the response through `story-response` (typed, sanitized),
 * and shows the approved 3–5 scene story locally in memory (never persisted).
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
  const {
    status,
    story,
    stories,
    activeId,
    begin,
    succeed,
    fail,
    reset,
    accessStory,
    lastPreferences,
  } = useStorySession();
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
        <StoryRequestForm
          onSubmit={handleSubmit}
          defaultAge={lastPreferences?.age}
          defaultSceneCount={lastPreferences?.sceneCount}
        />
      </section>
    );
  }

  async function handleSubmit(request: GenerateStoryRequest, age?: number): Promise<SubmitResult> {
    setElapsed(0);
    begin();
    const response = await fetch("/api/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const result = await parseStoryResponse(response);
    if (result.status === "success") {
      // Store anonymized prefs (exact age stays in memory only, never in the
      // payload) for "generate another" reuse (T050).
      succeed(result.story, {
        age: age ?? 0,
        locale: request.locale,
        theme: request.theme,
        sceneCount: request.sceneCount,
      });
      return { ok: true };
    }
    fail(result.error);
    return { ok: false, messageKey: result.error.messageKey.replace(/^story\.error\./, "") };
  }

  /** "Generate another": re-submits reusing the last age/locale/theme/count
   *  (T050). Appends a new story via succeed(); never replaces earlier ones. */
  const generateAnother = () => {
    if (!lastPreferences) return;
    const prefs = lastPreferences;
    void handleSubmit(
      {
        ageBand: deriveAgeBand(prefs.age),
        locale: prefs.locale,
        theme: prefs.theme,
        sceneCount: prefs.sceneCount,
      },
      prefs.age
    );
  };

  if (story) {
    return (
      <section className="flex flex-col gap-md">
        {stories.length > 1 ? (
          <StoryHistory storyEntries={stories} activeId={activeId} onSelect={accessStory} />
        ) : null}
        <StoryReader story={story} />
        <div className="flex flex-row items-center gap-sm">
          <ExportStoryButton story={story} />
          {lastPreferences ? (
            <Button variant="secondary" onClick={generateAnother}>
              {t("reader.generateAnother")}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={reset}>
            {t("reader.newStory")}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-md">
      <div className="text-center">
        <h1 className="font-title text-title text-4xl font-extrabold tracking-tight sm:text-5xl">
          {t("form.title")}
        </h1>
        <p className="mx-auto mt-3 max-w-3xl text-muted-foreground">{t("form.subtitle")}</p>
      </div>
      <StoryRequestForm
        onSubmit={handleSubmit}
        defaultAge={lastPreferences?.age}
        defaultSceneCount={lastPreferences?.sceneCount}
      />
    </section>
  );
}
