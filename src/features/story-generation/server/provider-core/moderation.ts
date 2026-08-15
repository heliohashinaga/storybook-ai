import "server-only";
import type OpenAI from "openai";
import { z } from "zod";
import type { ModerationDecision } from "../story-generation-provider";
import { ProviderError } from "../story-generation-provider";
import { parseChatJson } from "./chat-json";
import { toProviderError } from "./provider-errors";
import { MODERATION_SYSTEM_PROMPT } from "./prompts";
import { moderationSchema } from "./schemas";

export async function moderate(
  client: OpenAI,
  model: string,
  content: string
): Promise<ModerationDecision> {
  try {
    const completion = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: MODERATION_SYSTEM_PROMPT },
        { role: "user", content },
      ],
    });
    const parsed = parseChatJson(completion.choices[0]?.message?.content);
    const decision = moderationSchema.parse(parsed);
    return decision.safe
      ? { safe: true }
      : { safe: false, ...(decision.reason ? { reason: decision.reason } : {}) };
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof ProviderError) {
      throw new ProviderError("unavailable", "Moderation result is invalid.");
    }
    toProviderError(error);
  }
}
