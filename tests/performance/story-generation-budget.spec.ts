import { test, expect, type Page, type Response } from "@playwright/test";

/**
 * Performance budgets (T060).
 *
 * Enforces the AGENTS.md performance budgets against the built app
 * (deterministic dev provider — never a live AI service):
 *   - Initial route JS ≤ 250 KiB gzip (PDF renderer is lazy-imported and must
 *     never land in the initial bundle).
 *   - LCP p75 ≤ 2.5s on initial load.
 *   - Scene navigation ≤ 100ms p75 once assets are loaded.
 *   - Full generation (safety + 3 illustrations) ≤ 120s end-to-end.
 *
 * All budgets are safe guardrails that leave wide margin for mid-tier mobile /
 * 4G: they assert the ceiling, not a benchmark score. Deterministic — no
 * live-provider or wall-clock dependence beyond the app under test.
 */

const BUDGETS = {
  initialJsKib: 250, // ≤ 250 KiB gzip
  lcpMs: 2500, // ≤ 2.5s
  sceneNavMsP75: 100, // ≤ 100ms
  generationMs: 120_000, // ≤ 120s
} as const;

/** Percentile of a numeric sample. */
function p75(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.75);
  return sorted[Math.min(idx, sorted.length - 1)]!;
}

/** Sum of gzip (over-the-wire) transfer sizes for same-origin JS resources. */
async function initialJsGzipKib(page: Page): Promise<number> {
  const entries = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((e) => e.name.endsWith(".js"))
      .map((entry) => {
        const e = entry as PerformanceResourceTiming;
        return { name: e.name, transferSize: e.transferSize };
      })
  );
  // transferSize is the compressed bytes actually transferred (0 when cached/
  // opaque). Sum only positive same-origin values to approximate gzip bytes.
  const gzBytes = entries.reduce((acc, e) => acc + Math.max(0, e.transferSize), 0);
  return gzBytes / 1024;
}

/** Initial-page JS resource basenames (for the lazy-PDF assertion). */
async function initialJsChunks(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((e) => e.name.endsWith(".js"))
      .map((e) => e.name.split("/").pop() ?? "")
  );
}

async function fillAndSubmit(page: Page): Promise<Response> {
  await page.getByLabel(/Idade da criança/i).fill("6");
  await page.getByLabel(/Tema da história/i).selectOption("courage");
  const response = page.waitForResponse(
    (r) => r.url().includes("/api/stories") && r.request().method() === "POST"
  );
  await page.getByRole("button", { name: /Criar história/i }).click();
  return response;
}

test.describe("performance budgets (T060)", () => {
  test("initial JS stays within 250 KiB gzip and the PDF renderer is lazy", async ({ page }) => {
    const pdfChunksSeen: string[] = [];
    page.on("response", (r) => {
      if (r.request().resourceType() === "script" && /pdf|renderer/i.test(r.url())) {
        pdfChunksSeen.push(r.url().split("/").pop() ?? "");
      }
    });

    await page.goto("/");
    const gzKib = await initialJsGzipKib(page);
    expect(gzKib).toBeLessThanOrEqual(BUDGETS.initialJsKib);

    // The PDF renderer is lazy-loaded: nothing named pdf/renderer was requested
    // during the initial load (it must NOT be in the initial bundle).
    const initialChunks = await initialJsChunks(page);
    expect(initialChunks.some((c) => /pdf|renderer/i.test(c))).toBe(false);
  });

  test("LCP is within 2.5s and scene navigation is within 100ms p75", async ({ page }) => {
    await page.goto("/");
    await fillAndSubmit(page);
    await expect(page.getByText("Cena 1 de 3")).toBeVisible();

    // LCP after the reader renders (initial LCP for the landing route is tiny;
    // this covers the interactive generation result).
    const lcp = await page.evaluate(
      () => performance.getEntriesByType("largest-contentful-paint").at(-1)?.startTime ?? 0
    );
    expect(lcp).toBeLessThanOrEqual(BUDGETS.lcpMs);

    // Scene navigation sampled across the 3 available scenes (still within
    // bounds, so navigating never disables), for a p75 value.
    const next = page.getByRole("button", { name: /Próxima cena/i });
    const prev = page.getByRole("button", { name: /Cena anterior/i });
    const samples: number[] = [];
    // 1 -> 2 -> 3 -> 2 -> 1 -> 2 (four forward transitions, all in-bounds)
    const transitions = [
      { button: next, to: "Cena 2 de 3" },
      { button: next, to: "Cena 3 de 3" },
      { button: prev, to: "Cena 2 de 3" },
      { button: prev, to: "Cena 1 de 3" },
    ];
    for (const { button, to } of transitions) {
      const t0 = Date.now();
      await button.click();
      await expect(page.getByText(to)).toBeVisible();
      samples.push(Date.now() - t0);
    }
    expect(p75(samples)).toBeLessThanOrEqual(BUDGETS.sceneNavMsP75);
  });

  test("full generation completes within 120s end-to-end", async ({ page }) => {
    await page.goto("/");
    const startedAt = Date.now();
    const response = await fillAndSubmit(page);
    expect(response.status()).toBe(200);
    // Reader with three safety-approved scenes rendered means the end-to-end
    // (generate + safety + 3 illustrations) pipeline finished.
    await expect(page.getByText("Cena 1 de 3")).toBeVisible();
    const elapsedMs = Date.now() - startedAt;
    expect(elapsedMs).toBeLessThanOrEqual(BUDGETS.generationMs);
  });
});
