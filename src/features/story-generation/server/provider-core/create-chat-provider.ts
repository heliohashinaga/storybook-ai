import "server-only";
import type OpenAI from "openai";
import { z } from "zod";
import type {
  GeneratedStoryCandidate,
  ModerationDecision,
  ProviderStoryInput,
} from "../story-generation-provider";
import { ProviderError } from "../story-generation-provider";
import { parseChatJson } from "./chat-json";
import { moderate } from "./moderation";
import { toProviderError } from "./provider-errors";
import { NARRATIVE_SYSTEM_PROMPT, narrativeUserPrompt } from "./prompts";
import { storyCandidateSchema } from "./schemas";

/**
 * Dependencies for the shared chat-completions orchestration factory.
 *
 * The factory is deliberately **lazy over the client**: it receives a lazy
 * `getClient` getter (invoked on first use) plus the already-resolved text and
 * moderation model identifiers. Client construction (`baseUrl`, `defaultHeaders`,
 * `fetchImpl`, timeout/retries) and model resolution stay in each adapter, so
 * importing or creating a provider never requires provider env to be present —
 * env is validated on the first real request (see spec 013 Clarifications).
 */
export interface ChatCompletionsProviderDeps {
  /** Lazy OpenAI client getter; invoked on the first operation. */
  getClient: () => OpenAI;
  /** Resolved text/narrative model identifier. */
  textModel: string;
  /** Resolved moderation model identifier. */
  moderationModel: string;
}

/**
 * Single behavior-preserving orchestration for the OpenAI-compatible chat
 * providers (OpenRouter, OpenCode). Encapsulates `generateStory`,
 * `moderateText` and `moderateImage` so the adapters stay thin and a change to
 * one provider's orchestration can never silently diverge from the other's.
 *
 * Semantics, prompts, timeouts, retries and error handling match the adapter
 * bodies verbatim (spec 013, SC-003).
 */
export function createChatCompletionsProvider(deps: ChatCompletionsProviderDeps): {
  generateStory(input: ProviderStoryInput): Promise<GeneratedStoryCandidate>;
  moderateText(text: string): Promise<ModerationDecision>;
  moderateImage(prompt: string): Promise<ModerationDecision>;
} {
  return {
    async generateStory(input: ProviderStoryInput): Promise<GeneratedStoryCandidate> {
      try {
        const completion = await deps.getClient().chat.completions.create({
          model: deps.textModel,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: NARRATIVE_SYSTEM_PROMPT },
            { role: "user", content: narrativeUserPrompt(input) },
          ],
        });
        const parsed = parseChatJson(completion.choices[0]?.message?.content);
        return storyCandidateSchema.parse(parsed);
      } catch (error) {
        if (error instanceof z.ZodError || error instanceof ProviderError) {
          throw new ProviderError("invalid_structured_output", "Story candidate is invalid.");
        }
        toProviderError(error);
      }
    },

    async moderateText(text: string): Promise<ModerationDecision> {
      return moderate(deps.getClient(), deps.moderationModel, text);
    },

    async moderateImage(prompt: string): Promise<ModerationDecision> {
      return moderate(deps.getClient(), deps.moderationModel, prompt);
    },
  };
}
