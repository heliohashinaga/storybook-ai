import "server-only";
import type { AgentResult } from "./agent-result";
import type { JobContext, Outline, WrittenScene, WrittenStory } from "./types";
import { providerInputFor } from "./planner";
import type { ProviderError, StoryGenerationProvider } from "../story-generation-provider";

/**
 * Strips a leading "Scene N —" / "Cena N —" prefix from a scene title so the
 * reader shows a clean name ("The Dream", not "Scene 1 — The Dream"). Providers
 * (the fake + some LLM outputs) may prefix the ordinal; the progress row/label
 * already conveys the position, so the title should not repeat it. Never strips
 * a matched prefix that isn't actually one (only "Scene"/"Cena" + a number +
 * separator, case-insensitive).
 */
export function stripSceneTitlePrefix(title: string): string {
  return title
    .trim()
    .replace(/^(?:Scene|Cena)\s+\d{1,2}\s*[—\-:.]\s*/i, "")
    .trim();
}

/**
 * Writer agent (specs/006-multi-agent-story-generation).
 *
 * Given the Planner's `Outline`, the Writer generates the localized narrative
 * (title + prose + illustration prompts) via its own LLM
 * (`writerProvider` → `WRITER_MODEL`). It validates that the returned story
 * matches the outline's scene breadth before passing it to the Moderator.
 */

export interface WriterSeams {
  provider: StoryGenerationProvider;
}

/**
 * Writes the localized narrative from the Planner's outline using the Writer's
 * own generateStory call.
 *
 * @param ctx     anonymous job context
 * @param outline Planner output describing the scene structure
 * @param seams   provider for writing
 */
export async function writeStory(
  ctx: JobContext,
  outline: Outline,
  seams: WriterSeams
): Promise<AgentResult<WrittenStory>> {
  const { provider } = seams;

  if (!outline || !outline.scenes || outline.scenes.length !== ctx.sceneCountRequested) {
    return {
      ok: false,
      stage: "write",
      message: "story.error.generationUnavailable",
      transient: false,
    };
  }

  let candidate;
  try {
    candidate = await provider.generateStory(providerInputFor(ctx));
  } catch (error) {
    const err = error as ProviderError | undefined;
    if (err && "kind" in err) {
      return {
        ok: false,
        stage: "write",
        message:
          err.kind === "timeout"
            ? "story.error.generationTimeout"
            : "story.error.generationUnavailable",
        transient: true,
        errorCode: err.kind === "timeout" ? "generation_timeout" : "generation_unavailable",
      };
    }
    return {
      ok: false,
      stage: "write",
      message: "story.error.generationUnavailable",
      transient: true,
    };
  }

  if (
    !candidate ||
    typeof candidate.title !== "string" ||
    !Array.isArray(candidate.scenes) ||
    candidate.scenes.length !== ctx.sceneCountRequested
  ) {
    return {
      ok: false,
      stage: "write",
      message: "story.error.generationUnavailable",
      transient: false,
      errorCode: "unsafe_unrecoverable",
    };
  }

  const scenes: WrittenScene[] = candidate.scenes.map((scene, index) => ({
    ordinal: index + 1,
    title: typeof scene.title === "string" ? stripSceneTitlePrefix(scene.title) : "",
    body: typeof scene.body === "string" ? scene.body : "",
    illustrationPrompt:
      typeof scene.illustrationPrompt === "string" ? scene.illustrationPrompt : "",
  }));

  return { ok: true, value: { title: candidate.title, scenes } };
}
