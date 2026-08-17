/**
 * fake-content-catalog.test — spec 012 US1–US4.
 *
 * The fake-content fixtures are the deterministic, anonymous stories +
 * illustrations used by the dev provider (`STORIES_TEST_MODE=fake`). These
 * tests assert what the spec promises: per-theme variance, pt-BR/en parity and
 * scene-count integrity, the virtual `generic` fallback, anonymity, the media
 * budget, determinism, and the marker coupling between the dev provider and
 * the dev illustrator.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  catalogIllustration,
  catalogMarker,
  fixtureSchema,
  parseCatalogMarker,
  resolveFixture,
} from "../../src/features/story-generation/server/fake-content-catalog";
import {
  createFakePhasedDelay,
  createFixedDevProvider,
  createFixedDevIllustration,
  FIXED_ILLUSTRATION_DATA_URI,
} from "../../src/features/story-generation/server/fixed-dev-provider";
import type { ProviderStoryInput } from "../../src/features/story-generation/server/story-generation-provider";

const CATALOG_DIR = join(process.cwd(), "tests/fixtures/story-generation/fake-content");
const THEMES = ["courage", "friendship", "kindness", "curiosity", "perseverance", "empathy"];
const LOCALES = ["pt-BR", "en"] as const;
const COUNTS = [3, 4, 5] as const;
const IMAGE_BUDGET_BYTES = 60_000;
const TOTAL_BUDGET_BYTES = 8 * 1024 * 1024;

function allFixtureFiles(): string[] {
  if (!existsSync(CATALOG_DIR)) return [];
  return readdirSync(CATALOG_DIR).filter((f) => f.endsWith(".json"));
}

/** Deterministic JSON read (ESLint forbids `require()` in this repo). */
function readJSON<T>(rel: string): T {
  return JSON.parse(readFileSync(join(CATALOG_DIR, rel), "utf8")) as T;
}

describe("catalog fixtures (US1 — variance, parity, counts)", () => {
  it("contains every expected enum combination plus the generic fallback", () => {
    const files = allFixtureFiles();
    for (const theme of [...THEMES, "generic"]) {
      for (const locale of LOCALES) {
        for (const count of COUNTS) {
          expect(files).toContain(`${theme}-${locale}-${count}.json`);
        }
      }
    }
  });

  it("each fixture has the expected scene count and shape", () => {
    for (const file of allFixtureFiles()) {
      const parsed = fixtureSchema.safeParse(readJSON(file));
      expect(parsed.success, `invalid fixture ${file}`).toBe(true);
      if (!parsed.success) continue;
      const fixture = parsed.data;
      expect(fixture.sceneCount).toBe(fixture.story.scenes.length);
      expect(fixture.illustrations.length).toBe(fixture.story.scenes.length);
      // ordinals are 1-based and contiguous
      fixture.story.scenes.forEach((scene, i) => expect(scene.ordinal).toBe(i + 1));
    }
  });

  it("different themes produce different titles and bodies (variance)", () => {
    const byTheme = new Map<string, string[]>();
    for (const theme of THEMES) {
      const fixture = readJSON<{
        story: { title: string; scenes: Array<{ body: string }> };
      }>(`${theme}-pt-BR-3.json`);
      byTheme.set(theme, [fixture.story.title, ...fixture.story.scenes.map((s) => s.body)]);
    }
    const first = byTheme.get("courage")!;
    for (const theme of THEMES.slice(1)) {
      const bodies = byTheme.get(theme)!;
      expect(bodies.join(" ")).not.toBe(first.join(" "));
    }
  });

  it("pt-BR and en catalogs are both present with the same grid", () => {
    for (const theme of THEMES) {
      for (const count of COUNTS) {
        expect(existsSync(join(CATALOG_DIR, `${theme}-pt-BR-${count}.json`))).toBe(true);
        expect(existsSync(join(CATALOG_DIR, `${theme}-en-${count}.json`))).toBe(true);
      }
    }
  });

  it("catalog reads are deterministic (same object shape on repeat)", () => {
    const a = resolveFixture("pt-BR", "courage", 3);
    const b = resolveFixture("pt-BR", "courage", 3);
    expect(a).not.toBeNull();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a!.story.title).toBe(b!.story.title);
  });
});

describe("catalog resolution (US3 — fallback)", () => {
  it("resolves theme+locale+count directly", () => {
    const f = resolveFixture("en", "empathy", 5);
    expect(f).not.toBeNull();
    expect(f!.story.scenes).toHaveLength(5);
  });

  it("falls back to the virtual generic fixture for an unknown theme", () => {
    const f = resolveFixture("pt-BR", "some-future-theme", 4);
    expect(f).not.toBeNull();
    expect((f!.theme as string).toLowerCase()).toBe("generic");
    expect(f!.story.scenes).toHaveLength(4);
  });

  it("returns null (legacy builder path) when neither the theme nor generic exists", () => {
    const key = "nonexistent-pt-BR-9";
    const filePath = join(CATALOG_DIR, `${key}.json`);
    // guard: fixture must not exist
    expect(existsSync(filePath)).toBe(false);
    expect(resolveFixture("pt-BR", "nonexistent", 9)).toBeNull();
  });

  it("catalogIllustration returns the WebP for the scene ordinal, else null", () => {
    const img = catalogIllustration("pt-BR", "courage", 3, 2);
    expect(img).toMatch(/^data:image\/webp;base64,/);
    expect(catalogIllustration("pt-BR", "courage", 3, 99)).toBeNull();
  });
});

describe("media budget (US2)", () => {
  it("every illustration is a WebP data-URI under the per-scene budget", () => {
    for (const file of allFixtureFiles()) {
      const fixture = readJSON<{ illustrations: string[] }>(file);
      for (const uri of fixture.illustrations) {
        expect(uri).toMatch(/^data:image\/webp;base64,/);
        const bytes = Buffer.from(uri.split(",")[1]!, "base64").byteLength;
        expect(bytes, `${file} illustration over budget`).toBeLessThanOrEqual(IMAGE_BUDGET_BYTES);
      }
    }
  });

  it("total catalog image weight is within the budget", () => {
    let total = 0;
    for (const file of allFixtureFiles()) {
      const fixture = readJSON<{ illustrations: string[] }>(file);
      for (const uri of fixture.illustrations)
        total += Buffer.from(uri.split(",")[1]!, "base64").byteLength;
    }
    expect(total).toBeLessThanOrEqual(TOTAL_BUDGET_BYTES);
  });
});

describe("anonymity (spec 006 invariant)", () => {
  const MARKERS = ["unsafecontent", "{{", "}}", "child-name", "<name>", "narigão", "lutadorzinho"];

  it("no fixture scene body or alt text contains anonymity-risk markers", () => {
    for (const file of allFixtureFiles()) {
      const fixture = readJSON<{
        story: { scenes: Array<{ body: string; altText: string }> };
      }>(file);
      for (const scene of fixture.story.scenes) {
        for (const marker of MARKERS) {
          expect(scene.body.toLowerCase()).not.toContain(marker);
          expect(scene.altText.toLowerCase()).not.toContain(marker);
        }
      }
    }
  });
});

describe("provider/illustrator coupling (spec 012 FR-004/FR-005)", () => {
  it("dev provider returns catalog scenes whose prompts are catalog markers", async () => {
    const provider = createFixedDevProvider(noopDelay());
    const input: ProviderStoryInput = {
      ageBand: "5-7",
      locale: "pt-BR",
      theme: "courage",
      sceneCount: 3,
    };
    const story = await provider.generateStory(input);
    expect(story.scenes).toHaveLength(3);
    for (const scene of story.scenes) {
      const marker = parseCatalogMarker(scene.illustrationPrompt);
      expect(marker).not.toBeNull();
      expect(marker!.theme).toBe("courage");
      expect(marker!.ordinal).toBe(scene.ordinal);
    }
  });

  it("dev provider falls back to the authored builder for a presumed-unknown theme", async () => {
    // A future theme not yet captured → generic fixture (policy B).
    const provider = createFixedDevProvider(noopDelay());
    const input: ProviderStoryInput = {
      ageBand: "5-7",
      locale: "en",
      theme: "emprendedurismo" as ProviderStoryInput["theme"],
      sceneCount: 4,
    };
    const story = await provider.generateStory(input);
    expect(story.scenes).toHaveLength(4);
  });

  it("dev illustrator resolves a catalog marker to the captured WebP", async () => {
    const provider = createFixedDevProvider(noopDelay());
    const story = await provider.generateStory({
      ageBand: "5-7",
      locale: "pt-BR",
      theme: "kindness",
      sceneCount: 4,
    });
    const illustration = createFixedDevIllustration(noopDelay());
    const marker = story.scenes[0]!.illustrationPrompt;
    const result = await illustration(marker);
    expect(result.dataUri).toMatch(/^data:image\/webp;base64,/);
    expect(result.dataUri).not.toBe("[FIXED]");
  });

  it("dev illustrator falls back to the fixed image for a non-marker prompt", async () => {
    const illustration = createFixedDevIllustration(noopDelay());
    const result = await illustration("just a normal prompt about a frog");
    expect(result.dataUri).toBe(FIXED_ILLUSTRATION_DATA_URI);
  });

  it("markers round-trip through the catalog", () => {
    const marker = catalogMarker("curiosity", "en", 5, 3);
    const parsed = parseCatalogMarker(marker);
    expect(parsed).toEqual({ theme: "curiosity", locale: "en", sceneCount: 5, ordinal: 3 });
    expect(parseCatalogMarker("anything else")).toBeNull();
  });
});

// A delay that never waits (offline determinism).
function noopDelay(): ReturnType<typeof createFakePhasedDelay> {
  return createFakePhasedDelay(async () => undefined) as unknown as ReturnType<
    typeof createFakePhasedDelay
  >;
}
