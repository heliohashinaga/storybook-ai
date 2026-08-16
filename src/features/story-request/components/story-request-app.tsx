"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { parseStoryResponse } from "../../story-reader/client/story-response";
import { StoryHistory } from "../../story-reader/components/story-history";
import { StoryReader } from "../../story-reader/components/story-reader";
import { useStorySession } from "../client/story-session-context";
import { deriveScreenFromPath } from "../client/route-mapping";
import { StoryGenerationProgress } from "./story-generation-progress";
import {
  StoryRequestForm,
  type GenerateStoryRequest,
  type SubmitResult,
} from "./story-request-form";

/**
 * Request → story container (T033) generalized to route-aware screens (Spec 009).
 * The anonymous app now has two navigable routes, `/form` and `/reader`; both
 * mount this same client wrapper. The screen mode is derived from the URL path
 * (`usePathname()` is the single source of truth; never a `mode` prop). The
 * in-memory session lives in the root layout's `StorySessionProvider`, shared
 * across routes. Only `ageBand`/`locale`/`theme`/`sceneCount` are ever submitted;
 * the approved 3–5 scene story stays locally in memory (never persisted).
 */
export function StoryRequestApp({ isFake = false }: { isFake?: boolean }) {
  const pathname = usePathname();
  const mode = deriveScreenFromPath(pathname);
  return mode === "reader" ? <ReaderScreen isFake={isFake} /> : <FormScreen isFake={isFake} />;
}

/** The `/form` screen: anonymous request form + inline generation progress. */
function FormScreen({ isFake }: { isFake: boolean }) {
  const t = useTranslations("story");
  const router = useRouter();
  const { status, begin, succeed, fail, lastPreferences } = useStorySession();
  const [lastError, setLastError] = useState<string | null>(null);

  const submitting = status === "submitting";
  const [elapsed, setElapsed] = useState(0);

  // Tick the elapsed clock that drives the localized progress copy while an
  // anonymous request is in flight. Cleared once submission ends.
  useEffect(() => {
    if (!submitting) return;
    const id = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(id);
  }, [submitting]);

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
      // payload) for session reuse, append the story, then move to the reader
      // via `replace` so a single browser "back" leaves the app rather than
      // returning to a stale `/form` (Spec 009 / Clarifications Q3).
      succeed(result.story, {
        age: age ?? 0,
        locale: request.locale,
        theme: request.theme,
        sceneCount: request.sceneCount,
      });
      router.replace("/reader");
      return { ok: true };
    }
    fail(result.error);
    const key = result.error.messageKey.replace(/^story\.error\./, "");
    setLastError(key);
    return { ok: false, messageKey: key };
  }

  // The generation progress panel is ephemeral; it renders inside `/form`
  // without changing the route (no `/steps`), per Spec 009. On success/fallback
  // the form mounts fresh, so the localized retry error shows against the idle
  // form.
  if (submitting) {
    return (
      <StoryGenerationProgress
        elapsedSeconds={elapsed}
        stepDurationSeconds={isFake ? 3 : undefined}
      />
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
        {/* `/form` is always a clean draft: a fresh, unfilled form, no history
            tab. Session prefs are reused for default values, not drafts. */}
        <StoryRequestForm
          key="fresh"
          onSubmit={handleSubmit}
          defaultAge={lastPreferences?.age}
          defaultSceneCount={lastPreferences?.sceneCount}
          initialError={lastError ?? undefined}
        />
      </div>
    </section>
  );
}

/** The `/reader` screen: the active story + in-session history switcher. */
function ReaderScreen({ isFake: _isFake }: { isFake: boolean }) {
  const router = useRouter();
  const { story, stories, activeId, accessStory, hasSession } = useStorySession();

  // Session gate: `/reader` without a session (deep-link / reload) redirects
  // to the clean `/form`. Check after mount so the initial render has a stable
  // snapshot of the in-memory session, then redirect once.
  useEffect(() => {
    if (!hasSession()) {
      router.replace("/form");
    }
  }, [hasSession, router]);

  // Spec 009 / Clarifications Q4: on `<h1>`/heading of the `/reader` screen
  // gets focus when it mounts. `StoryReader` already moves focus to the story's
  // main scene heading on first render, so no additional focus move is needed
  // here beyond landing on the reader with that focus in place.

  const onNewStory = useCallback(() => {
    // "New story": go to the clean `/form` via the app's internal navigation
    // (the browser history does not carry a stale `/form`; see Clarifications Q3).
    router.replace("/form");
  }, [router]);

  if (!story) {
    // No story (still hydrating / redirecting): render an empty live region so
    // assistive tech is not left on a blank page during the gate.
    return <section aria-live="polite" aria-busy="true" />;
  }

  // Keep the reader/history grid inside the same horizontal container as the
  // header (`max-w-7xl` + responsive padding) so the story card and history
  // panel never extend past the logo / theme-toggle alignment on wide screens.
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-12">
      <div className="grid gap-lg lg:grid-cols-[minmax(0,1fr)_18rem]">
        <StoryReader story={story} onNewStory={onNewStory} />
        <aside className="flex h-full flex-col gap-sm">
          <StoryHistory storyEntries={stories} activeId={activeId} onSelect={accessStory} />
        </aside>
      </div>
    </div>
  );
}
