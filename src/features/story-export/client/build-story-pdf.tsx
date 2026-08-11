"use client";

import type { GeneratedStory } from "../../story-generation/server/schemas";

/**
 * Browser-only PDF export (T042).
 *
 * Composes a printable PDF from the in-memory story. `@react-pdf/renderer` is
 * lazy-imported here so it never lands in the initial bundle (<250 KiB gzip
 * budget, per AGENTS.md). One server document is built per story: a title,
 * one page per scene, each with its scene body and WebP illustration.
 *
 * The module is browser-only: the PDF is rendered and downloaded client-side;
 * nothing is sent over the network or persisted. The PDF-builder and
 * downloader are injectable so tests can assert the composed content and that
 * no network call happens (T038), without pulling in the real renderer.
 */

export interface StoryPdfDeps {
  /** Serialize the composed PDF to a Blob. Optional — defaults to the
   *  browser renderer's toBlob(). Tests inject a deterministic impl. */
  toBlob?: (theming: unknown) => Promise<Blob>;
  /** Trigger the browser download. Defaults to a no-op. */
  download?: (blob: Blob, filename: string) => void;
}

const defaultDeps: StoryPdfDeps = {
  async toBlob(pdfResult) {
    // pdfResult is the object returned by @react-pdf/renderer's pdf(document),
    // which exposes .toBlob() in the browser. No network; renders locally.
    return (pdfResult as { toBlob?: () => Promise<Blob> }).toBlob!();
  },
  download: () => {},
};

export async function buildStoryPdf(
  story: GeneratedStory,
  deps: StoryPdfDeps = defaultDeps
): Promise<Blob> {
  const { pdf, Document, Page, Text, View, Image } = await import("@react-pdf/renderer");

  const node = (
    <Document>
      <Page size="A4" style={{ padding: 32 }}>
        <View>
          <Text style={{ fontSize: 24, marginBottom: 24 }}>{story.title}</Text>
          {story.scenes.map((scene) => (
            <View key={scene.ordinal} style={{ marginBottom: 20 }}>
              {scene.illustrationDataUri ? (
                // The PDF Image (`@react-pdf/renderer`) does not accept `alt`;
                // its a11y is provided by the adjacent Text line (altText).
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={scene.illustrationDataUri} style={{ height: 160, marginBottom: 8 }} />
              ) : null}
              <Text style={{ fontSize: 11, color: "#666" }}>
                Scene {scene.ordinal} of {story.scenes.length}
              </Text>
              <Text style={{ fontSize: 13, marginTop: 6, color: "#333" }}>{scene.altText}</Text>
              <Text style={{ fontSize: 14, marginTop: 8 }}>{scene.body}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );

  // Merge with defaults so optional deps degrade to the browser renderer.
  const toBlob = deps.toBlob ?? defaultDeps.toBlob!;
  const download = deps.download ?? defaultDeps.download!;
  const blob = await toBlob(pdf(node));
  download(blob, storyTitleToFilename(story));
  return blob;
}

export function storyTitleToFilename(story: GeneratedStory): string {
  // ASCII-only slug: strip accents before mapping to hyphens.
  const base = story.title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "story"}.pdf`;
}
