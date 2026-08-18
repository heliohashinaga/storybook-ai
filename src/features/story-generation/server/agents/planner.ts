import "server-only";
import type { AgentResult } from "./agent-result";
import type { JobContext, Outline, SceneOutline } from "./types";
import type {
  ProviderError,
  ProviderStoryInput,
  StoryGenerationProvider,
} from "../story-generation-provider";

/**
 * Planner agent (specs/006-multi-agent-story-generation).
 *
 * The Planner is the first stage of the pipeline and genuinely plans the story
 * structure. It calls its own LLM (`plannerProvider` → `PLANNER_MODEL`) to
 * generate the story skeleton, then derives a validated `Outline` (scene count,
 * theme-aligned purposes) from that generation — *not* from any other agent's
 * output.
 */

export interface PlannerSeams {
  provider: StoryGenerationProvider;
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

/** Maps each supported anonymous theme to a stable planning movement. */
const THEME_MOVEMENT: Record<JobContext["theme"], string> = {
  courage: "bravery",
  friendship: "friendship",
  kindness: "kindness",
  curiosity: "wonder",
  perseverance: "persistence",
  empathy: "compassion",
};

/** Derives a stable, theme-aligned purpose hint for a scene (no identifiers). */
export function purposeFor(ctx: JobContext, index: number): string {
  return `scene-${index}-${THEME_MOVEMENT[ctx.theme]}`;
}

/**
 * Plans the story structure by calling its own provider. Returns
 * `Ok<Outline>` (3–5 scenes, one purpose per scene aligned to the theme),
 * or an `Err` for a provider transport failure (transient so the Coordinator
 * may retry) or a structural mismatch.
 *
 * @param ctx   anonymous job context
 * @param seams provider for planning
 */
/** Maps a provider transport error to a user-facing plan failure. */
function mapPlanError(error: unknown): AgentResult<Outline> {
  const err = error as ProviderError | undefined;
  if (err && "kind" in err) {
    if (err.kind === "timeout") {
      return {
        ok: false,
        stage: "plan",
        message: "story.error.generationTimeout",
        transient: true,
        errorCode: "generation_timeout",
      };
    }
    return {
      ok: false,
      stage: "plan",
      message: "story.error.generationUnavailable",
      transient: true,
      errorCode: "generation_unavailable",
    };
  }
  return {
    ok: false,
    stage: "plan",
    message: "story.error.generationUnavailable",
    transient: true,
  };
}

/** True when the returned candidate is structurally unusable for planning. */
function isUnusableCandidate(
  candidate: Awaited<ReturnType<StoryGenerationProvider["generateStory"]>> | undefined | null,
  expectedCount: number
): boolean {
  return (
    !candidate || !Array.isArray(candidate.scenes) || candidate.scenes.length !== expectedCount
  );
}

export async function planStory(
  ctx: JobContext,
  seams: PlannerSeams
): Promise<AgentResult<Outline>> {
  const { provider } = seams;
  if (ctx.sceneCountRequested < 3 || ctx.sceneCountRequested > 5) {
    return {
      ok: false,
      stage: "plan",
      message: "story.error.invalidInput",
      transient: false,
    };
  }

  let candidate;
  try {
    candidate = await provider.generateStory(providerInputFor(ctx));
  } catch (error) {
    return mapPlanError(error);
  }

  if (isUnusableCandidate(candidate, ctx.sceneCountRequested)) {
    return {
      ok: false,
      stage: "plan",
      message: "story.error.generationUnavailable",
      transient: false,
      errorCode: "unsafe_unrecoverable",
    };
  }

  const scenes: SceneOutline[] = candidate.scenes.map((_scene, index) => ({
    index: index + 1,
    purpose: purposeFor(ctx, index + 1),
    setting: undefined,
  }));

  return { ok: true, value: { scenes } };
}
