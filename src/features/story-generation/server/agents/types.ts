import "server-only";

/**
 * In-memory, transient entities for the multi-agent pipeline
 * (specs/006-multi-agent-story-generation/data-model.md). None of these are
 * ever persisted; they exist only for a single anonymous request.
 *
 * `JobContext` and its `generationToken` are the canonical types from
 * `schemas.ts` (T008) so the pipeline reuses the single scene-count source of
 * truth (`MIN_SCENES`/`MAX_SCENES`/`DEFAULT_SCENE_COUNT`) and the anonymous
 * token regex.
 */
export type { JobContext, GenerationToken } from "../schemas";

/** One planned scene in the outline (the "what"), prior to writing prose. */
export interface SceneOutline {
  /** 1-based scene position (validated 1..sceneCountRequested). */
  index: number;
  /** Narrative purpose of the scene (theme-aligned, never an identifier). */
  purpose: string;
  /** Optional locale hint for the setting/location of the scene. */
  setting?: string;
}

/** The Planner's output: a validated plan of 3–5 scenes. */
export interface Outline {
  scenes: SceneOutline[];
}

/** One written scene (the "narrative"). */
export interface WrittenScene {
  ordinal: number;
  title: string;
  body: string;
  /** Illustration prompt (kept localized here; Illustrator localizes to en). */
  illustrationPrompt: string;
}

/** The Writer's output: the draft prose for every planned scene. */
export interface WrittenStory {
  title: string;
  scenes: WrittenScene[];
}
