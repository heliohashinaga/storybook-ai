"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "../../../components/ui/button";
import type { GeneratedStory } from "../../story-generation/server/schemas";
import { useReadAloud } from "../client/use-read-aloud";
import { SceneView } from "./scene-view";

/**
 * Scene-by-scene reader (T040).
 *
 * Shows one scene at a time with ordered next/previous navigation, a localized
 * progress indicator ("Cena X de Y"), and arrow-key navigation when the scene
 * content is focused. Bounds are enforced: previous is disabled on the first
 * scene and next on the last. When the scene changes, programmatic focus moves
 * to the new scene heading (G194-adjacent pattern for dynamic content). The
 * reader keeps its position in-memory for the session; nothing is persisted.
 */
export function StoryReader({ story }: { story: GeneratedStory }) {
  const t = useTranslations("story.reader");
  const scenes = story.scenes;
  const [currentIndex, setCurrentIndex] = useState(0);
  const regionRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  const total = scenes.length;
  const current = scenes[currentIndex];

  function goTo(index: number) {
    // Stop any in-progress narration before moving to another scene.
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

  // Test-first: read-aloud (US2). Local, single start/stop control; speech is
  // cancelled whenever the scene text changes so two scenes never overlap.
  const readerText = current ? `${current.title}. ${current.body}` : "";
  const readAloud = useReadAloud({
    text: readerText,
    locale: story.locale ?? "pt-BR",
  });

  // Move focus to the new scene heading on navigation, but never steal focus
  // on the initial render.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const heading = regionRef.current?.querySelector<HTMLElement>("h2");
    heading?.focus();
  }, [currentIndex]);

  // The response schema guarantees at least MIN_SCENES scenes (up to MAX_SCENES);
  // this only runs while typing the byte-level contract.
  if (!current) return null;

  return (
    <section
      ref={regionRef}
      aria-label={t("title")}
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-lg"
    >
      <header className="flex flex-col gap-xs">
        <h1 className="font-title text-title">{t("title")}</h1>
        <p className="text-title">{story.title}</p>
      </header>

      <SceneView scene={current} />

      {readAloud.supported && (
        <div>
          <Button variant="secondary" aria-pressed={readAloud.speaking} onClick={readAloud.toggle}>
            {readAloud.speaking ? t("stopReading") : t("readAloud")}
          </Button>
          <span aria-live="polite" className="sr-only">
            {readAloud.speaking ? t("reading") : ""}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-md">
        <p aria-live="polite" className="text-body">
          {t("sceneCount", { current: currentIndex + 1, total })}
        </p>
        <div className="flex gap-sm">
          <Button
            variant="secondary"
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
          >
            {t("previous")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => goTo(currentIndex + 1)}
            disabled={currentIndex === total - 1}
          >
            {t("next")}
          </Button>
        </div>
      </div>
    </section>
  );
}
