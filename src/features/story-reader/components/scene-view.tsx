"use client";

import { useTranslations } from "next-intl";
import type { GeneratedScene } from "../../story-generation/server/schemas";

/**
 * Accessible single-scene renderer (T039).
 *
 * Renders one scene of the approved story: optimized WebP illustration with
 * the localized alt text from the story response, the scene heading (focusable
 * so the reader can move programmatic focus to it on navigation), and the
 * localized body text. Presentational — navigation lives in `story-reader`.
 */
export function SceneView({ scene }: { scene: GeneratedScene }) {
  const t = useTranslations("story.reader");

  return (
    <article
      aria-label={t("sceneLabel", { ordinal: scene.ordinal })}
      className="flex flex-col gap-md"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- in-memory WebP data-URI; not cachable or optimizable by next/image */}
      <img
        src={scene.illustrationDataUri}
        alt={scene.altText}
        className="aspect-square w-full rounded-md object-cover"
      />
      <h2 id={`scene-heading-${scene.ordinal}`} tabIndex={-1} className="font-title text-body">
        {scene.title}
      </h2>
      <p className="text-body">{scene.body}</p>
    </article>
  );
}
