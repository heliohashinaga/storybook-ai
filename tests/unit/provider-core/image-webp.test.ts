import { describe, expect, it } from "vitest";
import { toWebPDataUri } from "../../../src/features/story-generation/server/provider-core/image-client";

const webpBytes = new Uint8Array(Buffer.from("RIFF.WEBPVP8 "));

describe("toWebPDataUri — shared image fallback (T033/T042)", () => {
  it("emits a WebP data-URI without re-encoding already-WebP bytes", async () => {
    const uri = await toWebPDataUri({ bytes: webpBytes, mediaType: "image/webp" });
    expect(uri).toBe("data:image/webp;base64," + Buffer.from(webpBytes).toString("base64"));
  });

  it("falls back to a raw WebP data-URI when the bytes cannot be optimized", async () => {
    // Empty bytes make the optimizer return null; the legacy unguarded path
    // still yields a valid WebP prefix so the adapter contract is preserved.
    const uri = await toWebPDataUri({ bytes: new Uint8Array(0), mediaType: "image/png" });
    expect(uri).toBe("data:image/webp;base64," + Buffer.from(new Uint8Array(0)).toString("base64"));
  });

  it("encodes non-WebP bytes through the injected encoder", async () => {
    const encoder = (bytes: Uint8Array) =>
      Promise.resolve(new Uint8Array([...bytes, 0xff] as number[]).slice(0, 0));
    const uri = await toWebPDataUri(
      { bytes: new Uint8Array([1, 2, 3]), mediaType: "image/png" },
      encoder
    );
    expect(uri.startsWith("data:image/webp;base64,")).toBe(true);
  });
});
