import "server-only";
import type { AgentResult } from "./agent-result";
import type { JobContext } from "./types";
import { providerInputFor } from "./planner";
import { runSafetyPipeline, type ModeratedStoryCandidate } from "../safety-pipeline";
import { ProviderError, type StoryGenerationProvider } from "../story-generation-provider";

/**
 * Reviewer agent (specs/006-multi-agent-story-generation/data-model.md).
 *
 * The Reviewer is the authoritative safety gate of the pipeline. It delegates
 * to `runSafetyPipeline`, which fetches the structured narrative from the
 * anonymous provider call and:
 *  1. rejects template markers / direct identifiers locally,
 *  2. moderates every scene's text **and** illustration prompt,
 *  3. on an unsafe result, auto-regenerates with stronger constraints (bounded),
 *  4. returns an approved `ModeratedStoryCandidate` OR a wire-safe, typed error.
 *
 * It is the ONLY agent that issues a text-generation provider call, keeping
 * the provider interaction count identical to the pre-pipeline orchestrator so
 * deterministic fakes (turn-based "unsafe-then-safe") behave as before.
 */

export interface ReviewerSeams {
  provider: StoryGenerationProvider;
}

/**
 * Runs the safety gate for an anonymous request. Returns `Ok<ModeratedStoryCandidate>`
 * once the narrative is safe, or an `Err` (permanent `unsafe` → `transient=false`;
 * transport failures → transient so the Coordinator may retry).
 *
 * @param ctx anonymous job context
 * @param seams provider capability seam(s)
 */
export async function reviewStory(
  ctx: JobContext,
  seams: ReviewerSeams
): Promise<AgentResult<ModeratedStoryCandidate>> {
  const { provider } = seams;
  let moderation;
  try {
    moderation = await runSafetyPipeline({ provider, input: providerInputFor(ctx) });
  } catch (error) {
    // Provider transport failure — transient so the Coordinator can retry this
    // stage, but preserve the exact code (timeout vs unavailable) so the outer
    // wrapper can map back to the precise localized HTTP error.
    if (error instanceof ProviderError) {
      return {
        ok: false,
        stage: "review",
        message:
          error.kind === "timeout"
            ? "story.error.generationTimeout"
            : "story.error.generationUnavailable",
        transient: true,
        errorCode: error.kind === "timeout" ? "generation_timeout" : "generation_unavailable",
      };
    }
    return {
      ok: false,
      stage: "review",
      message: "story.error.generationUnavailable",
      transient: true,
    };
  }

  if (!moderation.ok) {
    // A typed, wire-safe error from the pipeline (e.g. unsafe_unrecoverable).
    return {
      ok: false,
      stage: "review",
      message: moderation.error.messageKey ?? "story.error.generationUnavailable",
      transient: false,
      errorCode: moderation.error.code,
    };
  }

  return { ok: true, value: moderation.candidate };
}
