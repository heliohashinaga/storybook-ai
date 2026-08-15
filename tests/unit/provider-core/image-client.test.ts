// @vitest-environment node
import { describe, expect, it } from "vitest";
import { postImages } from "../../../src/features/story-generation/server/provider-core/image-client";
import { ProviderError } from "../../../src/features/story-generation/server/story-generation-provider";

type Call = { url: string; init: RequestInit; body: unknown };

function createFakeFetch(respond: (call: { url: string; body: unknown }) => Response): {
  fetchImpl: typeof fetch;
  calls: Call[];
} {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, init: init ?? {}, body });
    return respond({ url, body });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// A tiny 1x1 WebP, base64-encoded.
const WEBP_B64 = "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=";

const baseReq = {
  baseUrl: "https://provider.test/v1",
  apiKey: "sk-test",
  imageModel: "model-x",
  prompt: "a soft watercolor fox",
};

describe("provider-core image-client postImages", () => {
  it("POSTs the shared /images body and returns bytes from b64_json", async () => {
    const { fetchImpl, calls } = createFakeFetch(() =>
      jsonResponse({ data: [{ b64_json: WEBP_B64, media_type: "image/webp" }] })
    );
    const result = await postImages({ ...baseReq, fetchImpl });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://provider.test/v1/images");
    expect(calls[0]!.body).toEqual({
      model: "model-x",
      prompt: "a soft watercolor fox",
      n: 1,
      output_format: "webp",
      aspect_ratio: "1:1",
    });
    expect(new Headers(calls[0]!.init.headers).get("authorization")).toBe("Bearer sk-test");
    expect(result).toMatchObject({ bytes: expect.any(Uint8Array) });
  });

  it("fetches bytes from url when b64_json is absent", async () => {
    const { fetchImpl, calls } = createFakeFetch(({ url }) => {
      if (url.includes("/images")) {
        return jsonResponse({ data: [{ url: "https://cdn.test/img.webp" }] });
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/webp" },
      });
    });
    const result = await postImages({ ...baseReq, fetchImpl });
    expect(calls).toHaveLength(2);
    expect(calls[1]!.url).toBe("https://cdn.test/img.webp");
    expect(result.mediaType).toBe("image/webp");
  });

  it("throws ProviderError when the provider is unavailable", async () => {
    const { fetchImpl } = createFakeFetch(() => jsonResponse({ error: "boom" }, 503));
    await expect(postImages({ ...baseReq, fetchImpl })).rejects.toBeInstanceOf(ProviderError);
  });

  it("throws ProviderError when no image data is returned", async () => {
    const { fetchImpl } = createFakeFetch(() => jsonResponse({ data: [] }));
    await expect(postImages({ ...baseReq, fetchImpl })).rejects.toBeInstanceOf(ProviderError);
  });

  it("throws timeout ProviderError when the request is aborted", async () => {
    const { fetchImpl } = createFakeFetch(() => {
      throw new Error("aborted");
    });
    await expect(postImages({ ...baseReq, fetchImpl, timeoutMs: 1 })).rejects.toBeInstanceOf(
      ProviderError
    );
  });
});
