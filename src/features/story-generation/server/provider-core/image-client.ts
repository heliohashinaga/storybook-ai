import "server-only";
import { ProviderError } from "../story-generation-provider";
import {
  DEFAULT_MAX_DATA_URI_LENGTH,
  WEBP_DATA_URI_PREFIX,
  optimizeImageBytes,
} from "../image-optimizer";

/** Raw image payload as returned by a provider's `/images` endpoint. */
export interface RawImage {
  bytes: Uint8Array;
  mediaType?: string;
}

/** WebP encoder seam: raw bytes → WebP bytes (Buffer works, it is a Uint8Array). */
export type WebPEncoder = (bytes: Uint8Array) => Promise<Uint8Array>;

export interface PostImagesRequest {
  baseUrl: string;
  apiKey: string;
  imageModel: string;
  prompt: string;
  /** Defaults to 60_000; overridden per adapter when needed (e.g. 120 s images). */
  timeoutMs?: number;
  /** Replaceable transport; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Shared `/images` transport (FR-003). POSTs the documented body
 * `{model, prompt, n:1, output_format:"webp", aspect_ratio:"1:1"}` and parses
 * the response (`data[].b64_json` or `data[].url`) into `{bytes, mediaType}`.
 * Timeout is enforced with an AbortController; every failure maps to a typed
 * {@link ProviderError}.
 */
export async function postImages(request: PostImagesRequest): Promise<RawImage> {
  const { baseUrl, apiKey, imageModel, prompt, fetchImpl = fetch } = request;
  const timeoutMs = request.timeoutMs ?? 60_000;

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Number.isFinite(timeoutMs) ? timeoutMs : 60_000
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

    if (typeof first?.b64_json === "string") {
      return {
        bytes: Buffer.from(first.b64_json, "base64"),
        mediaType: first.media_type,
      };
    }

    if (typeof first?.url === "string") {
      const imageResponse = await fetchImpl(first.url, { signal: controller.signal });
      if (!imageResponse.ok) {
        throw new ProviderError("unavailable", "Image URL could not be fetched.");
      }
      return {
        bytes: new Uint8Array(await imageResponse.arrayBuffer()),
        mediaType: imageResponse.headers.get("content-type") ?? undefined,
      };
    }

    throw new ProviderError("unavailable", "Image provider returned no data.");
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (controller.signal.aborted) {
      throw new ProviderError("timeout", "Image generation timed out.");
    }
    throw new ProviderError("unavailable", "Image provider was unavailable.");
  } finally {
    clearTimeout(timer);
  }
}

/** True when a raw image buffer already carries the WebP container signature. */
export function isWebP(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 //  P
  );
}

const identity = (bytes: Uint8Array) => Promise.resolve(bytes);

/**
 * Normalizes raw image bytes into a `data:image/webp;base64,...` URI.
 *
 * Already-WebP bytes (by signature or media type) pass through unchanged so the
 * serialized URI matches the upstream payload exactly. Other payloads go
 * through the provided encoder (or the shared `image-optimizer` default sharp
 * encoder). The result is run through `optimizeImageBytes` (T012) so the
 * canonical optimizer is exercised in the real generation path; if the guard
 * rejects the payload (e.g. oversized), the legacy unguarded URI is produced so
 * adapter behavior is preserved (the orchestrator's own 4 MiB check still
 * applies downstream, ADR 0005 / illustrator.ts).
 */
export async function toWebPDataUri(raw: RawImage, encoder?: WebPEncoder): Promise<string> {
  const alreadyWebP = raw.mediaType?.includes("webp") || isWebP(raw.bytes);
  const dataUri = await optimizeImageBytes(raw.bytes, {
    encoder: alreadyWebP ? identity : encoder,
    maxDataUriLength: DEFAULT_MAX_DATA_URI_LENGTH,
  });
  if (dataUri !== null) return dataUri;
  // Oversized/empty edge: keep the legacy behavior (unguarded) so the adapter
  // contract is unchanged; the orchestrator guards the size downstream.
  return `${WEBP_DATA_URI_PREFIX}${Buffer.from(raw.bytes).toString("base64")}`;
}
