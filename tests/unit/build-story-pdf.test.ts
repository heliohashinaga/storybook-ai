import { afterEach, describe, expect, it, vi } from "vitest";
import type { GeneratedStory } from "../../src/features/story-generation/server/schemas";
import {
  buildStoryPdf,
  storyTitleToFilename,
} from "../../src/features/story-export/client/build-story-pdf";

const WEBP = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
const PNG = "data:image/png;base64,iVBORw0KGgo=";

/** Deterministic WebP → PNG converter for the tests (jsdom has no canvas). */
const toPng = async (uri: string): Promise<string> => (uri ? PNG : uri);

const story: GeneratedStory = {
  locale: "pt-BR",
  ageBand: "5-7",
  theme: "courage",
  sceneCount: 3,
  safetyDecision: "approved" as const,
  title: "A missão da estrelinha",
  scenes: [
    {
      ordinal: 1,
      title: "Cena 1",
      body: "Era uma vez uma estrelinha.",
      illustrationDataUri: WEBP,
      altText: "Uma estrelinha no céu.",
    },
    {
      ordinal: 2,
      title: "Cena 2",
      body: "Ela decidiu brilhar.",
      illustrationDataUri: WEBP,
      altText: "A estrelinha brilhando.",
    },
    {
      ordinal: 3,
      title: "Cena 3",
      body: "E o mar a abraçou.",
      illustrationDataUri: WEBP,
      altText: "O mar abraçando a estrelinha.",
    },
  ],
};

/** Shared, hoisted mock recorder for @react-pdf/renderer. */
const mockState = {
  tree: null as unknown,
  pdf: vi.fn(),
};
vi.mock("@react-pdf/renderer", () => {
  mockState.pdf.mockImplementation((node: unknown) => {
    mockState.tree = node;
    return mockState.pdf;
  });
  return {
    pdf: mockState.pdf,
    Document: "Document",
    Page: "Page",
    View: "View",
    Text: "Text",
    Image: "Image",
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // The shared pdf fake doubles as the default toBlob holder.
  (mockState.pdf as unknown as { toBlob?: () => Promise<Blob> }).toBlob = undefined;
});

/** jsdom-safe stubs for the browser-only defaultWebpToPng path. */
function stubDefaultWebpToPng({
  decodeFails = false,
  noCanvas = false,
}: { decodeFails?: boolean; noCanvas?: boolean } = {}) {
  const close = vi.fn();
  const fakeBitmap = { width: 2, height: 3, close };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ blob: async () => new Blob(["img"]) }))
  );
  vi.stubGlobal(
    "createImageBitmap",
    decodeFails
      ? vi.fn().mockRejectedValue(new Error("decode"))
      : vi.fn().mockResolvedValue(fakeBitmap)
  );
  if (!noCanvas) {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: () => {},
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(PNG);
  }
  return { close };
}

describe("buildStoryPdf — browser-only export (T042)", () => {
  it("composes a cover page plus one page per scene (never splits a scene)", async () => {
    const download = vi.fn();
    const toBlob = vi.fn(async () => new Blob(["pdf"], { type: "application/pdf" }));

    await buildStoryPdf(story, { toBlob, download, toPng });

    expect(mockState.pdf).toHaveBeenCalledTimes(1);
    const joined = JSON.stringify(mockState.tree);

    // Option A layout: a cover page (title + scene-1 art) then one A4 page per
    // scene, so a scene's illustration and text are never split across pages.
    const pageCount = joined.split('"type":"Page"').length - 1;
    expect(pageCount).toBe(1 + story.scenes.length);

    expect(joined).toContain("A missão da estrelinha");
    // Each scene page carries its own title heading.
    expect(joined).toContain("Cena 1");
    expect(joined).toContain("Cena 2");
    expect(joined).toContain("Cena 3");
    expect(joined).toContain("Era uma vez uma estrelinha");
    // The scene altText is NOT rendered in the PDF (it is a11y metadata only,
    // the illustration itself carries no visible alt caption).
    expect(joined).not.toContain("Uma estrelinha no céu");
    expect(joined).toContain("Ela decidiu brilhar");
    expect(joined).toContain("E o mar a abraçou");
    // Illustrations are converted to PNG before embedding so the PDF renders
    // them (`@react-pdf/renderer` does not reliably embed WebP). The scene-1
    // art doubles as the cover art, so its PNG appears on the cover and its
    // own scene page.
    const pngCount = joined.split(PNG).length - 1;
    expect(pngCount).toBe(1 + story.scenes.length);
    expect(joined).not.toContain("data:image/webp;base64,");
  });
  it("downloads a PDF under a slug filename and makes no network call", async () => {
    const download = vi.fn();
    const toBlob = vi.fn(async () => new Blob(["pdf"], { type: "application/pdf" }));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    const xhrSpy = vi.spyOn(globalThis, "XMLHttpRequest");

    const blob = await buildStoryPdf(story, { toBlob, download, toPng });

    expect(blob.type).toBe("application/pdf");
    expect(download).toHaveBeenCalledWith(blob, storyTitleToFilename(story));
    expect(download.mock.calls[0]?.[1]).toBe("a-missao-da-estrelinha.pdf");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("buildStoryPdf — default browser deps degrade gracefully (T038/jsdom-safe)", () => {
  /** Story whose illustrations are plain (decodable) WebP data URIs. */
  it("converts WebP art via defaultWebpToPng, closes the bitmap, and embeds PNG", async () => {
    const { close } = stubDefaultWebpToPng();
    // Default deps: real defaultWebpToPng + default toBlob (pdf fake carries .toBlob).
    const toBlob = vi.fn(async () => new Blob(["pdf"], { type: "application/pdf" }));
    (mockState.pdf as unknown as { toBlob?: () => Promise<Blob> }).toBlob = toBlob;

    const blob = await buildStoryPdf(story);

    expect(blob.type).toBe("application/pdf");
    // The bitmap is released once composed (finally).
    expect(close).toHaveBeenCalledTimes(story.scenes.length);
    const joined = JSON.stringify(mockState.tree);
    expect(joined).not.toContain("data:image/webp;base64,");
    expect(joined).toContain(PNG);
  });

  it("falls back to the original URI when the browser cannot decode WebP", async () => {
    stubDefaultWebpToPng({ decodeFails: true });
    const toBlob = vi.fn(async () => new Blob(["pdf"], { type: "application/pdf" }));
    (mockState.pdf as unknown as { toBlob?: () => Promise<Blob> }).toBlob = toBlob;

    await buildStoryPdf(story);

    // A valid image is never dropped: the WebP URI stays put.
    expect(JSON.stringify(mockState.tree)).toContain("data:image/webp;base64,");
  });

  it("passes non-WebP illustration URIs through unchanged (no decode attempt)", async () => {
    const pngStory: GeneratedStory = {
      ...story,
      scenes: story.scenes.map((scene) => ({ ...scene, illustrationDataUri: PNG })),
    };
    const toBlob = vi.fn(async () => new Blob(["pdf"], { type: "application/pdf" }));
    (mockState.pdf as unknown as { toBlob?: () => Promise<Blob> }).toBlob = toBlob;

    await buildStoryPdf(pngStory);

    expect(JSON.stringify(mockState.tree)).toContain(PNG);
    // No decode was attempted (fetch is never called for a non-WebP uri).
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await buildStoryPdf(pngStory, { toPng: async (uri) => uri });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps the WebP URI when the environment has no canvas 2D context", async () => {
    // jsdom has no real canvas: getContext returns null → defaultWebpToPng
    // (valid image never dropped) returns the original URI after decoding.
    const { close } = stubDefaultWebpToPng({ noCanvas: true });
    const toBlob = vi.fn(async () => new Blob(["pdf"], { type: "application/pdf" }));
    (mockState.pdf as unknown as { toBlob?: () => Promise<Blob> }).toBlob = toBlob;

    await buildStoryPdf(story);

    expect(JSON.stringify(mockState.tree)).toContain("data:image/webp;base64,");
    expect(close).toHaveBeenCalledTimes(story.scenes.length);
  });

  it("localizes the scene counter to the story language (en → 'Scene')", async () => {
    const enStory: GeneratedStory = { ...story, locale: "en" };
    stubDefaultWebpToPng();
    const toBlob = vi.fn(async () => new Blob(["pdf"], { type: "application/pdf" }));
    (mockState.pdf as unknown as { toBlob?: () => Promise<Blob> }).toBlob = toBlob;

    await buildStoryPdf(enStory);

    const joined = JSON.stringify(mockState.tree);
    // React serializes mixed children as an array: ["Scene"," ",1," of ",3].
    expect(joined).toContain('"children":["Scene"," ",1," of ",3]');
    expect(joined).not.toContain('"children":["Cena"," ",1," of ",3]');
  });
});
