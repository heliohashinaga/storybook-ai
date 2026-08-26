import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProduction = process.env.NODE_ENV === "production";
// React in dev mode uses eval() for debugging (callstack reconstruction / hot
// reload). Production never uses eval, so we keep the strict CSP there and only
// loosen script-src in dev to avoid the "eval() is not supported" console warning.
const cspScriptSrc = isProduction
  ? "script-src 'self' 'unsafe-inline'" // Next bootstrap; strict, no eval
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'"; // dev-only

// EXPLICIT RELAXATION (signed off, per AGENTS.md — no unlabeled loosening):
// Clerk's client SDK loads its JS runtime + CSS and talks to its API from the
// Clerk accounts domain. Dev instances serve `*.clerk.accounts.dev`; production
// serves `*.clerk.accounts`. A custom Clerk domain would need to be added here
// too. Without these the <SignIn>/<SignUp> components fail with
// `failed_to_load_clerk_js`.
const clerkOrigins = "https://*.clerk.accounts.dev https://*.clerk.accounts";

// HTTP security headers (audit §8 / PR #4). Defense-in-depth for an anonymous,
// static+JSON app with no client secrets. Calibrated so the CSP does NOT break
// the reader: it renders data: URIs (provider images) and next/font inlines
// CSS, so img-src must include `data:` and style-src must allow inline. HSTS is
// production-only (the dev server runs over http://localhost).
//
// EXPLICIT RELAXATIONS (signed off, per AGENTS.md - no unlabeled loosening):
// the client-side PDF export lazy-loads `@react-pdf/renderer`, which fetches its
// WASM yoga binary via a `data:` URI and spawns a layout Web Worker from a
// `blob:` URL. So `connect-src` gains `data:` and `worker-src` is added with
// `blob:`, scoped to keep everything else strict (default-src 'self', no eval in
// prod, frame-ancestors/object-src/base-uri/form-action locked down).
const securityHeaders: { key: string; value: string }[] = [
  // Content-Security-Policy: block XSS while keeping the app functional.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      cspScriptSrc + " " + clerkOrigins, // Next inline; + Clerk JS runtime (accounts.dev / .accounts)
      "style-src 'self' 'unsafe-inline' " + clerkOrigins, // next/font + legit inline styles + Clerk CSS
      "img-src 'self' data: " + clerkOrigins, // reader shows provider data: images + Clerk avatars
      "font-src 'self' data:",
      "connect-src 'self' data: " + clerkOrigins, // self API + @react-pdf WASM + Clerk API
      // RELAXATION (signed off): the AI read-aloud client plays transient audio
      // via a blob: URL, and Chromium resolves media blobs under `media-src`.
      // Without it, default-src 'self' blocks the blob and the <audio> element
      // reports "no supported source". Scoped to media only.
      "media-src 'self' blob:",
      "worker-src 'self' blob: " + clerkOrigins, // @react-pdf worker + Clerk worker
      "frame-src 'self' " + clerkOrigins, // Clerk embeds (captcha/iframes) if used
      "frame-ancestors 'none'", // anti-clickjacking
      "base-uri 'none'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
  // MIME-sniffing: never reinterpret a response body as something else.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking: the app is anonymous and should never be embedded.
  { key: "X-Frame-Options", value: "DENY" },
  // Only send the origin on cross-origin navigation (limits referrer leakage
  // to the AI provider / CDN while keeping auth-relevant self-origin intact).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ...(isProduction
    ? [
        // Force HTTPS in production only; never over http in dev.
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The app is anonymous by design and posts only ageBand/locale/theme to the
  // single server entry point. Enforce the server-only boundary so provider /
  // SDK / sharp modules can never leak into client bundles.
  serverExternalPackages: ["sharp", "openai"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
