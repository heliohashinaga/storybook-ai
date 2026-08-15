"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "../../../components/ui/button";
import type { GeneratedStory } from "../../story-generation/server/schemas";
import { ExportStoryButton } from "../../story-export/components/export-story-button";
import { useAiReadAloud } from "../../story-read-aloud/client/use-ai-read-aloud";
import { NarrationControl } from "../../story-read-aloud/components/narration-control";
import { SceneProgress } from "./scene-progress";
import { SceneView } from "./scene-view";

/**
 * Scene-by-scene reader (T040, extended by spec 004) — blossom layout (spec 007).
 *
 * Shows one scene at a time inside a single reading card: a full-bleed scene
 * illustration (with theme badge), a scene-progress row ("Cena X de Y" + dots),
 * the scene title and body, and a button row (previous / read aloud / next).
 * A footer bar hosts "New story" and the PDF export action.
 *
 * Navigation is ordered with next/previous; bounds are enforced (previous
 * disabled on the first scene, next on the last). Arrow keys navigate while
 * the scene content is focused; on change, programmatic focus moves to the new
 * scene heading. The reader keeps its position in-memory for the session;
 * nothing is persisted.
 *
 * Narration (spec 004): uses the AI narration hook, which extends the
 * progressive `useReadAloud` (Web Speech) pattern. When AI narration is enabled
 * server-side it plays transient AI audio; otherwise `/api/narrate` answers 204
 * and the hook delegates to Web Speech. A provider failure is surfaced as an
 * accessible error without falling back to Web Speech (US2).
 */
export function StoryReader({
  story,
  onNewStory,
}: {
  story: GeneratedStory;
  /** "New story" footer action; when omitted the footer button is hidden. */
  onNewStory?: () => void;
}) {
  const t = useTranslations("story.reader");
  const tn = useTranslations("story.narration");
  const scenes = story.scenes;
  const [currentIndex, setCurrentIndex] = useState(0);
  const regionRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  const total = scenes.length;
  const current = scenes[currentIndex];

  // Test-first: read-aloud (US2). Local, single start/stop control; speech is
  // cancelled whenever the scene text changes so two scenes never overlap.
  // Extends `useReadAloud` for AI narration (spec 004 US1-US3).
  const readerText = current ? `${current.title}. ${current.body}` : "";
  const readAloud = useAiReadAloud({
    text: readerText,
    locale: story.locale ?? "pt-BR",
    errorLabel: tn("error"),
  });

  function goTo(index: number) {
    // Stop any in-progress narration (AI or system) before moving on.
    readAloud.stop();
    setCurrentIndex(Math.min(Math.max(index, 0), total - 1));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(currentIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(currentIndex - 1);
    }
  }

  // Move focus to the new scene heading on navigation, but never steal focus
  // on the initial render.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const heading = regionRef.current?.querySelector<HTMLElement>("[data-scene-heading]");
    heading?.focus();
  }, [currentIndex]);

  // The response schema guarantees at least MIN_SCENES scenes (up to MAX_SCENES);
  // this only runs while typing the byte-level contract.
  if (!current) return null;

  return (
    <section aria-label={t("title")} className="rounded-4xl shadow-lift">
      <article
        ref={regionRef}
        aria-label={t("sceneLabel", { ordinal: current.ordinal })}
        onKeyDown={handleKeyDown}
        className="overflow-hidden rounded-4xl border border-border bg-card shadow-lift"
      >
        <SceneView scene={current} />

        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-md">
            <p aria-live="polite" className="min-w-0 truncate text-sm font-bold text-text-subtle">
              {t("sceneCount", { current: currentIndex + 1, total })}
            </p>
            <div className="flex shrink-0" aria-hidden>
              <SceneProgress
                current={currentIndex + 1}
                total={total}
                label={t("sceneCount", { current: currentIndex + 1, total })}
              />
            </div>
          </div>

          <h1
            data-scene-heading
            id={`scene-heading-${current.ordinal}`}
            tabIndex={-1}
            className="mt-2 font-display text-display font-extrabold leading-display tracking-tight sm:text-3xl"
          >
            {current.title}
          </h1>

          <p className="mt-md text-body leading-relaxed text-foreground/90">{current.body}</p>

          <nav
            aria-label={t("navigationLabel")}
            className="mt-lg grid gap-sm sm:grid-cols-[auto_1fr_auto]"
          >
            <Button
              variant="secondary"
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
            >
              <ChevronLeftIcon className="size-5" />
              {t("previous")}
            </Button>

            {readAloud.supported && (
              <div className="sm:w-full">
                <NarrationControl
                  status={readAloud.status}
                  mode={readAloud.mode}
                  errorMessage={readAloud.errorMessage}
                  onToggle={readAloud.toggle}
                />
              </div>
            )}

            <Button
              variant="primary"
              onClick={() => goTo(currentIndex + 1)}
              disabled={currentIndex === total - 1}
            >
              {t("next")}
              <ChevronRightIcon className="size-5" />
            </Button>
          </nav>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-sm border-t border-border bg-secondary/60 px-lg py-md">
          {onNewStory ? (
            <button
              type="button"
              onClick={onNewStory}
              className="justify-self-start rounded-2xl px-sm py-xs text-sm font-bold text-text-subtle transition-colors hover:text-text"
            >
              ← {t("footerNewStory")}
            </button>
          ) : (
            <span />
          )}
          <ExportStoryButton story={story} />
        </div>
      </article>
    </section>
  );
}

/** Inline chevron-left icon (lucide-style). */
function ChevronLeftIcon({ className }: { className?: string }) {
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
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

/** Inline chevron-right icon (lucide-style). */
function ChevronRightIcon({ className }: { className?: string }) {
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
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
