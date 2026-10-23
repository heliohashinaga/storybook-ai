/**
 * Deterministic gatekeeper configuration for the browser suites (ADR 0015).
 *
 * `src/app/page.tsx` renders the shared-password gate only when the server has
 * both `GATEKEEPER_SECRET` and `PLAYGROUND_PASSWORD_HASH`; without them it falls
 * back to the demo-only panel. CI has no `.env.local`, so the browser jobs never
 * saw a configured porteiro and the gate spec could not exercise the password
 * flow. `playwright.config.ts` injects these values into the web server, which
 * keeps the E2E/visual/perf runs on the *production-shaped* (gated) landing page.
 *
 * These are throw-away test credentials — never valid outside a local/CI run.
 * The hash is the `scrypt$<saltHex>$<hashHex>` value for `GATE_E2E_PASSWORD`
 * (fixed salt so it is a stable literal; regenerate with `pnpm gate:hash`).
 */
export const GATE_E2E_SECRET = "e2e-gatekeeper-secret-0123456789abcdef";
export const GATE_E2E_PASSWORD = "e2e-playground-password";
export const GATE_E2E_PASSWORD_HASH =
  "scrypt$00112233445566778899aabbccddeeff$bc2d388e775b9c81d9c987de46f0b6d6cacd8e6ac4e8aaa3e9cfcddfab077f70";
