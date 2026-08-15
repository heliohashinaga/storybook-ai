import "server-only";
import { ProviderError } from "../story-generation-provider";

/** Extracts and parses `choices[0].message.content` as JSON from a chat response. */
export function parseChatJson(content: unknown): unknown {
  if (typeof content !== "string" || content.trim() === "") {
    throw new ProviderError("invalid_structured_output", "Provider returned no content.");
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new ProviderError("invalid_structured_output", "Provider returned malformed JSON.");
  }
}
