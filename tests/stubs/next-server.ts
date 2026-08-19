/**
 * Minimal `next/server` stand-in for the Vitest (jsdom) environment.
 *
 * `next-auth` imports `{ NextRequest }` from `next/server` at module load, but
 * that subpath is only resolvable inside the Next.js bundle — Vitest/Vite can't
 * load it from a pnpm store (its `package.json#exports` target isn't a plain
 * module). Our API-route tests only ever hand the handlers a Web `Request`, and
 * next-auth's `NextRequest` constructor is never exercised in those tests (no
 * `AUTH_URL`), so a shape-compatible stub is enough to keep module resolution
 * green without pulling the real Next.js server runtime into jsdom.
 */
export class NextRequest extends Request {}

export class NextResponse extends Response {}
