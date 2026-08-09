import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_DATA_URI_LENGTH,
  WEBP_DATA_URI_PREFIX,
  optimizeImageBytes,
} from "../../src/features/story-generation/server/image-optimizer";

/** 1×1 transparent PNG, decoded by the default lazy `sharp` encoder. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

/** A few non-empty raw bytes for the injected-encoder path. */
const NONEMPTY = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3]);

describe("image optimizer — transient WebP optimization", () => {
  it("optimizes raw bytes into an in-memory WebP data-URI", async () => {
    const dataUri = await optimizeImageBytes(NONEMPTY, {
      encoder: async (b) => b,
    });
    expect(dataUri).toBeTruthy();
    expect(dataUri?.startsWith(WEBP_DATA_URI_PREFIX)).toBe(true);
    // Transient only: a data-URI — never a file path or remote URL.
    expect(dataUri).not.toMatch(/^https?:|^\//);
    expect(dataUri).not.toContain("tmp");
  });

  it("returns null for empty input bytes", async () => {
    const dataUri = await optimizeImageBytes(new Uint8Array(0), {
      encoder: async (b) => b,
    });
    expect(dataUri).toBeNull();
  });

  it("returns null when the encoder yields an empty buffer", async () => {
    const dataUri = await optimizeImageBytes(NONEMPTY, {
      encoder: async () => new Uint8Array(0),
    });
    expect(dataUri).toBeNull();
  });

  it("guards the response size: rejects a data-URI over the configured cap", async () => {
    const big = new Uint8Array(8192);
    const dataUri = await optimizeImageBytes(big, {
      encoder: async (b) => b,
      maxDataUriLength: 64,
    });
    expect(dataUri).toBeNull();
  });

  it("defaults the response-size cap to DEFAULT_MAX_DATA_URI_LENGTH", async () => {
    const dataUri = await optimizeImageBytes(NONEMPTY, {
      encoder: async (b) => b,
    });
    expect(dataUri).toBeDefined();
    expect(dataUri!.length).toBeLessThanOrEqual(DEFAULT_MAX_DATA_URI_LENGTH);
  });
});

describe("image optimizer — default sharp encoder", () => {
  it("transcodes a valid encoded image to WebP with the lazy sharp encoder", async () => {
    const dataUri = await optimizeImageBytes(new Uint8Array(TINY_PNG));
    expect(dataUri).toBeTruthy();
    expect(dataUri?.startsWith(WEBP_DATA_URI_PREFIX)).toBe(true);
  });
});
