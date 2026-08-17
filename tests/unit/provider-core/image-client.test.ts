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

  it("sends the OpenRouter app identity header (X-Title)", async () => {
    const { fetchImpl, calls } = createFakeFetch(() =>
      jsonResponse({ data: [{ b64_json: WEBP_B64, media_type: "image/webp" }] })
    );
    await postImages({ ...baseReq, fetchImpl });
    const headers = new Headers(calls[0]!.init.headers);
    expect(headers.get("x-title")).toBe("storybook-ai");
    expect(headers.has("http-referer")).toBe(false);
  });

  it("fetches bytes from url when b64_json is absent (public https host)", async () => {
    const { fetchImpl, calls } = createFakeFetch(({ url }) => {
      if (url.includes("/images")) {
        return jsonResponse({ data: [{ url: "https://cdn.cloudflare.com/img.webp" }] });
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/webp" },
      });
    });
    const result = await postImages({
      ...baseReq,
      fetchImpl,
      urlSafetyResolver: async () => ["1.2.3.4"],
    });
    expect(calls).toHaveLength(2);
    expect(calls[1]!.url).toBe("https://cdn.cloudflare.com/img.webp");
    expect(result.mediaType).toBe("image/webp");
  });

  it("refuses to fetch a provider-returned URL that is not a public https host (SSRF)", async () => {
    const { fetchImpl, calls } = createFakeFetch(({ url }) => {
      if (url.includes("/images")) {
        return jsonResponse({ data: [{ url: "https://169.254.169.254/latest/meta-data" }] });
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/webp" },
      });
    });
    await expect(
      postImages({ ...baseReq, fetchImpl, urlSafetyResolver: async () => [] })
    ).rejects.toMatchObject({ kind: "unsafe-url" });
    // The inner image URL was never fetched.
    expect(calls.filter((c) => c.url.includes("169.254"))).toHaveLength(0);
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

  it("re-validates an image URL redirect target (SSRF) and refuses internal/metadata hops", async () => {
    const { fetchImpl, calls } = createFakeFetch(({ url }) => {
      if (url.includes("/images")) {
        return jsonResponse({ data: [{ url: "https://cdn.cloudflare.com/img.webp" }] });
      }
      // First hop: a public CDN that redirects to cloud-metadata/private.
      return new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data/iam/credentials" },
      });
    });
    await expect(
      postImages({
        ...baseReq,
        fetchImpl,
        urlSafetyResolver: async () => ["1.2.3.4"],
      })
    ).rejects.toMatchObject({ kind: "unsafe-url" });
    // The internal redirect target was never fetched.
    expect(calls.filter((c) => c.url.includes("169.254"))).toHaveLength(0);
  });

  it("follows a single re-validated image URL redirect hop and returns the image bytes", async () => {
    const { fetchImpl, calls } = createFakeFetch(({ url }) => {
      if (url.includes("/images")) {
        return jsonResponse({ data: [{ url: "https://cdn.example.com/start.webp" }] });
      }
      if (url.includes("/start.webp")) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://cdn.example.com/final.webp" },
        });
      }
      return new Response(new Uint8Array([9, 8, 7]), {
        status: 200,
        headers: { "content-type": "image/webp" },
      });
    });
    const result = await postImages({
      ...baseReq,
      fetchImpl,
      urlSafetyResolver: async () => ["93.184.216.34"],
    });
    expect(calls.filter((c) => c.url.includes("/final.webp"))).toHaveLength(1);
    expect(new Uint8Array(result.bytes)).toEqual(new Uint8Array([9, 8, 7]));
    expect(result.mediaType).toBe("image/webp");
  });

  it("caps image URL redirects at one hop and rejects a second redirect (SSRF)", async () => {
    const { fetchImpl, calls } = createFakeFetch(({ url }) => {
      if (url.includes("/images")) {
        return jsonResponse({ data: [{ url: "https://cdn.example.com/a.webp" }] });
      }
      if (url.includes("/a.webp")) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://cdn.example.com/b.webp" },
        });
      }
      if (url.includes("/b.webp")) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://cdn.example.com/c.webp" },
        });
      }
      return new Response(new Uint8Array([1]), { status: 200 });
    });
    await expect(
      postImages({
        ...baseReq,
        fetchImpl,
        urlSafetyResolver: async () => ["93.184.216.34"],
      })
    ).rejects.toMatchObject({ kind: "unsafe-url" });
    // The second redirect was never followed.
    expect(calls.filter((c) => c.url.includes("/c.webp"))).toHaveLength(0);
  });
});
