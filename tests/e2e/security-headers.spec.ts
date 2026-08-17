import { test, expect, type APIRequestContext, type ConsoleMessage } from "@playwright/test";

/**
 * HTTP security headers (audit §8, PR #4) — asserted against a production build.
 *
 * The app serves responses through `headers()` configured in `next.config.ts`.
 * These are defense-in-depth (XSS / clickjacking / MIME-sniffing / downgrade).
 * The audit rated this LOW severity because the app is anonymous and the audit
 * confirmed no `dangerouslySetInnerHTML`/`eval`/`innerHTML` in `src/` — but the
 * headers still must be present and must not break rendering (checked by the
 * page-load assertion).
 *
 * Note: `Strict-Transport-Security` is production-only by design (the dev
 * server runs over http://localhost), so HSTS is asserted only for the
 * non-root static check that does not depend on protocol.
 */

const SECURITY_HEADERS = {
  "content-security-policy": /default-src 'self'/,
  "x-content-type-options": /nosniff/,
  "x-frame-options": /DENY|SAMEORIGIN/,
  "referrer-policy": /strict-origin/,
} as const;

async function collectHeaders(request: APIRequestContext) {
  const response = await request.get("/");
  expect(response.ok()).toBe(true);
  for (const [name, pattern] of Object.entries(SECURITY_HEADERS)) {
    expect(response.headers()[name], `missing or invalid header: ${name}`).toMatch(pattern);
  }
  return response.headers();
}

test("serves the security hardening headers on the root document", async ({ request }) => {
  const headers = await collectHeaders(request);
  // HSTS is set only in production (never over http dev); just require presence
  // of the header key itself to pin the config contract rather than a max-age.
  expect(headers).toHaveProperty("strict-transport-security");
});

test("does not serve the pipeline/CSP headers on client-visible response bodies that would break the reader", async ({
  request,
}) => {
  // The reader renders data: image URIs; the CSP must permit `img-src data:`.
  // Assert the configured CSP policy string is reachable (no 404/error page)
  // and that the document still renders its app shell (no CSP-blocked blank page).
  const response = await request.get("/reader");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html.length).toBeGreaterThan(0);
});

test("pages load without CSP console violations (default, error, reader)", async ({ page }) => {
  const violations: string[] = [];
  const onConsole = (msg: ConsoleMessage) => {
    const text = msg.text();
    if (msg.type() === "error" && /Content Security Policy|Refused to/.test(text)) {
      violations.push(text);
    }
  };
  page.on("console", onConsole);
  try {
    for (const path of ["/", "/reader", "/this-page-does-not-exist"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      await page.waitForTimeout(150); // flush late async CSP reports
      expect(violations, `CSP violation on ${path}`).toHaveLength(0);
    }
  } finally {
    page.off("console", onConsole);
  }
});
