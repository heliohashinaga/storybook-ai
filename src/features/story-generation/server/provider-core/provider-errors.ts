import "server-only";
import OpenAI from "openai";
import { ProviderError } from "../story-generation-provider";

/** Maps a transport/SDK failure to a typed {@link ProviderError}. */
export function toProviderError(error: unknown): never {
  if (error instanceof ProviderError) throw error;
  // The SDK overrides `name` to a generic value, so classify by class, not by
  // name. Only a connection timeout maps to 504; everything else is a safe
  // 502-style "unavailable".
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    throw new ProviderError("timeout", "Provider request timed out.");
  }
  throw new ProviderError("unavailable", "Provider request failed.");
}
