"use client";

import { useTranslations } from "next-intl";
import type { GeneratedScene, Theme } from "../../story-generation/server/schemas";

/**
 * Accessible scene illustration header (T039), blossom layout (spec 007).
 *
 * Renders the full-bleed `4:3` WebP illustration of one scene with an
 * overlaid theme badge. The scene heading and body live in `story-reader`,
 * which owns the single reading card. Presentational — navigation lives in
 * `story-reader`.
 */
export function SceneView({ scene, theme }: { scene: GeneratedScene; theme: Theme }) {
  const tc = useTranslations("story.catalog");

  return (
    <div className="relative aspect-[4/3] w-full bg-secondary">
      {/* eslint-disable-next-line @next/next/no-img-element -- in-memory WebP data-URI; not cachable or optimizable by next/image */}
      <img src={scene.illustrationDataUri} alt={scene.altText} className="size-full object-cover" />
      <span className="absolute left-4 top-4 rounded-full bg-card/90 px-3 py-1 text-xs font-bold text-text backdrop-blur">
        {tc(`theme.${theme}`)}
      </span>
    </div>
  );
}
