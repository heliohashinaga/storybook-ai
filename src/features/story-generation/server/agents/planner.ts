import "server-only";
import type { AgentResult } from "./agent-result";
import type { JobContext, Outline, SceneOutline } from "./types";
import type { ModeratedStoryCandidate } from "../safety-pipeline";
import type { ProviderStoryInput } from "../story-generation-provider";

/**
 * Planner agent (specs/006-multi-agent-story-generation/data-model.md).
 *
 * Given the Reviewer-approved narrative, the Planner derives the `Outline` —
 * the anti-anonymous structural plan of the story: one scene per approved
 * scene, in order, with a theme-aligned purpose and no identifiers. It IS a
 * pure, deterministic transform of the moderated candidate (no provider call),
 * so the Coordinator can run it only after the safety gate has passed and any
 * safe regeneration has settled.
 */

/** Surface type for a Planner capability seam (currently unused — reserved). */
export interface PlannerSeams {
  /** Reserved for a future planning capability; today planning is a pure transform. */
  readonly _?: never;
}

/** Builds the anonymous provider input from the job context (no identifiers). */
export function providerInputFor(ctx: JobContext): ProviderStoryInput {
  return {
    ageBand: ctx.ageBand,
    locale: ctx.locale,
    theme: ctx.theme,
    sceneCount: ctx.sceneCountRequested,
  };
}

/** Derives a stable, theme-aligned purpose hint for a scene (no identifiers). */
export function purposeFor(ctx: JobContext, index: number): string {
  const movement =
    ctx.theme === "courage" ? "bravery" : ctx.theme === "friendship" ? "friendship" : "kindness";
  return `scene-${index}-${movement}`;
}

/**
 * Produces the `Outline` from the approved, moderated narrative. Returns
 * `Ok<Outline>` (3–5 scenes) when the candidate is structurally sound, or an
 * `Err` when the candidate is malformed (defense-in-depth; the Reviewer and
 * Coordinator also validate, so this is a cheap re-derivation gate).
 *
 * @param ctx anonymous job context
 * @param approved the safety-approved narrative (moderated candidate)
 */
export function planStory(
  ctx: JobContext,
  approved: ModeratedStoryCandidate
): AgentResult<Outline> {
  if (!approved || !Array.isArray(approved.scenes) || approved.scenes.length < 3) {
    return {
      ok: false,
      stage: "plan",
      message: "story.error.generationUnavailable",
      transient: false,
    };
  }

  const scenes: SceneOutline[] = approved.scenes.map((scene, index) => ({
    index: index + 1,
    purpose: purposeFor(ctx, index + 1),
    setting: undefined,
  }));

  if (scenes.length !== ctx.sceneCountRequested) {
    return {
      ok: false,
      stage: "plan",
      message: "story.error.generationUnavailable",
      transient: false,
    };
  }

  return { ok: true, value: { scenes } };
}
