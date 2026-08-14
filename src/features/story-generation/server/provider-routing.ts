import "server-only";
import {
  PROVIDER_IDS,
  providerPrefixOf,
  modelWithoutProviderPrefix,
  type ProviderId,
} from "../../../lib/env";

/**
 * Capabilities the router can resolve. `speech`/TTS is now included for the
 * Reader agent (spec 006); it was previously handled by story-read-aloud alone.
 */
export type Capability = "text" | "moderation" | "image" | "speech";

/** Canonical provider identifiers understood by capability routing (spec 005). */
export const ProviderIdSet: readonly ProviderId[] = PROVIDER_IDS;

/** Environment variable holding the API key, derived from the provider prefix. */
export type ProviderApiKeyEnv = "OPENROUTER_API_KEY" | "OPENCODE_GO_API_KEY";

const API_KEY_BY_PROVIDER: Record<ProviderId, ProviderApiKeyEnv> = {
  "opencode-go": "OPENCODE_GO_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

/**
 * A resolved route for one capability (data-model `RoutedConfig`). The provider
 * and apiKeyEnv are derived from the `*_MODEL` provider prefix; the effective
 * `model` has that prefix removed and is what is sent to the provider.
 */
export interface Route {
  capability: Capability;
  provider: ProviderId;
  model: string;
  apiKeyEnv: ProviderApiKeyEnv;
}

/** Typed configuration error thrown when routing cannot resolve a provider. */
export class ProviderRoutingError extends Error {
  readonly name = "ProviderRoutingError";
}

const CAPABILITIES: readonly Capability[] = ["text", "moderation", "image", "speech"];

/** Maps a pipeline agent id to its capability (spec 006 per-agent models). */
export const CAPABILITY_BY_AGENT: Record<AgentId, Capability> = {
  planner: "text",
  writer: "text",
  moderator: "moderation",
  illustrator: "image",
  reader: "speech",
};

/** Canonical agent ids for per-agent model routing (spec 006). */
export type AgentId = "planner" | "writer" | "moderator" | "illustrator" | "reader";

/** Per-agent model env var names (spec 006). */
export const MODEL_VAR_BY_AGENT: Record<AgentId, string> = {
  planner: "PLANNER_MODEL",
  writer: "WRITER_MODEL",
  moderator: "MODERATOR_MODEL",
  illustrator: "ILLUSTRATOR_MODEL",
  reader: "READER_MODEL",
};

/**
 * Resolve the concrete provider + effective model for one capability from the
 * `*_MODEL` env value using the `provider/rest` convention (spec 005 FR-002/D3):
 * the first segment before the first `/` is the provider. There is **no**
 * defaultProvider and no fallback: a value without a prefix or with an unknown
 * prefix is a configuration error at boot (never silent). Any provider can
 * serve any capability (generic binding).
 */
export function resolveCapability(input: { capability: Capability; model: string }): Route {
  const { capability, model } = input;

  if (!CAPABILITIES.includes(capability)) {
    throw new ProviderRoutingError(
      `Unsupported capability "${capability}"; expected text, moderation, image, or speech.`
    );
  }

  const prefix = providerPrefixOf(model);
  if (prefix === undefined) {
    throw new ProviderRoutingError(
      `Model "${model}" has no provider prefix (provider/model); use opencode-go|openrouter/...`
    );
  }
  if (!PROVIDER_IDS.includes(prefix as ProviderId)) {
    throw new ProviderRoutingError(
      `Model "${model}" has an unknown provider prefix "${prefix}"; expected opencode-go or openrouter.`
    );
  }

  return {
    capability,
    provider: prefix as ProviderId,
    model: modelWithoutProviderPrefix(model),
    apiKeyEnv: API_KEY_BY_PROVIDER[prefix as ProviderId],
  };
}
