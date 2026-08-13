import "server-only";
import { getEnv, modelWithoutProviderPrefix as stripPrefix } from "../../../lib/env";
import { ProviderError } from "./story-generation-provider";

/**
 * OpenCode illustration adapter (spec 005, T011b). Generate the optimized WebP
 * data-URI for a scene prompt when `IMAGE_MODEL` routes to the `opencode-go`
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

/** Lazily loads sharp only when a transcode is actually required. */
async function defaultImageEncoder(bytes: Uint8Array, mediaType: string | undefined) {
  let sharp: (typeof import("sharp"))["default"];
  try {
    ({ default: sharp } = await import("sharp"));
  } catch {
    // sharp is optional in dev/tests; if WebP is already present we don't need it.
    return { bytes, mediaType };
  }
  const data = await sharp(Buffer.from(bytes)).webp().toBuffer();
  return { bytes: new Uint8Array(data), mediaType: "image/webp" };
}

function resolveDeps(deps: OpenCodeIllustrationDeps) {
  const requiresEnv = [deps.apiKey, deps.imageModel].some((value) => value === undefined);
  const env = requiresEnv ? getEnv() : null;
  return {
    apiKey: deps.apiKey ?? env?.OPENCODE_GO_API_KEY ?? "",
    imageModel: deps.imageModel ?? (env ? stripPrefix(env.IMAGE_MODEL) : ""),
    baseUrl: deps.baseUrl ?? "https://opencode.ai/zen/go/v1",
    timeoutMs: deps.timeoutMs ?? IMAGE_TIMEOUT_MS,
    fetchImpl: deps.fetchImpl ?? fetch,
  };
}

function toProviderError(error: unknown): never {
  if (error instanceof ProviderError) throw error;
  throw new ProviderError("unavailable", "Provocateur image provider failed.");
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

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      Number.isFinite(timeoutMs) ? timeoutMs : IMAGE_TIMEOUT_MS
    );
    try {
      const response = await fetchImpl(`${baseUrl}/images`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: imageModel,
          prompt,
          n: 1,
          output_format: "webp",
          aspect_ratio: "1:1",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ProviderError("unavailable", "Image provider was unavailable.");
      }

      const json = (await response.json()) as {
        data?: { b64_json?: string; url?: string; media_type?: string }[];
      };
      const first = json.data?.[0];

      let bytes: Uint8Array;
      let mediaType: string | undefined;
      if (typeof first?.b64_json === "string") {
        bytes = Buffer.from(first.b64_json, "base64");
        mediaType = first.media_type;
      } else if (typeof first?.url === "string") {
        const imageResponse = await fetchImpl(first.url, { signal: controller.signal });
        if (!imageResponse.ok) {
          throw new ProviderError("unavailable", "Image URL could not be fetched.");
        }
        bytes = new Uint8Array(await imageResponse.arrayBuffer());
        mediaType = imageResponse.headers.get("content-type") ?? undefined;
      } else {
        throw new ProviderError("unavailable", "Image provider returned no data.");
      }

      const { bytes: finalBytes } = await defaultImageEncoder(bytes, mediaType);
      return { dataUri: `data:image/webp;base64,${Buffer.from(finalBytes).toString("base64")}` };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (controller.signal.aborted) {
        throw new ProviderError("timeout", "Image generation timed out.");
      }
      toProviderError(error as Error);
    } finally {
      clearTimeout(timer);
    }
  };
}
