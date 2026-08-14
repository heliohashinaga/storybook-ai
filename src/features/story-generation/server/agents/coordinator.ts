import "server-only";
import type { StoryGenerationProvider } from "../story-generation-provider";
import { storyResponseSchema, type GeneratedStory } from "../schemas";
import type { AgentResult } from "./agent-result";
import type { JobContext, GenerationToken } from "./types";
import { createStopwatch } from "./timing";
import { planStory } from "./planner";
import { writeStory } from "./writer";
import { moderateStory } from "./moderator";
import { illustrateStory } from "./illustrator";

/**
 * Coordinator agent (specs/006-multi-agent-story-generation).
 *
 * The Coordinator is the composition root of the multi-agent pipeline. It runs
 * the agents in order, each with its own provider/model (per-agent routing,
 * spec 006). Stage order:
 *
 *   Planner (generate outline via PLANNER_MODEL)
 *     → Writer (generate narrative via WRITER_MODEL)
 *       → Moderator (safety gate via MODERATOR_MODEL: moderate + bounded
 *         regeneration)
 *         → Illustrator (images via ILLUSTRATOR_MODEL)
 *
 * The Reader is intentionally out of this synchronous success path — audio is
 * delivered on demand via the existing `/api/narrate` endpoint.
 *
 * Transient stage failures surface as an `Err` the caller may retry; permanent
 * failures (unsafe, malformed) map to a wire-safe localized error. No raw
 * provider output is ever returned or logged.
 */

/** Maximum attempts for a non-final, transient stage (respected by Coordinator). */
export interface PipelineSeams {
  /** Per-agent provider for the Planner (PLANNER_MODEL). */
  plannerProvider: StoryGenerationProvider;
  /** Per-agent provider for the Writer (WRITER_MODEL). */
  writerProvider: StoryGenerationProvider;
  /** Per-agent provider for the Moderator (MODERATOR_MODEL). */
  moderatorProvider: StoryGenerationProvider;
  /** Localized prompt → optimized WebP data-URI (ADR 0005). */
  illustrate: (prompt: string) => Promise<{ dataUri: string }>;
  /** Bounded retries for the whole illustration set (default 1). */
  imageRetries?: number;
  /** Max illustrations generated concurrently within a set (default 2). */
  illustrationConcurrency?: number;
  /** Response-size guard on each illustration data URI (override for tests). */
  maxIllustrationDataUriLength?: number;
  /** Optional on-demand narration hook (Reader). */
  readOnDemand?: (text: string) => Promise<void>;
}

export interface GenerateStoryPipelineOptions {
  ctx: JobContext;
  seams: PipelineSeams;
  /**
   * End-to-end latency budget in ms for the full pipeline (default 120 s, per
   * the performance budgets enumerated in spec 001). Over-budget stages abort
   * early with a typed `generation_timeout` instead of exhausting the caller.
   */
  pipelineBudgetMs?: number;
}

/** Creates an opaque, in-memory trace token (no identifiers). */
export function createGenerationToken(): GenerationToken {
  return Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(8))).toString("hex");
}

/** Retries a stage's function up to `maxAttempts` on transient failures only. */
async function runStage<T>(
  fn: () => Promise<AgentResult<T>>,
  maxAttempts: number
): Promise<AgentResult<T>> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await fn();
    if (result.ok) return result;
    if (!result.transient || attempt >= maxAttempts) return result;
  }
  return {
    ok: false,
    stage: "plan",
    message: "story.error.generationUnavailable",
    transient: true,
  };
}

/**
 * Runs the full anonymous multi-agent pipeline and returns either a validated
 * 3–5 scene story or a typed safe error. Used by `generateStory` and by the
 * `/api/stories` route's test seams.
 */
export async function generateStoryPipeline(
  options: GenerateStoryPipelineOptions
): Promise<AgentResult<GeneratedStory>> {
  const { ctx, seams } = options;
  const budgetMs = options.pipelineBudgetMs ?? 120_000;
  const maxAttempts = Number(process.env.STORY_PIPELINE_MAX_ATTEMPTS ?? 2);
  const clock = createStopwatch();

  // Stage 1 — Planner: generate the story structure (Outline) via its own model.
  const plan = await runStage(
    () => planStory(ctx, { provider: seams.plannerProvider }),
    maxAttempts
  );
  if (!plan.ok) {
    return {
      ok: false,
      stage: plan.stage,
      message: "story.error.generationUnavailable",
      transient: plan.transient,
      errorCode: plan.errorCode,
    };
  }
  clock.tick("plan");

  // Stage 2 — Writer: generate the localized narrative via its own model.
  const written = await runStage(
    () => writeStory(ctx, plan.value, { provider: seams.writerProvider }),
    maxAttempts
  );
  if (!written.ok) {
    return {
      ok: false,
      stage: written.stage,
      message: "story.error.generationUnavailable",
      transient: written.transient,
      errorCode: written.errorCode,
    };
  }
  clock.tick("write");

  // Stage 3 — Moderator: safety gate on the Writer's narrative.
  const moderated = await runStage(
    () => moderateStory(ctx, written.value, { provider: seams.moderatorProvider }),
    maxAttempts
  );
  if (!moderated.ok) {
    return {
      ok: false,
      stage: moderated.stage,
      message: "story.error.generationUnavailable",
      transient: moderated.transient,
      errorCode: moderated.errorCode,
    };
  }
  clock.tick("moderate");

  // Stage 4 — illustrations (concurrency + whole-set retry), per ADR 0005.
  const illustrated = await illustrateStory(ctx, moderated.value, {
    illustrate: seams.illustrate,
    imageRetries: seams.imageRetries,
    illustrationConcurrency: seams.illustrationConcurrency,
    maxIllustrationDataUriLength: seams.maxIllustrationDataUriLength,
  });
  clock.tick("illustrate");
  if (!illustrated.ok) return illustrated;

  // Enforce the end-to-end latency budget.
  if (clock.isOverBudget(budgetMs)) {
    return {
      ok: false,
      stage: "assemble",
      message: "story.error.generationTimeout",
      transient: true,
      errorCode: "generation_timeout",
    };
  }

  // Defense-in-depth scene-count check.
  if (illustrated.value.scenes.length !== ctx.sceneCountRequested) {
    return {
      ok: false,
      stage: "assemble",
      message: "story.error.generationUnavailable",
      transient: false,
      errorCode: "unsafe_unrecoverable",
    };
  }

  const story: GeneratedStory = {
    locale: ctx.locale,
    ageBand: ctx.ageBand,
    theme: ctx.theme,
    sceneCount: ctx.sceneCountRequested,
    safetyDecision: illustrated.value.safetyDecision,
    title: illustrated.value.title,
    scenes: illustrated.value.scenes.map((scene) => ({
      ordinal: scene.ordinal,
      title: scene.title,
      body: scene.body,
      illustrationDataUri: scene.illustrationDataUri,
      altText: scene.altText,
    })),
  };

  const parsed = storyResponseSchema.safeParse(story);
  if (!parsed.success) {
    return {
      ok: false,
      stage: "assemble",
      message: "story.error.generationUnavailable",
      transient: false,
      errorCode: "generation_unavailable",
    };
  }

  return { ok: true, value: parsed.data };
}
