import "server-only";
import { getEnv, modelWithoutProviderPrefix as stripPrefix } from "../../../lib/env";
import { postImages, toWebPDataUri } from "./provider-core";

/**
 * OpenCode illustration adapter (spec 005, T011b). Generate the optimized WebP
 * data-URI for a scene prompt when `ILLUSTRATOR_MODEL` routes to the `opencode-go`
 * provider prefix (`create-openrouter-illustration` covers `openrouter`).
 *
 * Transport + concurrency follow the same contract as the OpenRouter adapter
 * (ADR 0005: bounded concurrency in the caller keeps style consistent; this
 * function itself produces one illustration at a time).
 */

const IMAGE_TIMEOUT_MS = 60_000;

/** Overridable seams for deterministic tests (production defaults to env). */
export interface OpenCodeIllustrationDeps {
  apiKey?: string;
  imageModel?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function resolveDeps(deps: OpenCodeIllustrationDeps) {
  const requiresEnv = [deps.apiKey, deps.imageModel].some((value) => value === undefined);
  const env = requiresEnv ? getEnv() : null;
  return {
    apiKey: deps.apiKey ?? env?.OPENCODE_GO_API_KEY ?? "",
    imageModel: deps.imageModel ?? (env ? stripPrefix(env.ILLUSTRATOR_MODEL) : ""),
    baseUrl: deps.baseUrl ?? "https://opencode.ai/zen/go/v1",
    timeoutMs: deps.timeoutMs ?? IMAGE_TIMEOUT_MS,
    fetchImpl: deps.fetchImpl ?? fetch,
  };
}

/**
 * Creates the OpenCode illustration function. Returns a function that produces
 * an optimized `data:image/webp;base64,...` URI for one scene prompt.
 */
export function createOpenCodeIllustration(
  deps: OpenCodeIllustrationDeps = { timeoutMs: IMAGE_TIMEOUT_MS }
): (prompt: string) => Promise<{ dataUri: string }> {
  return async (prompt: string): Promise<{ dataUri: string }> => {
    const { apiKey, imageModel, baseUrl, timeoutMs, fetchImpl } = resolveDeps(deps);

    const raw = await postImages({
      baseUrl,
      apiKey,
      imageModel,
      prompt,
      timeoutMs,
      fetchImpl,
    });

    const dataUri = await toWebPDataUri(raw);
    return { dataUri };
  };
}
