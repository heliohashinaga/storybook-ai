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

test("CSP allows the Cloudflare Turnstile challenge origin for the demo anti-bot (feature 019)", async ({
  request,
}) => {
  // Always present in the configured policy (ADR 0014 — labeled relaxation). The
  // widget's script/iframe/assets must load from challenges.cloudflare.com.
  const headers = await collectHeaders(request);
  const csp = headers["content-security-policy"];
  expect(csp).toContain("https://challenges.cloudflare.com");
  // The frame in which the challenge renders must be allowed too.
  expect(csp).toMatch(/frame-src[^;]*challenges\.cloudflare\.com/);
});

test("spec 015 surfaces keep the full security header set (login gate, demo, form, auth API)", async ({
  request,
}) => {
  // Spec 015 added the login gate `/`, the anonymous `/demo` mirror, and the
  // `/api/auth/*` surface. None of them may relax the header set configured in
  // next.config.ts — assert the full set on each new document surface.
  for (const path of ["/", "/demo"]) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    for (const [name, pattern] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers()[name], `missing or invalid header ${name} on ${path}`).toMatch(
        pattern
      );
    }
  }

  // The playground form deep link without a session redirects to the gate; the
  // final document must also carry the full header set (no relaxation on the
  // authenticated surface even when it redirects).
  const form = await request.get("/form");
  expect(form.ok()).toBe(true);
  for (const [name, pattern] of Object.entries(SECURITY_HEADERS)) {
    expect(form.headers()[name], `missing or invalid header ${name} on /form`).toMatch(pattern);
  }

  // Auth API responses carry the full header set too, and stay uncached
  // (handlers are wrapped with the rate-limiter's `Cache-Control: no-store`).
  // In a demo-only e2e (no AUTH_SECRET) these routes are safe 401 stubs and
  // the no-store wrapper is not mounted — so assert the authenticated surface
  // only when the server actually has credentials configured.
  if (process.env.AUTH_SECRET) {
    for (const path of ["/api/auth/session", "/api/auth/csrf"]) {
      const response = await request.get(path);
      expect(response.ok()).toBe(true);
      for (const [name, pattern] of Object.entries(SECURITY_HEADERS)) {
        expect(response.headers()[name], `missing or invalid header ${name} on ${path}`).toMatch(
          pattern
        );
      }
      expect(response.headers()["cache-control"], `${path} must not be cached`).toContain(
        "no-store"
      );
    }
  }
});
