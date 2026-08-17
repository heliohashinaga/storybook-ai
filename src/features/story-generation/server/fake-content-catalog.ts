/**
 * fake-content-catalog.ts — deterministic loader for the captured fake-content
 * catalog (spec 012). Reads fixtures committed at
 * `tests/fixtures/story-generation/fake-content/{theme}-{locale}-{count}.json`
 * with Zod validation, caches per process (files are static) and resolves the
 * **virtual `generic` fallback** for themes outside the catalog (policy B).
 *
 * The connector contract: {@link catalogMarker} is used by the dev provider as
 * the per-scene `illustrationPrompt`; {@link parseCatalogMarker} +
 * {@link catalogIllustration} let the dev illustration provider return the
 * captured WebP for that scene (falling back to the fixed dev image).
 */
import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { themeSchema } from "./schemas";

/* ------------------------------------------------------------------ *
 * Fixture shape (FR-002)
 * ------------------------------------------------------------------ */

export const fixtureSceneSchema = z
  .object({
    ordinal: z.number().int().min(1).max(5),
    title: z.string().min(1),
    body: z.string().min(1),
    altText: z.string().min(1),
  })
  .strict();

export const fixtureSchema = z
  .object({
    theme: z.string().min(1),
    locale: z.enum(["pt-BR", "en"]),
    sceneCount: z.number().int().min(3).max(5),
    story: z
      .object({
        title: z.string().min(1),
        scenes: z.array(fixtureSceneSchema),
      })
      .strict(),
    illustrations: z.array(z.string().regex(/^data:image\/webp;base64,/)),
    meta: z
      .object({
        model: z.string().min(1),
        capturedAt: z.string().min(1),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .strict(),
  })
  .strict();

export type CatalogFixture = z.infer<typeof fixtureSchema>;

const CATALOG_DIR = resolve(process.cwd(), "tests/fixtures/story-generation/fake-content");
const ENUM_THEMES = themeSchema.options;

const cache = new Map<string, CatalogFixture>();

function fixtureKey(theme: string, locale: string, sceneCount: number): string {
  return `${theme}-${locale}-${sceneCount}`;
}

function readFixture(theme: string, locale: string, sceneCount: number): CatalogFixture | null {
  const key = fixtureKey(theme, locale, sceneCount);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const filePath = join(CATALOG_DIR, `${key}.json`);
  if (!existsSync(filePath)) {
    cache.set(key, undefined as unknown as CatalogFixture); // negative cache
    return null;
  }
  try {
    const parsed = fixtureSchema.safeParse(JSON.parse(readFileSync(filePath, "utf8")));
    if (!parsed.success) {
      console.warn(
        `fake-content-catalog: ignoring invalid fixture ${key}: ${parsed.error.issues[0]?.message}`
      );
      cache.set(key, undefined as unknown as CatalogFixture);
      return null;
    }
    cache.set(key, parsed.data);
    return parsed.data;
  } catch (error) {
    console.warn(
      `fake-content-catalog: ignoring unreadable fixture ${key}: ${error instanceof Error ? error.message : String(error)}`
    );
    cache.set(key, undefined as unknown as CatalogFixture);
    return null;
  }
}

/**
 * Resolves a fixture for the requested (locale, theme, sceneCount).
 * Policy B (spec 012): themes outside the catalog (future enum additions that
 * were never captured) fall back to the virtual `generic` fixture; anything
 * else missing resolves to `null` (caller falls back to the legacy builder).
 */
export function resolveFixture(
  locale: string,
  theme: string,
  sceneCount: number
): CatalogFixture | null {
  const direct = readFixture(theme, locale, sceneCount);
  if (direct !== null) return direct;
  if (!(ENUM_THEMES as readonly string[]).includes(theme)) {
    return readFixture("generic", locale, sceneCount);
  }
  return null;
}

/** Captured WebP data-URI for scene `ordinal` (1-based), or null. */
export function catalogIllustration(
  locale: string,
  theme: string,
  sceneCount: number,
  ordinal: number
): string | null {
  const fixture = resolveFixture(locale, theme, sceneCount);
  if (fixture === null) return null;
  return fixture.illustrations[ordinal - 1] ?? null;
}

/* ------------------------------------------------------------------ *
 * Marker contract between the dev provider and the dev illustrator
 * ------------------------------------------------------------------ */

export const CATALOG_MARKER_PREFIX = "catalog://";

export function catalogMarker(
  theme: string,
  locale: string,
  sceneCount: number,
  ordinal: number
): string {
  return `${CATALOG_MARKER_PREFIX}${theme}/${locale}/${sceneCount}/${ordinal}`;
}

export function parseCatalogMarker(
  prompt: string
): { theme: string; locale: string; sceneCount: number; ordinal: number } | null {
  if (!prompt.startsWith(CATALOG_MARKER_PREFIX)) return null;
  // Strip the "catalog://" prefix before splitting on "/" (avoids the empty
  // first segment caused by the "//").
  const rest = prompt.slice(CATALOG_MARKER_PREFIX.length);
  const [theme, locale, sceneCount, ordinal] = rest.split("/");
  const count = Number(sceneCount);
  const ord = Number(ordinal);
  if (!theme || !locale || !Number.isInteger(count) || !Number.isInteger(ord)) return null;
  return { theme, locale, sceneCount: count, ordinal: ord };
}
