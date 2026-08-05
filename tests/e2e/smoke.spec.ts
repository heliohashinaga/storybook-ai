import { test, expect } from "@playwright/test";

/**
 * Phase 1 E2E smoke test. Verifies the app serves HTTP successfully on the
 * anonymous root route. Real E2E journeys (pt-BR/EN generation, safety
 * regeneration, anonymous session/export) arrive in Phase 3+.
 */
test("anonymous root route responds", async ({ request }) => {
  const res = await request.get("/");
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("<html");
});
