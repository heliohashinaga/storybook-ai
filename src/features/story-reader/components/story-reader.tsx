"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "../../../components/ui/button";
import type { GeneratedStory } from "../../story-generation/server/schemas";
import { ExportStoryButton } from "../../story-export/components/export-story-button";
import { useAiReadAloud } from "../../story-read-aloud/client/use-ai-read-aloud";
import { NarrationControl } from "../../story-read-aloud/components/narration-control";
import { useSwipeEnabled } from "../client/use-swipe-enabled";
import { useSwipeToChangeScene } from "../client/use-swipe-to-change-scene";
import { SceneProgress } from "./scene-progress";
import { SceneView } from "./scene-view";

/**
 * Scene-by-scene reader (T040, extended by spec 004) — blossom layout (spec 007).
 *
 * Shows one scene at a time inside a single reading card: a persistent story
 * title cap (story title + localized theme badge) above a full-bleed scene
 * illustration, a scene-progress row ("Cena X de Y" + dots), the scene title
 * and body, and a button row (previous / read aloud / next). The story title
 * is the card's `h1`; the per-scene heading is an `h2` it moves focus to.
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
  const tc = useTranslations("story.catalog");
  const scenes = story.scenes;
  const [currentIndex, setCurrentIndex] = useState(0);
  const regionRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  // US4 — show more / show less: the scene body is clamped to ~6 lines on
  // desktop (sm+); a toggle button appears only when the body really overflows
  // (Q2=B). Mobile renders the full body. `expanded` resets per scene.
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const bodyId = useId();
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [bodyCanExpand, setBodyCanExpand] = useState(false);
  const desktopQuery = "(min-width: 640px)";

  // Reset the toggle when the scene changes (a new scene starts collapsed).
  // `goTo` is the single path for navigation (buttons + arrow keys), so the
  // reset lives there — avoids set-state-in-effect and ref-during-render lint
  // rules while keeping the first render of the new scene collapsed.

  // Measure real overflow on desktop: the clamp class (`sm:line-clamp-6`) is
  // applied whenever collapsed, so clientHeight is the clamped height and
  // scrollHeight the full content height; overflow means the toggle shows.
  // Re-measure on resize and breakpoint change so width changes re-evaluate.
  // The initial measure is deferred (rAF) so no setState runs synchronously
  // in the effect body; while expanded the toggle stays visible, so the
  // measurement is skipped and the last overflow result is kept.
  useEffect(() => {
    const media = window.matchMedia(desktopQuery);
    const measure = () => {
      const body = bodyRef.current;
      const isDesktop = media.matches;
      if (!body || !isDesktop) {
        setBodyCanExpand(false);
        return;
      }
      // While expanded the clamp is removed; keep the last overflow result so
      // the "Mostrar menos" toggle stays visible (re-measure only collapsed).
      if (bodyExpanded) return;
      setBodyCanExpand(body.scrollHeight > body.clientHeight);
    };
    const rafId = requestAnimationFrame(measure);
    media.addEventListener("change", measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(rafId);
      media.removeEventListener("change", measure);
      window.removeEventListener("resize", measure);
    };
  }, [currentIndex, bodyExpanded, desktopQuery]);

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
    // A new scene starts collapsed (US4 show-more).
    setBodyExpanded(false);
    setCurrentIndex(Math.min(Math.max(index, 0), total - 1));
  }

  // SW1 — swipe para trocar de cena em telas touch. O gesto só fica ativo em
  // aparelhos de toque (`pointer: coarse`) sem redução de movimento; no resto
  // (desktop/mouse) os botões e as setas do teclado continuam sendo o caminho.
  const swipeEnabled = useSwipeEnabled();
  const swipe = useSwipeToChangeScene({
    enabled: swipeEnabled,
    onSwipeLeft: () => goTo(currentIndex + 1),
    onSwipeRight: () => goTo(currentIndex - 1),
  });

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
  // on the initial render. (Scroll-to-top on reader load is handled by the
  // page-level <ScrollToTop />, which runs after Next's scroll restoration.)
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
        {...swipe.handlers}
        style={swipe.style}
        className="overflow-hidden rounded-4xl border border-border bg-card shadow-lift"
      >
        {/* Story title cap: a persistent "cover" band that stays fixed while
            scenes change. The story title is the card's `h1`; the per-scene
            heading below is the `h2` focus target. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-md border-b border-border bg-secondary/40 px-6 py-md sm:px-8">
          <h1 className="line-clamp-2 min-w-0 font-display text-title font-extrabold leading-title tracking-tight">
            {story.title}
          </h1>
          <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-sm py-xs text-caption font-bold leading-caption text-text-subtle">
            <span className="sr-only">{t("themeLabel")}: </span>
            {tc(`theme.${story.theme}`)}
          </span>
        </div>

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

          <h2
            data-scene-heading
            id={`scene-heading-${current.ordinal}`}
            tabIndex={-1}
            className="mt-2 font-display text-display font-extrabold leading-display tracking-tight sm:text-3xl"
          >
            {current.title}
          </h2>

          <p
            ref={bodyRef}
            id={bodyId}
            className={`mt-md text-body leading-relaxed text-foreground/90 ${
              bodyExpanded ? "" : "sm:line-clamp-6"
            }`}
          >
            {current.body}
          </p>

          {(bodyCanExpand || bodyExpanded) && (
            <button
              type="button"
              aria-expanded={bodyExpanded}
              aria-controls={bodyId}
              onClick={() => setBodyExpanded((value) => !value)}
              className="mt-sm rounded-2xl px-xs py-xs text-sm font-bold text-primary transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {bodyExpanded ? t("showLess") : t("showMore")}
            </button>
          )}

          <nav
            aria-label={t("navigationLabel")}
            className="mt-lg flex flex-nowrap items-center justify-center gap-sm"
          >
            <Button
              variant="secondary"
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              aria-label={t("previous")}
              title={t("previous")}
              className="min-h-12 min-w-12 justify-center! rounded-2xl!"
            >
              <ChevronLeftIcon className="size-5" />
            </Button>

            {readAloud.supported && (
              <div className="relative flex shrink-0 items-center justify-center">
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
              aria-label={t("next")}
              title={t("next")}
              className="min-h-12 min-w-12 justify-center! rounded-2xl!"
            >
              <ChevronRightIcon className="size-5" />
            </Button>
          </nav>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-md gap-y-sm overflow-hidden border-t border-border bg-secondary/60 px-lg py-md">
          {onNewStory ? (
            <button
              type="button"
              onClick={onNewStory}
              className="whitespace-nowrap rounded-2xl px-sm py-xs text-sm font-bold text-text-subtle transition-colors hover:text-text"
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
