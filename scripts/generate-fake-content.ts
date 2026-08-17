/**
 * generate-fake-content.ts — Generate the deterministic fake-content catalog
 * (spec 012) using the real providers, then commit the fixtures.
 *
 * Dev-only, server-side tool. It iterates the capture grid (6 themes × 2
 * locales × 3/4/5 scene counts) running the real multi-agent pipeline per
 * combination (planner/writer/moderator via the per-agent `*_MODEL` env
 * wiring, illustrator via `ILLUSTRATOR_MODEL`), re-compresses illustrations
 * with sharp (512×512 WebP q70) and writes
 * `tests/fixtures/story-generation/fake-content/{theme}-{locale}-{count}.json`.
 *
 * The virtual `generic` fallback is authored here (hand-written neutral cells
 * in pt-BR/en — the API theme enum is closed, so no capture can be
 * theme-neutral) while its illustrations ARE captured via `runtime.illustrate`
 * from neutral prompts, giving the fake a real-image fallback for future
 * themes without ever mislabeling content.
 *
 * Safety/privacy invariants (AGENTS.md / spec 006):
 * - Never runs in CI (`process.env.CI` ⇒ abort).
 * - Each narrative goes through the real Moderator gate (inside
 *   `generateStory`); a rejected/unsafe candidate is DISCARDED, never saved.
 * - Basic anonymity pre-flight (template markers) before writing; the unit
 *   suite re-scans fixtures in tests.
 * - Requires the real env (OPENROUTER/OPENCODE keys + `*_MODEL`) — it never
 *   falls back to the fake path.
 *
 * Usage:
 *   pnpm exec tsx scripts/generate-fake-content.ts --dry-run          # plan+budget, no network
 *   pnpm exec tsx scripts/generate-fake-content.ts --limit 2 --locales pt-BR
 *   pnpm exec tsx scripts/generate-fake-content.ts --themes empathy --locales en
 *   pnpm exec tsx scripts/generate-fake-content.ts --themes curiosity --missing   # só o que falta
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import sharp from "sharp";
import { generateStory } from "../src/features/story-generation/server/generate-story";
import { createGenerationRuntime } from "../src/features/story-generation/server/generation-runtime";

/* ------------------------------------------------------------------ *
 * Grid & budgets (spec 012 FR-002/FR-003)
 * ------------------------------------------------------------------ */

const THEMES = [
  "courage",
  "friendship",
  "kindness",
  "curiosity",
  "perseverance",
  "empathy",
] as const;
const LOCALES = ["pt-BR", "en"] as const;
const SCENE_COUNTS = [3, 4, 5] as const;
/** Anonymous age band used for enum captures (control variable). */
const CAPTURE_AGE_BAND = "5-7" as const;

const FIXTURE_DIR = resolve(process.cwd(), "tests/fixtures/story-generation/fake-content");
const IMAGE_BUDGET_BYTES = 60_000; // per scene (WebP after compression)
const TOTAL_BUDGET_BYTES = 8 * 1024 * 1024; // whole catalog
const CONCURRENCY = 3; // parallel capture workers (respect provider rate limits)

/* ------------------------------------------------------------------ *
 * Fixture shape (FR-002)
 * ------------------------------------------------------------------ */

const fixtureSceneSchema = z
  .object({
    ordinal: z.number().int().min(1).max(5),
    title: z.string().min(1),
    body: z.string().min(1),
    altText: z.string().min(1),
  })
  .strict();

const fixtureSchema = z
  .object({
    theme: z.enum([...THEMES, "generic"]),
    locale: z.enum(LOCALES),
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

type Theme = (typeof THEMES)[number];
type Locale = (typeof LOCALES)[number];
type Combo = { theme: Theme | "generic"; locale: Locale; sceneCount: number };

/* ------------------------------------------------------------------ *
 * Virtual `generic` fallback (authored neutral cells + captured images)
 * ------------------------------------------------------------------ */

interface GenericCell {
  title: string;
  body: string;
  altText: string;
}

/** 5 neutral cells (opener + 3 middles + closer). Montaged for 3/4/5 scenes. */
const GENERIC_EDITIONS: Record<Locale, { title: string; cells: GenericCell[] }> = {
  "pt-BR": {
    title: "A grande aventura da descoberta",
    cells: [
      {
        title: "Uma manhã diferente",
        body: "Naquela manhã, tudo parecia pronto para um dia inteiro de surpresas. O caminho à frente estava cheio de possibilidades, e era hora de começar.",
        altText: "Uma paisagem ensolarada com um caminho que se perde no horizonte",
      },
      {
        title: "O caminho novo",
        body: "Cada passo revelava algo que ninguém tinha notado antes. Pequenos detalhes, novos sons e um mundo inteiro esperando para ser explorado.",
        altText: "Uma trilha cercada por flores coloridas e folhas brilhantes",
      },
      {
        title: "Um desafio inesperado",
        body: "De repente, o caminho ficou difícil. Mas com calma, atenção e uma boa ideia, a solução apareceu mais perto do que se imaginava.",
        altText: "Uma ponte delicada sobre um riacho, com pedras seguras na margem",
      },
      {
        title: "Ajuda vinda de todos os lados",
        body: "Cada um contribuiu com um pouquinho: uma mão amiga, uma palavra gentil e um gesto de cuidado fizeram tudo ficar mais leve.",
        altText: "Vários personagens amigos carregando juntos um pacote pelo caminho",
      },
      {
        title: "O regresso feliz",
        body: "De volta para casa, o dia inteiro parecia um grande tesouro guardado na memória, pronto para ser lembrado com um sorriso.",
        altText: "Um pôr do sol dourado sobre o caminho de volta para casa",
      },
    ],
  },
  en: {
    title: "The Big Day of Discovery",
    cells: [
      {
        title: "A Different Morning",
        body: "That morning, everything felt ready for a whole day of surprises. The path ahead was full of possibilities, and it was time to begin.",
        altText: "A sunny landscape with a path fading into the horizon",
      },
      {
        title: "The New Path",
        body: "Every step revealed something nobody had noticed before. Tiny details, new sounds, and a whole world waiting to be explored.",
        altText: "A trail lined with colorful flowers and shiny leaves",
      },
      {
        title: "An Unexpected Challenge",
        body: "Suddenly, the path became hard. But with patience, attention, and a good idea, the answer appeared closer than anyone expected.",
        altText: "A delicate bridge over a stream with safe stones on the bank",
      },
      {
        title: "Help From Everywhere",
        body: "Everyone pitched in a little: a friendly hand, a kind word, and a caring gesture made everything feel lighter.",
        altText: "Several friendly characters carrying a package together along the path",
      },
      {
        title: "The Happy Way Back",
        body: "Back home, the whole day felt like a great treasure kept in memory, ready to be remembered with a smile.",
        altText: "A golden sunset over the path leading back home",
      },
    ],
  },
};

/** Neutral illustration prompts per scene position (English — spec 006). */
const GENERIC_IMAGE_PROMPTS = [
  "soft children's book watercolor, sunny landscape with a path into the horizon, gentle pastel palette",
  "soft children's book watercolor, trail with colorful flowers and shiny leaves, gentle pastel palette",
  "soft children's book watercolor, delicate bridge over a stream with safe stones, gentle pastel palette",
  "soft children's book watercolor, several friendly characters carrying a package together, gentle pastel palette",
  "soft children's book watercolor, golden sunset over the path back home, gentle pastel palette",
] as const;

function genericStory(combo: Combo): {
  story: { title: string; scenes: Array<GenericCell & { ordinal: number }> };
  prompts: string[];
} {
  const edition = GENERIC_EDITIONS[combo.locale];
  const cells = edition.cells.slice(0, combo.sceneCount);
  const prompts = GENERIC_IMAGE_PROMPTS.slice(0, combo.sceneCount);
  return {
    story: { title: edition.title, scenes: cells.map((c, i) => ({ ...c, ordinal: i + 1 })) },
    prompts,
  };
}

/* ------------------------------------------------------------------ *
 * Flag parsing
 * ------------------------------------------------------------------ */

interface Flags {
  dryRun: boolean;
  missing: boolean;
  limit?: number;
  locales: Set<string>;
  themes: Set<string>;
  counts: Set<number>;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = {
    dryRun: false,
    missing: false,
    locales: new Set(),
    themes: new Set(),
    counts: new Set(),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--missing") flags.missing = true;
    else if (arg === "--limit") flags.limit = Number(argv[++i]);
    else if (arg === "--locales") for (const v of argv[++i]!.split(",")) flags.locales.add(v);
    else if (arg === "--themes") for (const v of argv[++i]!.split(",")) flags.themes.add(v);
    else if (arg === "--counts") for (const v of argv[++i]!.split(",")) flags.counts.add(Number(v));
    else throw new Error(`Unknown flag: ${arg}`);
  }
  return flags;
}

function buildPlan(flags: Flags): Combo[] {
  const themes = flags.themes.size > 0 ? [...flags.themes] : [...THEMES, "generic"];
  const locales = flags.locales.size > 0 ? [...flags.locales] : [...LOCALES];
  const counts = flags.counts.size > 0 ? [...flags.counts].sort() : [...SCENE_COUNTS];
  const plan: Combo[] = [];
  for (const theme of themes) {
    for (const locale of locales) {
      for (const sceneCount of counts) {
        const combo = {
          theme: theme as Combo["theme"],
          locale: locale as Combo["locale"],
          sceneCount,
        };
        if (flags.missing && existsSync(join(FIXTURE_DIR, fixtureFileName(combo)))) continue;
        plan.push(combo);
      }
    }
  }
  return flags.limit !== undefined ? plan.slice(0, flags.limit) : plan;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Loads `<repo>/.env.local` into process.env when running outside Next.js
 * (node scripts do not auto-load env files). Keys already present win.
 */
function loadDotEnvLocal(): void {
  // CLI tools run from the repo root (see README); cwd is stable across bundles.
  const envFile = join(process.cwd(), ".env.local");
  if (!existsSync(envFile)) return;
  for (const raw of readFileSync(envFile, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

async function recompressWebP(dataUri: string): Promise<{ dataUri: string; bytes: number }> {
  const base64 = dataUri.replace(/^data:image\/webp;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  const out = await sharp(buffer)
    .resize(512, 512, { fit: "cover" })
    .webp({ quality: 70 })
    .toBuffer();
  if (out.byteLength > IMAGE_BUDGET_BYTES) {
    throw new Error(
      `Compressed image exceeds budget (${out.byteLength} > ${IMAGE_BUDGET_BYTES} bytes)`
    );
  }
  return { dataUri: `data:image/webp;base64,${out.toString("base64")}`, bytes: out.byteLength };
}

/** Cheap anonymity pre-flight mirroring the fake markers; fixtures are re-scanned by tests. */
const ANON_RISK_MARKERS = ["unsafecontent", "{{", "}}", "child-name", "child name", "<name>"];

function hasAnonymityRisk(text: string): boolean {
  const lower = text.toLowerCase();
  return ANON_RISK_MARKERS.some((m) => lower.includes(m.toLowerCase()));
}

function fixtureFileName(combo: Combo): string {
  return `${combo.theme}-${combo.locale}-${combo.sceneCount}.json`;
}

function writeFixture(
  combo: Combo,
  payload: z.infer<typeof fixtureSchema>
): Promise<{ file: string }> {
  // Deterministic envelope: sha256 over the JSON body WITHOUT the meta.sha256 field.
  const { meta: _meta, ...body } = payload;
  const sha256 = sha256Hex(JSON.stringify(body));
  const finalPayload = fixtureSchema.parse({ ...payload, meta: { ..._meta, sha256 } });
  const filePath = join(FIXTURE_DIR, fixtureFileName(combo));
  return mkdir(FIXTURE_DIR, { recursive: true })
    .then(() => writeFile(filePath, `${JSON.stringify(finalPayload, null, 2)}\n`, "utf8"))
    .then(() => ({ file: filePath }));
}

/* ------------------------------------------------------------------ *
 * Capture
 * ------------------------------------------------------------------ */

interface CaptureSummary {
  written: string[];
  rejected: Array<{ combo: Combo; reason: string }>;
  totalBytes: number;
}

async function captureEnumCombo(
  combo: Combo,
  runtime: ReturnType<typeof createGenerationRuntime>
): Promise<{ file: string; bytes: number } | { rejected: string }> {
  const result = await generateStory({
    input: {
      ageBand: CAPTURE_AGE_BAND,
      locale: combo.locale,
      theme: combo.theme as Theme,
      sceneCount: combo.sceneCount,
    },
    plannerProvider: runtime.plannerProvider,
    writerProvider: runtime.writerProvider,
    moderatorProvider: runtime.moderatorProvider,
    illustrate: runtime.illustrate,
  });

  if (!result.ok) {
    return { rejected: `${result.error.code} (${result.error.messageKey})` };
  }

  for (const scene of result.story.scenes) {
    if (hasAnonymityRisk(scene.body) || hasAnonymityRisk(scene.altText)) {
      return { rejected: "anonymity pre-flight failed" };
    }
  }

  const illustrations = await Promise.all(
    result.story.scenes.map((scene) => recompressWebP(scene.illustrationDataUri))
  );
  const payload: z.infer<typeof fixtureSchema> = {
    theme: combo.theme,
    locale: combo.locale,
    sceneCount: combo.sceneCount,
    story: {
      title: result.story.title,
      scenes: result.story.scenes.map((s) => ({
        ordinal: s.ordinal,
        title: s.title,
        body: s.body,
        altText: s.altText,
      })),
    },
    illustrations: illustrations.map((i) => i.dataUri),
    meta: {
      model: process.env.ILLUSTRATOR_MODEL ?? "capture",
      capturedAt: new Date().toISOString(),
      sha256: "",
    },
  };
  const { file } = await writeFixture(combo, payload);
  const bytes = illustrations.reduce((acc, i) => acc + i.bytes, 0);
  return { file, bytes };
}

async function captureGenericCombo(
  combo: Combo,
  runtime: ReturnType<typeof createGenerationRuntime>
): Promise<{ file: string; bytes: number }> {
  const { story, prompts } = genericStory(combo);
  const images = await Promise.all(prompts.map((prompt) => runtime.illustrate(prompt)));
  const illustrations = await Promise.all(images.map((img) => recompressWebP(img.dataUri)));
  const payload: z.infer<typeof fixtureSchema> = {
    theme: "generic",
    locale: combo.locale,
    sceneCount: combo.sceneCount,
    story: {
      title: story.title,
      scenes: story.scenes.map((c) => ({
        ordinal: c.ordinal,
        title: c.title,
        body: c.body,
        altText: c.altText,
      })),
    },
    illustrations: illustrations.map((i) => i.dataUri),
    meta: {
      model: process.env.ILLUSTRATOR_MODEL ?? "capture",
      capturedAt: new Date().toISOString(),
      sha256: "",
    },
  };
  const { file } = await writeFixture(combo, payload);
  const bytes = illustrations.reduce((acc, i) => acc + i.bytes, 0);
  return { file, bytes };
}

async function run(flags: Flags): Promise<void> {
  const plan = buildPlan(flags);

  if (flags.dryRun) {
    const scenes = plan.reduce((acc, c) => acc + c.sceneCount, 0);
    const estImageBytes = scenes * (IMAGE_BUDGET_BYTES / 2);
    console.log(`# Fake-content capture — dry run (no network)`);
    console.log(`Grid: ${plan.length} combinations`);
    for (const combo of plan) console.log(`  - ${fixtureFileName(combo)}`);
    console.log(
      `Estimated: ${scenes} scenes × ~50% of ${Math.round(IMAGE_BUDGET_BYTES / 1024)} KB/cene ≈ ${Math.round(estImageBytes / 1024)} KB of images`
    );
    console.log(
      `Budget: catalog ≤ ${TOTAL_BUDGET_BYTES / 1024 / 1024} MB, per cene ≤ ${Math.round(IMAGE_BUDGET_BYTES / 1024)} KB`
    );
    console.log("Dry run OK — no providers were called.");
    return;
  }

  if (process.env.CI) {
    throw new Error("Capture must never run in CI; fixtures are committed instead.");
  }

  loadDotEnvLocal();
  const runtime = createGenerationRuntime();
  console.log(`# Fake-content capture (real providers) — ${plan.length} combinations`);
  const summary: CaptureSummary = { written: [], rejected: [], totalBytes: 0 };

  let index = 0;
  async function worker() {
    while (index < plan.length) {
      const combo = plan[index];
      if (combo === undefined) break;
      index += 1;
      const outcome =
        combo.theme === "generic"
          ? await captureGenericCombo(combo, runtime)
          : await captureEnumCombo(combo, runtime);
      if ("file" in outcome) {
        summary.written.push(outcome.file);
        summary.totalBytes += outcome.bytes;
        console.log(
          `  ✓ ${fixtureFileName(combo)} (${Math.round(outcome.bytes / 1024)} KB images)`
        );
      } else {
        summary.rejected.push({ combo, reason: outcome.rejected });
        console.warn(`  ✗ ${fixtureFileName(combo)} rejected: ${outcome.rejected}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (summary.totalBytes > TOTAL_BUDGET_BYTES) {
    throw new Error(
      `Catalog exceeds total budget (${summary.totalBytes} > ${TOTAL_BUDGET_BYTES} bytes)`
    );
  }
  console.log(
    `\nDone: ${summary.written.length} written, ${summary.rejected.length} rejected, ${Math.round(summary.totalBytes / 1024)} KB total images.`
  );
  if (summary.rejected.length > 0) {
    console.warn(
      "Rejected combinations (unsafe or transport failure) were NOT saved. Re-run the capture to retry them."
    );
  }
}

run(parseFlags(process.argv.slice(2))).catch((error: unknown) => {
  console.error(`generate-fake-content: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
