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
export function StoryRequestApp({ isFake }: { isFake?: boolean }) {
  const pathname = usePathname();
  const mode = deriveScreenFromPath(pathname);
  // Route-aware fake flag: the demo mounts at `/demo`/`/demo/reader`, the
  // authenticated playground at `/form`/`/reader`. Deriving `isFake` from the
  // mount path (not `STORIES_TEST_MODE`) keeps an authed playground session
  // from being routed to the cookie-less demo reader just because the server
  // runs in fake-provider mode locally. An explicit prop still overrides
  // (Storybook stories force the demo).
  const fake = isFake !== undefined ? isFake : pathname.startsWith("/demo");
  return mode === "reader" ? <ReaderScreen isFake={fake} /> : <FormScreen isFake={fake} />;
}

/** The `/form` screen: anonymous request form + inline generation progress. */
function FormScreen({ isFake }: { isFake: boolean }) {
  const t = useTranslations("story");
  const router = useRouter();
  const { status, begin, succeed, fail, lastPreferences } = useStorySession();
  const [lastError, setLastError] = useState<string | null>(null);

  const submitting = status === "submitting";
  const [elapsed, setElapsed] = useState(0);

  // spec 015: the anonymous demo mounts the same app at /demo (/demo/reader),
  // while the authenticated playground uses /form (/reader). The generation
  // target must follow the mount path, or an anonymous journey would land on
  // the session-gated /reader and bounce back to the login gate.
  const readerPath = isFake ? "/demo/reader" : "/reader";

  // Tick the elapsed clock that drives the localized progress copy while an
  // anonymous request is in flight. Cleared once submission ends.
  useEffect(() => {
    if (!submitting) return;
    // In fake mode, we want the progress to move at a pace that matches the backend
    // The fakeStepDelaySeconds() function returns the duration of each step in seconds
    const intervalMs = isFake ? 250 : 1000; // Update more frequently in fake mode for smoother animation
    const incrementAmount = isFake ? 0.25 : 1; // Increment by smaller amounts in fake mode
    const id = setInterval(() => setElapsed((seconds) => seconds + incrementAmount), intervalMs);
    return () => clearInterval(id);
  }, [submitting, isFake]);

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
      router.replace(readerPath);
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
        stepDurationSeconds={isFake ? 1 : undefined}
      />
    );
  }

  return (
    <section className="flex flex-col gap-md">
      <div className="mt-lg text-center">
        <h1 className="font-title mx-auto w-full max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
          {t("form.title")}
        </h1>
        <p className="mx-auto mt-3 max-w-3xl text-muted-foreground">{t("form.subtitle")}</p>
      </div>
      <div className="mx-auto w-full max-w-md px-4 sm:px-6 lg:max-w-2xl lg:px-12">
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
function ReaderScreen({ isFake }: { isFake: boolean }) {
  const router = useRouter();
  const { story, stories, activeId, accessStory, hasSession } = useStorySession();

  // spec 015: mirror the mount path ("/demo" vs "/form") so the anonymous demo
  // stays on /demo(/reader) and only the playground touches the session gate.
  const formPath = isFake ? "/demo" : "/form";

  // Session gate: `/reader` without a session (deep-link / reload) redirects
  // to the clean `/form`. Check after mount so the initial render has a stable
  // snapshot of the in-memory session, then redirect once.
  useEffect(() => {
    if (!hasSession()) {
      router.replace(formPath);
    }
  }, [hasSession, router, formPath]);

  // Spec 009 / Clarifications Q4: on `<h1>`/heading of the `/reader` screen
  // gets focus when it mounts. `StoryReader` already moves focus to the story's
  // main scene heading on first render, so no additional focus move is needed
  // here beyond landing on the reader with that focus in place.

  const onNewStory = useCallback(() => {
    // "New story": go to the clean form via the app's internal navigation
    // (the browser history does not carry a stale form; see Clarifications Q3).
    // The target follows the mount path (demo vs playground).
    router.replace(formPath);
  }, [router, formPath]);

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
