import { describe, expect, it } from "vitest";
import { parseChatJson } from "../../../src/features/story-generation/server/provider-core/chat-json";
import { ProviderError } from "../../../src/features/story-generation/server/story-generation-provider";

describe("provider-core parseChatJson", () => {
  it("parses a valid JSON string", () => {
    expect(parseChatJson('{"title": "A Fox Tale"}')).toEqual({ title: "A Fox Tale" });
  });

  it("throws invalid_structured_output when content is empty", () => {
    try {
      parseChatJson("");
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).kind).toBe("invalid_structured_output");
    }
  });

  it("throws invalid_structured_output for non-string content", () => {
    expect(() => parseChatJson(null)).toThrow(ProviderError);
    expect(() => parseChatJson(42)).toThrow(ProviderError);
  });

  it("throws invalid_structured_output for malformed JSON", () => {
    try {
      parseChatJson("{not json");
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).kind).toBe("invalid_structured_output");
    }
  });
});
