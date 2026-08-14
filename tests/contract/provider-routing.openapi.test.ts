import { describe, expect, it } from "vitest";
import {
  resolveCapability,
  ProviderRoutingError,
} from "../../src/features/story-generation/server/provider-routing";
import type { Capability } from "../../src/features/story-generation/server/provider-routing";
import { PROVIDER_IDS } from "../../src/lib/env";

/**
 * Contract test for `contracts/provider-routing.openapi.yaml` (spec 005, T009).
 * The routing contract is internal to the server: it derives the concrete
 * provider + effective model + apiKeyEnv for a capability from the `*_MODEL`
 * env value using the `provider/rest` convention, with no default provider.
 */
describe("provider-routing contract", () => {
  it("resolves the OpenAPI acceptance examples exactly", () => {
    // TEXT_MODEL=opencode-go/qwen/qwen3.7-flash -> provider opencode-go
    expect(
      resolveCapability({ capability: "text", model: "opencode-go/qwen/qwen3.7-flash" })
    ).toEqual({
      capability: "text",
      provider: "opencode-go",
      model: "qwen/qwen3.7-flash",
      apiKeyEnv: "OPENCODE_GO_API_KEY",
    });
    // IMAGE_MODEL=openrouter/qwen/qwen3.7-flash -> provider openrouter
    expect(
      resolveCapability({ capability: "image", model: "openrouter/qwen/qwen3.7-flash" })
    ).toEqual({
      capability: "image",
      provider: "openrouter",
      model: "qwen/qwen3.7-flash",
      apiKeyEnv: "OPENROUTER_API_KEY",
    });
  });

  it("serves every capability by either provider (generic binding)", () => {
    const providers = PROVIDER_IDS;
    const capabilities: Capability[] = ["text", "moderation", "image"];
    for (const capability of capabilities) {
      for (const provider of providers) {
        const route = resolveCapability({
          capability,
          model: `${provider}/some/org/model`,
        });
        expect(route.provider).toBe(provider);
        expect(route.model).toBe("some/org/model");
        expect(route.apiKeyEnv).toBe(
          provider === "opencode-go" ? "OPENCODE_GO_API_KEY" : "OPENROUTER_API_KEY"
        );
      }
    }
  });

  it("rejects an unprefixed model as a boot config error (never silent)", () => {
    for (const capability of ["text", "moderation", "image"] as Capability[]) {
      expect(() => resolveCapability({ capability, model: "qwen/qwen3.7-flash" })).toThrowError(
        ProviderRoutingError
      );
    }
  });

  it("rejects an unknown provider prefix as a boot config error (never silent)", () => {
    expect(() =>
      resolveCapability({ capability: "text", model: "some-vendor/qwen/qwen3.7-flash" })
    ).toThrowError(ProviderRoutingError);
  });

  it("rejects an empty model and an unknown capability label", () => {
    expect(() => resolveCapability({ capability: "text", model: "" })).toThrowError(
      ProviderRoutingError
    );
    expect(() =>
      resolveCapability({
        capability: "video" as Capability,
        model: "opencode-go/qwen/qwen3.7-flash",
      })
    ).toThrowError(ProviderRoutingError);
  });

  it("strips the provider prefix from the effective model sent to the provider", () => {
    const route = resolveCapability({
      capability: "moderation",
      model: "openrouter/some/org/moderation-model",
    });
    expect(route.model).toBe("some/org/moderation-model");
  });
});
