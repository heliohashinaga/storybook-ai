import { describe, expect, it, vi } from "vitest";
import type { GeneratedStory } from "../../src/features/story-generation/server/schemas";
import {
  buildStoryPdf,
  storyTitleToFilename,
} from "../../src/features/story-export/client/build-story-pdf";

const WEBP = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

const story: GeneratedStory = {
  locale: "pt-BR",
  ageBand: "5-7",
  theme: "courage",
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

describe("buildStoryPdf — browser-only export (T042)", () => {
  it("composes the title, every scene body and alt text, and the 3 illustrations", async () => {
    const download = vi.fn();
    const toBlob = vi.fn(async () => new Blob(["pdf"], { type: "application/pdf" }));

    await buildStoryPdf(story, { toBlob, download });

    expect(mockState.pdf).toHaveBeenCalledTimes(1);
    const joined = JSON.stringify(mockState.tree);

    expect(joined).toContain("A missão da estrelinha");
    expect(joined).toContain("Uma estrelinha no céu");
    expect(joined).toContain("Ela decidiu brilhar");
    expect(joined).toContain("E o mar a abraçou");
    const imgCount = joined.split("data:image/webp;base64,").length - 1;
    expect(imgCount).toBe(3);
  });

  it("downloads a PDF under a slug filename and makes no network call", async () => {
    const download = vi.fn();
    const toBlob = vi.fn(async () => new Blob(["pdf"], { type: "application/pdf" }));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    const xhrSpy = vi.spyOn(globalThis, "XMLHttpRequest");

    const blob = await buildStoryPdf(story, { toBlob, download });

    expect(blob.type).toBe("application/pdf");
    expect(download).toHaveBeenCalledWith(blob, storyTitleToFilename(story));
    expect(download.mock.calls[0]?.[1]).toBe("a-missao-da-estrelinha.pdf");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
