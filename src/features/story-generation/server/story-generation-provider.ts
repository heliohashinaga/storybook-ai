import "server-only";
import type { AgeBand, Locale, Theme } from "./schemas";

/**
 * Server-only provider boundary. The UI, route, and pipeline interact only
 * through this interface; raw provider/OpenAI output never reaches the client.
 * An implementation is chosen by the generation orchestrator (an OpenAI adapter
 * in production, a deterministic fake under test).
 */

/** Anonymous, provider-bound request: age band, locale, theme, and requested scene count. */
export interface ProviderStoryInput {
  ageBand: AgeBand;
  locale: Locale;
  theme: Theme;
  /** Requested scene count (3–5); the provider must produce exactly this many scenes. */
  sceneCount: number;
}

/** One scene candidate from the provider, before moderation/optimization. */
export interface ProviderScene {
  ordinal: number;
  title: string;
  body: string;
  /** Prompt for this scene's illustration (moderated before generation). */
  illustrationPrompt: string;
}

/** Structured story candidate as returned by the provider. */
export interface GeneratedStoryCandidate {
  title: string;
  scenes: ProviderScene[];
}

/** Moderation outcome for a single text or image candidate. */
export interface ModerationDecision {
  safe: boolean;
  /** Human-readable classifier category when unsafe (never surfaced to users). */
  reason?: string;
}

/** Categorised provider failures so the route can map to a typed HTTP error. */
export type ProviderErrorKind = "unavailable" | "timeout" | "invalid_structured_output";

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  constructor(kind: ProviderErrorKind, message: string) {
    super(message);
    this.name = "ProviderError";
    this.kind = kind;
  }
}

/**
 * Provider seam. `generateStory` returns an unmoderated structured candidate;
 * `moderateText` / `moderateImage` let the safety pipeline reject unsafe text
 * and illustration prompts before anything is shown.
 */
export interface StoryGenerationProvider {
  generateStory(input: ProviderStoryInput): Promise<GeneratedStoryCandidate>;
  moderateText(text: string): Promise<ModerationDecision>;
  moderateImage(prompt: string): Promise<ModerationDecision>;
}
