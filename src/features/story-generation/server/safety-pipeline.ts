import "server-only";
import { toErrorJson, unsafeUnrecoverable } from "../../../lib/http-errors";
import type { SafeError } from "./schemas";
import type {
  GeneratedStoryCandidate,
  ProviderScene,
  ProviderStoryInput,
  StoryGenerationProvider,
} from "./story-generation-provider";

/**
 * Safety pipeline (T025). Takes an unmoderated provider candidate and makes it
 * safe and complete before it can be shown:
 *
 * - schema validation: exactly the requested `sceneCount` (3–5) scenes,
 *   non-empty localized text;
 * - local rejection of template markers / direct identifiers (never a name
 *   placeholder reaching the reader);
 * - text moderation of every scene body;
 * - illustration moderation of every scene's illustration prompt;
 * - bounded auto-regeneration (one, by default) with stronger constraints;
 * - a wire-safe `unsafe_unrecoverable` error when no safe candidate exists.
 *
 * An unsafe first attempt is never surfaced; a scene is complete only when its
 * text **and** its illustration both pass. Provider transport errors are left
 * to the orchestrator (generate-story) to map to typed HTTP errors.
 */

/**
 * Marker/placeholder tokens that indicate an unpersonalized or leaking
 * candidate (e.g. `{name}`, `{{child}}`, `[NAME]`). Detected locally because
 * the provider classifier may not flag them.
 */
const TEMPLATE_MARKER_PATTERN = /\{\{[^}]+\}\}|\{\w+\}|\[[A-Z_]{2,}\]/i;

/** Explicit direct-identifier phrases that are never allowed in story content. */
const DIRECT_IDENTIFIER_PATTERN =
  /\b(child(?:'s|’s)?\s+name|nome\s+da\s+criança|first\s+name|nome\s+próprio)\b/i;

/** One moderated story scene, safe to render. */
export interface ModeratedStoryScene {
  ordinal: number;
  title: string;
  body: string;
  /** Moderated illustration prompt; the orchestrator generates the image from it. */
  illustrationPrompt: string;
}

/** A safety-approved story candidate, ready for illustration generation. */
export interface ModeratedStoryCandidate {
  title: string;
  scenes: ModeratedStoryScene[];
  /** approved = original candidate used; regenerated = one safe regeneration occurred. */
  safetyDecision: "approved" | "regenerated";
}

export interface RunSafetyPipelineOptions {
  provider: StoryGenerationProvider;
  input: ProviderStoryInput;
  /** Bounded auto-regenerations after an unsafe first attempt (default 1). */
  maxRegenerations?: number;
}

export type SafetyPipelineResult =
  { ok: true; candidate: ModeratedStoryCandidate } | { ok: false; error: SafeError };

function hasForbiddenContent(value: string): boolean {
  return TEMPLATE_MARKER_PATTERN.test(value) || DIRECT_IDENTIFIER_PATTERN.test(value);
}

/**
 * Structural validation of a scene against the contract shape
 * (`sceneSchema` in schemas.ts). The provider classifier only moderates
 * semantic safety, so we also reject structurally invalid output directly:
 * an out-of-range ordinal, an empty title, an empty localized body, or an
 * empty illustration prompt. Invalid output is treated like unsafe output
 * and recovered through bounded regeneration.
 */
function isStructurallyValid(scene: ProviderScene, expectedCount: number): boolean {
  return (
    Number.isInteger(scene.ordinal) &&
    scene.ordinal >= 1 &&
    scene.ordinal <= expectedCount &&
    typeof scene.title === "string" &&
    scene.title.trim().length > 0 &&
    typeof scene.body === "string" &&
    scene.body.trim().length > 0 &&
    typeof scene.illustrationPrompt === "string" &&
    scene.illustrationPrompt.trim().length > 0
  );
}

/**
 * Moderation pass for a single candidate attempt. Returns the moderated
 * candidate, or `null` when any scene (text or illustration) or the whole
 * candidate fails safety or schema checks.
 */
async function moderateCandidate(
  provider: StoryGenerationProvider,
  candidate: GeneratedStoryCandidate,
  expectedCount: number
): Promise<ModeratedStoryCandidate | null> {
  if (!isCandidateShapeValid(candidate, expectedCount)) return null;

  for (const scene of candidate.scenes) {
    if (!(await moderateScene(provider, scene, expectedCount))) return null;
  }

  return {
    title: candidate.title,
    safetyDecision: "approved",
    scenes: candidate.scenes.map((scene) => ({
      ordinal: scene.ordinal,
      title: scene.title,
      body: scene.body,
      illustrationPrompt: scene.illustrationPrompt,
    })),
  };
}

/** True when the candidate's scene count, title, and title safety are valid. */
function isCandidateShapeValid(candidate: GeneratedStoryCandidate, expectedCount: number): boolean {
  if (candidate.scenes.length !== expectedCount) return false;
  if (typeof candidate.title !== "string" || candidate.title.trim().length === 0) return false;
  if (hasForbiddenContent(candidate.title)) return false;
  return true;
}

/**
 * Safety + structural moderation of one scene: title/body/prompt content,
 * then text moderation, then illustration moderation. Returns true only when
 * the scene is both structurally valid and fully safe.
 */
async function moderateScene(
  provider: StoryGenerationProvider,
  scene: ProviderScene,
  expectedCount: number
): Promise<boolean> {
  if (!isStructurallyValid(scene, expectedCount)) return false;
  if (
    hasForbiddenContent(scene.title) ||
    hasForbiddenContent(scene.body) ||
    hasForbiddenContent(scene.illustrationPrompt)
  ) {
    return false;
  }

  const text = await provider.moderateText(scene.body);
  if (!text.safe) return false;

  const illustration = await provider.moderateImage(scene.illustrationPrompt);
  return illustration.safe;
}

/**
 * Runs the safety pipeline for an anonymous story request. Returns the first
 * safe candidate (approved on the first attempt, regenerated otherwise), or a
 * typed `unsafe_unrecoverable` error after bounded regeneration exhausts.
 */
export async function runSafetyPipeline(
  options: RunSafetyPipelineOptions
): Promise<SafetyPipelineResult> {
  const { provider, input, maxRegenerations = 1 } = options;

  for (let attempt = 0; attempt <= maxRegenerations; attempt += 1) {
    const candidate = await provider.generateStory(input);
    const moderated = await moderateCandidate(provider, candidate, input.sceneCount);
    if (moderated) {
      return {
        ok: true,
        candidate: {
          ...moderated,
          safetyDecision: attempt === 0 ? "approved" : "regenerated",
        },
      };
    }
  }

  return { ok: false, error: toErrorJson(unsafeUnrecoverable) };
}
