import "server-only";

/**
 * Server-side Cloudflare Turnstile verification (feature 019 — demo anti-bot).
 *
 * The demo path (`POST /api/stories` in demo mode) requires a single-use proof
 * that is verified **here**, independently of the client, before any generation.
 * Failures (invalid token, non-2xx, network error, redirect) resolve to `false`
 * (**fail-closed**): the generator is never invoked without a verified proof.
 *
 * Single-use/expiry semantics are enforced upstream by Cloudflare's `siteverify`
 * (it rejects already-used/expired tokens) — the app keeps no local replay store.
 */
export const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const TURNSTILE_TOKEN_HEADER = "cf-turnstile-token";

/** Cap on the token length to keep the form-encoded `siteverify` payload sane. */
const TOKEN_MAX_LENGTH = 2048;

export interface TurnstileVerifier {
  /** True when a secret key is configured (feature enabled). */
  configured: boolean;
  /** Verifies a Turnstile proof against the Cloudflare siteverify API. */
  verify(token: string): Promise<boolean>;
}

/** Shape of the Cloudflare siteverify response we rely on. */
interface SiteVerifyResponse {
  success: boolean;
}

/**
 * Creates a verifier from the server-only secret key. When the key is absent the
 * verifier is `configured: false` (feature off — the demo behaves as today).
 *
 * Reads the secret from `process.env` directly (mirrors how optional operational
 * knobs like `AI_NARRATION_ENABLED`/`TTS_RATE_LIMIT_*` are read), so fake/CI
 * runs never force the strict `getEnv()` provider requirements. The fix is a
 * fixed, trusted Cloudflare host — not user-influenced — but we still refuse to
 * follow redirects (AGENTS SSRF discipline). `remoteip` is intentionally omitted
 * to avoid adding identity signals.
 */
export function createTurnstileVerifier(secretKey: string | undefined): TurnstileVerifier {
  if (!secretKey) {
    return { configured: false, verify: async () => false };
  }
  return {
    configured: true,
    async verify(token): Promise<boolean> {
      if (typeof token !== "string" || token.length === 0 || token.length > TOKEN_MAX_LENGTH) {
        return false;
      }
      try {
        const body = new URLSearchParams({ secret: secretKey, response: token });
        const res = await fetch(TURNSTILE_SITEVERIFY_URL, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body,
          redirect: "manual",
        });
        // Never follow a redirect to an unvalidated target (fail-closed).
        if (res.status >= 300 && res.status < 400) return false;
        if (!res.ok) return false;
        const data = (await res.json()) as Partial<SiteVerifyResponse>;
        return data.success === true;
      } catch {
        // Network/protocol failure => fail-closed: refuse rather than pass.
        return false;
      }
    },
  };
}
