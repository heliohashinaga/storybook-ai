import "server-only";
import type { AgentResult } from "./agent-result";
import type { JobContext, Outline, WrittenScene, WrittenStory } from "./types";
import type { ModeratedStoryCandidate } from "../safety-pipeline";

/**
 * Writer agent (specs/006-multi-agent-story-generation/data-model.md).
 *
 * Given the Planner's `Outline` and the Moderator-approved narrative, the
 * Writer materializes the localized `WrittenStory`: a `title` plus one written
 * scene per planned scene, preserving each scene's ordinal so downstream
 * agents (Illustrator) can map illustration back unambiguously. It is a pure,
 * deterministic transform of the moderated candidate — no provider call, so
 * the Coordinator runs it after the safety gate has passed.
 */

/**
 * Surface type for a Writer capability seam (reserved — today the Writer is a
 * pure transform of the already-approved candidate and needs no provider).
 */
export type WriterSeams = object;

/**
 * Produces the localized `WrittenStory` from the approved candidate. Returns
 * `Ok<WrittenStory>` when the candidate is structurally sound and matches the
 * outline breadth, or an `Err` (defense-in-depth) on mismatch.
 *
 * @param ctx anonymous job context
 * @param outline planner output describing the scene structure
 * @param approved the safety-approved narrative (moderated candidate)
 */
export function writeStory(
  ctx: JobContext,
  outline: Outline,
  approved: ModeratedStoryCandidate,
  _seams: WriterSeams = {}
): AgentResult<WrittenStory> {
  const expected = ctx.sceneCountRequested;
  if (
    !approved ||
    typeof approved.title !== "string" ||
    !Array.isArray(approved.scenes) ||
    approved.scenes.length !== expected ||
    !outline ||
    outline.scenes.length !== expected
  ) {
    return {
      ok: false,
      stage: "write",
      message: "story.error.generationUnavailable",
      transient: false,
    };
  }

  const scenes: WrittenScene[] = approved.scenes.map((scene, index) => ({
    ordinal: index + 1,
    title: typeof scene.title === "string" ? scene.title : "",
    body: typeof scene.body === "string" ? scene.body : "",
    illustrationPrompt:
      typeof scene.illustrationPrompt === "string" ? scene.illustrationPrompt : "",
  }));

  return { ok: true, value: { title: approved.title, scenes } };
}
