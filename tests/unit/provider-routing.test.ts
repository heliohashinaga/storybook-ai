import { describe, expect, it } from "vitest";
import {
  resolveCapability,
  ProviderRoutingError,
  ProviderIdSet,
  type Route,
} from "../../src/features/story-generation/server/provider-routing";
import type { Capability } from "../../src/features/story-generation/server/provider-routing";

describe("provider-routing (capability-based)", () => {
  it("routes accepted examples from the spec", () => {
    // TEXT_MODEL=opencode-go/qwen/qwen3.7-flash -> opencode-go
    expect(
      resolveCapability({ capability: "text", model: "opencode-go/qwen/qwen3.7-flash" })
    ).toEqual({
      capability: "text",
      provider: "opencode-go",
      model: "qwen/qwen3.7-flash",
      apiKeyEnv: "OPENCODE_GO_API_KEY",
    });

    // IMAGE_MODEL=openrouter/qwen/qwen3.7-flash -> openrouter
    expect(
      resolveCapability({ capability: "image", model: "openrouter/qwen/qwen3.7-flash" })
    ).toEqual({
      capability: "image",
      provider: "openrouter",
      model: "qwen/qwen3.7-flash",
      apiKeyEnv: "OPENROUTER_API_KEY",
    });
  });

  it("resolves each capability to the correct typed provider", () => {
    expect(
      resolveCapability({ capability: "moderation", model: "opencode-go/safety/guard" })
    ).toEqual({
      capability: "moderation",
      provider: "opencode-go",
      model: "safety/guard",
      apiKeyEnv: "OPENCODE_GO_API_KEY",
    });
  });

  it("allows either provider to serve any capability (generic binding)", () => {
    // OpenCode serving image — generic; not fixed by capability.
    expect(
      resolveCapability({ capability: "image", model: "opencode-go/qwen/qwen3_image" })
    ).toEqual({
      capability: "image",
      provider: "opencode-go",
      model: "qwen/qwen3_image",
      apiKeyEnv: "OPENCODE_GO_API_KEY",
    });

    // OpenRouter serving text — generic.
    expect(
      resolveCapability({ capability: "text", model: "openrouter/qwen/qwen3.7-flash" })
    ).toEqual({
      capability: "text",
      provider: "openrouter",
      model: "qwen/qwen3.7-flash",
      apiKeyEnv: "OPENROUTER_API_KEY",
    });
  });

  it("throws a config error for a model without a provider prefix (never silent)", () => {
    expect(() =>
      resolveCapability({ capability: "text", model: "qwen/qwen3.7-flash" })
    ).toThrowError(ProviderRoutingError);
  });

  it("throws a config error for an unknown provider prefix (never silent)", () => {
    expect(() =>
      resolveCapability({ capability: "text", model: "unknown-provider/qwen/qwen3.7-flash" })
    ).toThrowError(ProviderRoutingError);
  });

  it("throws a config error for an empty model", () => {
    expect(() => resolveCapability({ capability: "image", model: "" })).toThrowError(
      ProviderRoutingError
    );
  });

  it("throws for an invalid capability label", () => {
    expect(() =>
      resolveCapability({
        capability: "video" as Capability,
        model: "opencode-go/qwen/qwen3.7-flash",
      })
    ).toThrowError(ProviderRoutingError);
  });

  it("uses the model as provider for a bare (unprefixed) value after validation when no slash exists but prefix known", () => {
    // A value with no slash is rejected earlier; no default provider.
    expect(() => resolveCapability({ capability: "text", model: "opencode-go" })).toThrowError(
      ProviderRoutingError
    );
  });

  it("returns a typed Route of the documented shape", () => {
    const route: Route = resolveCapability({
      capability: "moderation",
      model: "openrouter/safety/guard",
    });
    expect(route.capability).toBe("moderation");
    expect(route.provider).toBe("openrouter");
    expect(route.model).toBe("safety/guard");
    expect(route.apiKeyEnv).toBe("OPENROUTER_API_KEY");
  });

  it("exposes the canonical ProviderId set", () => {
    expect(ProviderIdSet).toEqual(["opencode-go", "openrouter"]);
  });
});
