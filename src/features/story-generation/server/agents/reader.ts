import "server-only";
import type { AgentResult } from "./agent-result";
import type { JobContext } from "./types";

/**
 * Reader agent (specs/006-multi-agent-story-generation/data-model.md).
 *
 * The Reader exposes a scene's text for on-demand narration. Per the feature
 * decision (research.md, ADR re: story-read-aloud), synthesized audio is NOT
 * embedded in the `GeneratedStory` payload and lives behind the dedicated
 * `POST /api/narrate` endpoint (reusing the story-read-aloud feature). This
 * agent therefore represents the *readability* contract of a scene rather than
 * producing a persisted audio asset: it identifies the exact, anonymous scene
 * text that a caller may route to the TTS runtime, and returns a typed result
 * so a future pipeline stage can compose it without leaking raw content.
 *
 * It is deliberately out of the synchronous success path (audio is delivered
 * on-demand), so the Coordinator treats it as an independent, optional stage.
 */

export interface ReaderSeams {
  /** Optional on-demand narration hook (server-side, only) — default no-op. */
  readOnDemand?: (text: string) => Promise<void>;
}

export interface ReadSceneInput {
  /** 1-based scene position (validated against the assembled story). */
  ordinal: number;
  /** The localized scene body (anonymous — no identifiers). */
  text: string;
}

/**
 * Registers a scene's anonymous text so it can be narrated on demand. Always
 * succeeds for a non-empty, identifier-free scene; never throws. Returns
 * `Ok<void>` (or an `Err` if the optional narration hook rejects).
 *
 * @param ctx anonymous job context (for locale-aware narration)
 * @param scene the scene text to make available for on-demand reading
 * @param seams optional on-demand narration hook
 */
export async function readScene(
  ctx: JobContext,
  scene: ReadSceneInput,
  seams: ReaderSeams = {}
): Promise<AgentResult<{ ordinal: number }>> {
  if (!scene.text || scene.text.trim().length === 0) {
    return {
      ok: false,
      stage: "read",
      message: "story.error.invalidInput",
      transient: false,
    };
  }
  try {
    if (seams.readOnDemand) {
      await seams.readOnDemand(scene.text);
    }
  } catch {
    return {
      ok: false,
      stage: "read",
      message: "story.error.generationUnavailable",
      transient: true,
    };
  }
  // The locale-aware voice selection lives in the client/route (use-read-aloud);
  // here we only record that this scene is narratable, for observability.
  void ctx;
  return { ok: true, value: { ordinal: scene.ordinal } };
}
