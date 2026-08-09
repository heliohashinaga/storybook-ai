import "server-only";

/**
 * Transient WebP image optimization and response-size guarding (T026).
 *
 * Converts raw illustration bytes into a bounded WebP data-URI that lives
 * only in memory — it is never persisted, logged, or written to disk. The
 * encoding step is injectable so tests stay deterministic (no native `sharp`
 * dependency required); in production it defaults to a lazily-imported
 * `sharp` that downsizes oversized artwork and encodes WebP.
 *
 * The optimizer also guards the serialized response size: if the optimized
 * data-URI still exceeds the cap, it returns `null` so the generation
 * orchestrator treats the illustration as missing and retries the whole set.
 * An oversized illustration is never returned to the reader.
 */

export const WEBP_DATA_URI_PREFIX = "data:image/webp;base64,";

/** Default cap for a single serialized WebP data-URI (responses stay bounded). */
export const DEFAULT_MAX_DATA_URI_LENGTH = 4 * 1024 * 1024;

/** Longest output side used when the default sharp encoder downsizes (px). */
export const DEFAULT_MAX_DIMENSION = 1024;

/** WebP encoder seam. Takes raw bytes, returns optimized WebP bytes. */
export interface ImageEncoder {
  (bytes: Uint8Array): Promise<Uint8Array>;
}

export interface OptimizeImageOptions {
  /** Injected WebP encoder; defaults to a lazy `sharp` import. */
  encoder?: ImageEncoder;
  /** Max serialized data-URI length; optimized results beyond this are rejected. */
  maxDataUriLength?: number;
  /** Longest output side used by the default sharp encoder (px). */
  maxDimension?: number;
}

/**
 * Default encoder: lazily imports `sharp` (only on first use, never in the
 * initial bundle) and downsizes the longest side to `maxDimension` before
 * encoding WebP. Returns a view over the encoded buffer.
 */
async function defaultSharpEncoder(bytes: Uint8Array, maxDimension: number): Promise<Uint8Array> {
  const { default: sharp } = await import("sharp");
  const buffer = await sharp(Buffer.from(bytes))
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp()
    .toBuffer();
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

/**
 * Optimizes raw illustration bytes to a bounded, in-memory WebP data-URI.
 * Returns `null` when the input is empty, the encoder fails to produce WebP
 * bytes, or the serialized data-URI exceeds `maxDataUriLength`.
 */
export async function optimizeImageBytes(
  bytes: Uint8Array,
  options: OptimizeImageOptions = {}
): Promise<string | null> {
  const limit = options.maxDataUriLength ?? DEFAULT_MAX_DATA_URI_LENGTH;

  if (bytes.byteLength === 0) return null;

  const encode =
    options.encoder ??
    ((b: Uint8Array) => defaultSharpEncoder(b, options.maxDimension ?? DEFAULT_MAX_DIMENSION));

  const webp = await encode(bytes);
  if (webp.byteLength === 0) return null;

  const dataUri = `${WEBP_DATA_URI_PREFIX}${Buffer.from(webp).toString("base64")}`;
  return dataUri.length <= limit ? dataUri : null;
}
