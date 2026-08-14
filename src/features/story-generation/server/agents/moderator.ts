import "server-only";
import type { ProviderError } from "../story-generation-provider";
import type { StoryGenerationProvider } from "../story-generation-provider";
import type { AgentResult } from "./agent-result";
import type { JobContext, WrittenStory } from "./types";
import { providerInputFor } from "./planner";
import type { ModeratedStoryScene, ModeratedStoryCandidate } from "../safety-pipeline";

/* -------------------------------------------------------------------------- */
/* Lightweight safety checks: reject identifiers and validate structure       */
/* (mirrors the pre-split safety-pipeline.ts patterns without the generation  */
/* step, which now lives in the Planner + Writer).                            */
/* -------------------------------------------------------------------------- */

const TEMPLATE_MARKER_PATTERN = /\{\{[^}]+\}\}|\{\w+\}|\[[A-Z_]{2,}\]/i;
const DIRECT_IDENTIFIER_PATTERN =
  /\b(child(?:'s|’s)?\s+name|nome\s+da\s+criança|first\s+name|nome\s+próprio)\b/i;

function hasForbiddenContent(value: string): boolean {
  return TEMPLATE_MARKER_PATTERN.test(value) || DIRECT_IDENTIFIER_PATTERN.test(value);
}

function isStructurallyValid(
  scene: { title: string; body: string; illustrationPrompt: string },
  _expectedCount: number
): boolean {
  return (
    typeof scene.title === "string" &&
    scene.title.trim().length > 0 &&
    typeof scene.body === "string" &&
    scene.body.trim().length > 0 &&
    typeof scene.illustrationPrompt === "string" &&
    scene.illustrationPrompt.trim().length > 0
  );
}

/* -------------------------------------------------------------------------- */
/* Moderator agent — safety gate (no generation)                              */
/* -------------------------------------------------------------------------- */

export interface ModeratorSeams {
  provider: StoryGenerationProvider;
}

/**
 * Moderates the **Writer's** narrative (does NOT generate). If any scene is
 * unsafe, regenerates ONCE via the moderator provider and re-moderates;
 * a second failure returns `unsafe_unrecoverable`.
 *
 * @param ctx   anonymous job context (locale/sceneCount only, no identifier)
 * @param written  the Writer's output to moderate
 * @param seams provider for moderation + bounded regeneration
 */
export async function moderateStory(
  ctx: JobContext,
  written: WrittenStory,
  seams: ModeratorSeams
): Promise<AgentResult<ModeratedStoryCandidate>> {
  const { provider } = seams;

  if (
    !written ||
    !Array.isArray(written.scenes) ||
    written.scenes.length !== ctx.sceneCountRequested
  ) {
    return {
      ok: false,
      stage: "moderate",
      message: "story.error.generationUnavailable",
      transient: false,
    };
  }

  // Attempt 0: moderate the writer's output.
  const approved0 = await moderateOneCandidate(provider, written);
  if (approved0) {
    return { ok: true, value: { ...approved0, safetyDecision: "approved" as const } };
  }

  // Attempt 1: regenerate via the moderator's own model, then re-moderate.
  try {
    const regenerated = await provider.generateStory(providerInputFor(ctx));
    const regeneratedWritten: WrittenStory = {
      title: regenerated.title,
      scenes: regenerated.scenes.map((s) => ({
        ordinal: s.ordinal,
        title: s.title,
        body: s.body,
        illustrationPrompt: s.illustrationPrompt,
      })),
    };
    const approved1 = await moderateOneCandidate(provider, regeneratedWritten);
    if (approved1) {
      return { ok: true, value: { ...approved1, safetyDecision: "regenerated" as const } };
    }
  } catch (error) {
    const err = error as ProviderError | undefined;
    if (err && "kind" in err) {
      return {
        ok: false,
        stage: "moderate",
        message:
          err.kind === "timeout"
            ? "story.error.generationTimeout"
            : "story.error.generationUnavailable",
        transient: true,
        errorCode: err.kind === "timeout" ? "generation_timeout" : "generation_unavailable",
      };
    }
  }

  return {
    ok: false,
    stage: "moderate",
    message: "story.error.unsafeUnrecoverable",
    transient: false,
    errorCode: "unsafe_unrecoverable",
  };
}

/* -------------------------------------------------------------------------- */
/* Shared: moderate one candidate (text + image, no regeneration)             */
/* -------------------------------------------------------------------------- */

async function moderateOneCandidate(
  provider: StoryGenerationProvider,
  candidate: WrittenStory
): Promise<{ title: string; scenes: ModeratedStoryScene[] } | null> {
  const scenes = candidate.scenes;
  if (!Array.isArray(scenes) || scenes.length < 3) return null;
  if (typeof candidate.title !== "string" || candidate.title.trim().length === 0) return null;

  for (const scene of scenes) {
    if (!isStructurallyValid(scene, scenes.length)) return null;
    if (
      hasForbiddenContent(scene.title) ||
      hasForbiddenContent(scene.body) ||
      hasForbiddenContent(scene.illustrationPrompt)
    ) {
      return null;
    }

    const text = await provider.moderateText(scene.body);
    if (!text.safe) return null;

    const image = await provider.moderateImage(scene.illustrationPrompt);
    if (!image.safe) return null;
  }

  return {
    title: candidate.title,
    scenes: scenes.map((s) => ({
      ordinal: s.ordinal,
      title: s.title,
      body: s.body,
      illustrationPrompt: s.illustrationPrompt,
    })),
  };
}
