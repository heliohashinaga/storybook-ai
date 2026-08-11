"use client";

import type { GeneratedStory } from "../../story-generation/server/schemas";

/**
 * Browser-only PDF export (T042).
 *
 * Composes a printable PDF from the in-memory story. `@react-pdf/renderer` is
 * lazy-imported here so it never lands in the initial bundle (<250 KiB gzip
 * budget, per AGENTS.md). One server document is built per story: a title,
 * one page per scene, each with its scene body and illustration.
 *
 * The module is browser-only: the PDF is rendered and downloaded client-side;
 * nothing is sent over the network or persisted. The PDF-builder, downloader,
 * and image converter are injectable so tests can assert the composed content
 * and that no network call happens (T038), without pulling in the real
 * renderer.
 */

export interface StoryPdfDeps {
  /** Serialize the composed PDF to a Blob. Optional — defaults to the
   *  browser renderer's toBlob(). Tests inject a deterministic impl. */
  toBlob?: (theming: unknown) => Promise<Blob>;
  /** Trigger the browser download. Defaults to a no-op. */
  download?: (blob: Blob, filename: string) => void;
  /** Convert a WebP image data-URI to a PNG data-URI for the PDF. `@react-pdf/
   *  renderer` embeds PNG/JPEG reliably but not WebP, so illustrations are
   *  re-encoded client-side (no network) before composing the document.
   *  Optional — defaults to a canvas/createImageBitmap impl; tests inject a
   *  deterministic stub. */
  toPng?: (webpUri: string) => Promise<string>;
}

const WEBP_DATA_URI_PREFIX = "data:image/webp;base64,";

/**
 * Converts a WebP data-URI to a PNG data-URI in the browser, so the PDF can
 * embed the illustration (`@react-pdf/renderer` does not reliably embed WebP).
 * Uses createImageBitmap + canvas (both decode WebP and encode PNG) — fully
 * client-side, no network, no extra bundle. Returns the uri unchanged if it is
 * not WebP or cannot be converted, so a valid image is never dropped.
 */
async function defaultWebpToPng(webpUri: string): Promise<string> {
  if (!webpUri.startsWith(WEBP_DATA_URI_PREFIX)) return webpUri;
  const decoded = await createImageBitmap(await (await fetch(webpUri)).blob()).catch(() => null);
  if (!decoded) return webpUri;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return webpUri;
    ctx.drawImage(decoded, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    decoded.close();
  }
}

const defaultDeps: StoryPdfDeps = {
  async toBlob(pdfResult) {
    // pdfResult is the object returned by @react-pdf/renderer's pdf(document),
    // which exposes .toBlob() in the browser. No network; renders locally.
    return (pdfResult as { toBlob?: () => Promise<Blob> }).toBlob!();
  },
  download: () => {},
  toPng: defaultWebpToPng,
};

export async function buildStoryPdf(
  story: GeneratedStory,
  deps: StoryPdfDeps = defaultDeps
): Promise<Blob> {
  const { pdf, Document, Page, Text, View, Image } = await import("@react-pdf/renderer");

  const toPng = deps.toPng ?? defaultWebpToPng;
  const illustrations = await Promise.all(
    story.scenes.map((scene) => (scene.illustrationDataUri ? toPng(scene.illustrationDataUri) : ""))
  );

  const node = (
    <Document>
      <Page size="A4" style={{ padding: 32 }}>
        <View>
          <Text style={{ fontSize: 24, marginBottom: 24 }}>{story.title}</Text>
          {story.scenes.map((scene, index) => (
            <View key={scene.ordinal} style={{ marginBottom: 20 }}>
              {illustrations[index] ? (
                // The PDF Image (`@react-pdf/renderer`) does not accept `alt`;
                // its a11y is provided by the adjacent Text line (altText).
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image
                  src={illustrations[index]}
                  style={{
                    maxWidth: "100%",
                    maxHeight: 160,
                    marginBottom: 8,
                    objectFit: "contain",
                  }}
                />
              ) : null}
              <Text style={{ fontSize: 11, color: "#666" }}>
                Scene {scene.ordinal} of {story.scenes.length}
              </Text>
              <Text style={{ fontSize: 14, marginTop: 8 }}>{scene.body}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );

  // Merge with defaults so optional deps degrade to the browser impls.
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
