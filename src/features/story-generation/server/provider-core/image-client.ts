import "server-only";
import { ProviderError } from "../story-generation-provider";
import { OPENROUTER_APP_HEADERS } from "./app-identity";
import {
  DEFAULT_MAX_DATA_URI_LENGTH,
  WEBP_DATA_URI_PREFIX,
  optimizeImageBytes,
} from "../image-optimizer";
import { isSafeImageUrl, type UrlResolver } from "./url-safety";

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
  /**
   * Overridable DNS resolver for the SSRF guard (CWE-918). Defaults to the
   * real `node:dns` lookup; tests inject a fixed set to stay hermetic.
   */
  urlSafetyResolver?: UrlResolver;
}

/**
 * Shared `/images` transport (FR-003). POSTs the documented body
 * `{model, prompt, n:1, output_format:"webp", aspect_ratio:"1:1"}` and parses
 * the response (`data[].b64_json` or `data[].url`) into `{bytes, mediaType}`.
 * Timeout is enforced with an AbortController; every failure maps to a typed
 * {@link ProviderError}.
 */
export async function postImages(request: PostImagesRequest): Promise<RawImage> {
  const { baseUrl, apiKey, imageModel, prompt, fetchImpl = fetch, urlSafetyResolver } = request;
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
        ...OPENROUTER_APP_HEADERS,
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

    return await renderImagePayload(json, fetchImpl, urlSafetyResolver, controller.signal);
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

/** True when an HTTP status is a 3xx response. */
function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

/**
 * Renders the provider's `/images` JSON payload into a {@link RawImage},
 * handling both `b64_json` and `url` (SSRF-guarded) response shapes.
 */
async function renderImagePayload(
  json: { data?: { b64_json?: string; url?: string; media_type?: string }[] },
  fetchImpl: typeof fetch,
  urlSafetyResolver: UrlResolver | undefined,
  signal: AbortSignal
): Promise<RawImage> {
  const first = json.data?.[0];

  if (typeof first?.b64_json === "string") {
    return {
      bytes: Buffer.from(first.b64_json, "base64"),
      mediaType: first.media_type,
    };
  }

  if (typeof first?.url === "string") {
    return renderUrlPayload(first.url, fetchImpl, urlSafetyResolver, signal);
  }

  throw new ProviderError("unavailable", "Image provider returned no data.");
}

/**
 * Fetches an SSRF-guarded provider-returned URL (CWE-918). The provider is a
 * third party subject to prompt injection, so only https URLs that resolve
 * entirely to public hosts are fetched.
 */
async function renderUrlPayload(
  url: string,
  fetchImpl: typeof fetch,
  urlSafetyResolver: UrlResolver | undefined,
  signal: AbortSignal
): Promise<RawImage> {
  const imageResponse = await fetchSafeImage(url, fetchImpl, urlSafetyResolver, signal);
  if (!imageResponse.ok) {
    throw new ProviderError("unavailable", "Image URL could not be fetched.");
  }
  return {
    bytes: new Uint8Array(await imageResponse.arrayBuffer()),
    mediaType: imageResponse.headers.get("content-type") ?? undefined,
  };
}

/**
 * Validated fetch of a provider-returned image URL with a bounded redirect chain.
 *
 * SSRF guard (CWE-918): the original URL is validated with {@link isSafeImageUrl},
 * but the global `fetch` follows redirects by default without re-validation.
 * A hostile/prompt-injected provider could return a public URL that `3xx`
 * redirects to an internal/cloud-metadata host. So we fetch with
 * `redirect: "manual"` and, on a 3xx, **re-validate the `Location` target**
 * against the same url-safety resolver before following, capped at a single
 * hop (a chained second redirect is refused). Non-2xx responses fall through
 * to the caller's `.ok` handling. The final body is fetched exactly once.
 */
async function fetchSafeImage(
  url: string,
  fetchImpl: typeof fetch,
  urlSafetyResolver: UrlResolver | undefined,
  signal: AbortSignal
): Promise<Response> {
  if (!(await isSafeImageUrl(url, urlSafetyResolver))) {
    throw new ProviderError("unsafe-url", "Refusing to fetch a non-public image URL.");
  }

  const first = await fetchImpl(url, { signal, redirect: "manual" });
  if (!isRedirectStatus(first.status)) return first;

  // Follow exactly one re-validated hop.
  const location = first.headers.get("location");
  if (!location) {
    throw new ProviderError("unsafe-url", "Image URL redirect has no target.");
  }
  const target = new URL(location, url).href;
  if (!(await isSafeImageUrl(target, urlSafetyResolver))) {
    throw new ProviderError("unsafe-url", "Image URL redirect target is not a public https host.");
  }
  const second = await fetchImpl(target, { signal, redirect: "manual" });
  if (isRedirectStatus(second.status)) {
    throw new ProviderError("unsafe-url", "Image URL redirects may not chain (max 1 hop).");
  }
  return second;
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
