import { describe, expect, it } from "vitest";
import { toProviderError } from "../../../src/features/story-generation/server/provider-core/provider-errors";
import { ProviderError } from "../../../src/features/story-generation/server/story-generation-provider";

describe("provider-core toProviderError", () => {
  it("re-throws an existing ProviderError untouched", () => {
    const original = new ProviderError("timeout", "boom");
    try {
      toProviderError(original);
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBe(original);
    }
  });

  it("maps an unknown error to a typed unavailable ProviderError", () => {
    try {
      toProviderError(new Error("boom"));
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).kind).toBe("unavailable");
    }
  });

  it("never returns — it always throws", () => {
    expect(() => toProviderError(new Error("boom"))).toThrow();
  });
});
