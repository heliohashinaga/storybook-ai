"use client";

import type { GeneratedStory } from "../../story-generation/server/schemas";

/**
 * Browser-only PDF export (T042).
 *
 * Composes a printable PDF from the in-memory story. `@react-pdf/renderer` is
 * lazy-imported here so it never lands in the initial bundle (<250 KiB gzip
 * budget, per AGENTS.md). The document is laid out as **one page per scene**:
 * a cover page with the story title, then a fresh A4 page for each scene with
 * its illustration and body. This guarantees a scene's image and text never
 * split across pages (a single overflowing `<Page>` would get cut mid-scene by
 * the renderer, which is what broke the 3-scene PDF).
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
 * Converts a `data:*;base64,...` URI into a Blob without any network call.
 * `fetch(data:...)` is refused by our strict CSP (`connect-src 'self'`), so the
 * data-URI is decoded locally with `atob` into a Blob — still fully client-side
 * and CSP-compliant (AGENTS.md: never loosen security headers silently).
 */
function dataUriToBlob(dataUri: string): Blob {
  const comma = dataUri.indexOf(",");
  const meta = dataUri.slice(0, comma); // `data:image/webp;base64`
  const base64 = dataUri.slice(comma + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const mime = (meta.slice(5).split(";")[0] ?? "").trim();
  return new Blob([bytes], { type: mime || "application/octet-stream" });
}

/**
 * Converts a WebP data-URI to a PNG data-URI in the browser, so the PDF can
 * embed the illustration (`@react-pdf/renderer` does not reliably embed WebP).
 * Uses createImageBitmap + canvas (both decode WebP and encode PNG) — fully
 * client-side, no network, no extra bundle. Returns the uri unchanged if it is
 * not WebP or cannot be converted, so a valid image is never dropped.
 */
async function defaultWebpToPng(webpUri: string): Promise<string> {
  if (!webpUri.startsWith(WEBP_DATA_URI_PREFIX)) return webpUri;
  const decoded = await createImageBitmap(dataUriToBlob(webpUri)).catch(() => null);
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

/** Scene counter label localized to the story's language. */
function sceneLabel(locale: string): string {
  return locale === "en" ? "Scene" : "Cena";
}

/** Shared document styles (one page per scene, no mid-scene page break). */
const styles = {
  cover: {
    padding: 32,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    textAlign: "center" as const,
  },
  coverArt: {
    maxWidth: "100%",
    maxHeight: 300,
    marginBottom: 20,
    objectFit: "contain" as const,
  },
  coverTitle: { fontSize: 28, fontWeight: "bold" as const },
  scene: { padding: 32 },
  sceneTitle: { fontSize: 20, fontWeight: "bold" as const, marginBottom: 8 },
  illustration: {
    maxWidth: "100%",
    maxHeight: 320,
    marginBottom: 12,
    objectFit: "contain" as const,
  },
  sceneMeta: { fontSize: 11, color: "#666" },
  sceneBody: { fontSize: 14, marginTop: 12 },
};

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
      {/* Cover: the scene-1 illustration as cover art under the story title. */}
      <Page size="A4" style={styles.cover}>
        <View>
          {illustrations[0] ? (
            // `@react-pdf/renderer` does not accept an `alt` prop on `Image`.
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={illustrations[0]} style={styles.coverArt} />
          ) : null}
          <Text style={styles.coverTitle}>{story.title}</Text>
        </View>
      </Page>

      {/* One page per scene so an illustration + text are never split. */}
      {story.scenes.map((scene, index) => (
        <Page key={scene.ordinal} size="A4" style={styles.scene}>
          <View>
            <Text style={styles.sceneTitle}>{scene.title}</Text>
            <Text style={styles.sceneMeta}>
              {sceneLabel(story.locale)} {scene.ordinal} of {story.scenes.length}
            </Text>
            {illustrations[index] ? (
              // `@react-pdf/renderer` does not accept an `alt` prop on `Image`.
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={illustrations[index]} style={styles.illustration} />
            ) : null}
            <Text style={styles.sceneBody}>{scene.body}</Text>
          </View>
        </Page>
      ))}
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
