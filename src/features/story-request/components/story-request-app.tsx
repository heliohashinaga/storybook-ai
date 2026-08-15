"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { parseStoryResponse } from "../../story-reader/client/story-response";
import { StoryHistory } from "../../story-reader/components/story-history";
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
  const { status, story, stories, activeId, begin, succeed, fail, accessStory, lastPreferences } =
    useStorySession();
  const [elapsed, setElapsed] = useState(0);
  // Localized retry `messageKey` kept across the form's unmount/remount while
  // the request panel was showing, so the freshly-mounting idle form can
  // display the failure (the form's own state is lost on unmount).
  const [lastError, setLastError] = useState<string | null>(null);
  // "Nova história": show a fresh, unfilled form while preserving the
  // in-session history, so the previous stories stay in the switcher and the
  // next generated one is appended rather than replacing them.
  const [draftingNew, setDraftingNew] = useState(false);

  const submitting = status === "submitting";

  // While the anonymous request is in flight, tick the elapsed clock that
  // drives the localized progress copy (writing → reviewing → timeout cue).
  useEffect(() => {
    if (!submitting) return;
    const id = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(id);
  }, [submitting]);

  if (submitting) {
    // Show only the loading panel (blossom-style) while the anonymous request
    // is in flight. The form mounts fresh on success/fallback, so the localized
    // retry error renders against the idle form instead.
    return <StoryGenerationProgress elapsedSeconds={elapsed} />;
  }

  async function handleSubmit(request: GenerateStoryRequest, age?: number): Promise<SubmitResult> {
    setElapsed(0);
    setLastError(null);
    begin();
    const response = await fetch("/api/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const result = await parseStoryResponse(response);
    if (result.status === "success") {
      // Store anonymized prefs (exact age stays in memory only, never in the
      // payload) for session reuse. A new draft is no longer pending once the
      // story is generated, so the reader shows again with the appended list.
      succeed(result.story, {
        age: age ?? 0,
        locale: request.locale,
        theme: request.theme,
        sceneCount: request.sceneCount,
      });
      setDraftingNew(false);
      return { ok: true };
    }
    fail(result.error);
    const key = result.error.messageKey.replace(/^story\.error\./, "");
    setLastError(key);
    // A failed fresh-draft submit returns to the form with the error; the
    // reader stays hidden while planning a new story.
    setDraftingNew(true);
    return { ok: false, messageKey: key };
  }

  /** "Nova história": leave the reader and show an unfilled form, keeping the
   *  prior stories in the session so they persist in the switcher. */
  const startNewStory = () => {
    setDraftingNew(true);
    setLastError(null);
  };

  if (story && !draftingNew) {
    return (
      <div className="grid gap-lg lg:grid-cols-[minmax(0,1fr)_18rem]">
        <StoryReader story={story} onNewStory={startNewStory} />
        <aside className="flex h-full flex-col gap-sm">
          <StoryHistory storyEntries={stories} activeId={activeId} onSelect={accessStory} />
        </aside>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-md">
      <div className="text-center">
        <h1 className="font-title mx-auto w-full max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
          {t("form.title")}
        </h1>
        <p className="mx-auto mt-3 max-w-3xl text-muted-foreground">{t("form.subtitle")}</p>
      </div>
      <div className="mx-auto w-full max-w-md lg:max-w-2xl">
        <StoryRequestForm
          key={draftingNew ? "fresh" : "reuse"}
          onSubmit={handleSubmit}
          defaultAge={draftingNew ? undefined : lastPreferences?.age}
          defaultSceneCount={draftingNew ? undefined : lastPreferences?.sceneCount}
          initialError={lastError ?? undefined}
        />
      </div>
    </section>
  );
}
