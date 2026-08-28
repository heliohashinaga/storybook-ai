import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withBundleAnalyzer from "@next/bundle-analyzer";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Bundle analyzer. Next 16 builds with Turbopack by default, but
// `@next/bundle-analyzer` hooks the **webpack** config, so analysis requires a
// webpack build (`next build --webpack`, see the `analyze` script). The default
// Turbopack production build is untouched because the plugin is a no-op unless
// `ANALYZE=true`. `analyzerMode: "static"` writes report HTML files and exits
// instead of launching a browser (headless/CI friendly).
const withAnalysis = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  analyzerMode: "static",
});

const isProduction = process.env.NODE_ENV === "production";
// React in dev mode uses eval() for debugging (callstack reconstruction / hot
// reload). Production never uses eval, so we keep the strict CSP there and only
// loosen script-src in dev to avoid the "eval() is not supported" console warning.
const cspScriptSrc = isProduction
  ? "script-src 'self' 'unsafe-inline'" // Next bootstrap; strict, no eval
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'"; // dev-only

// EXPLICIT RELAXATION (signed off, per AGENTS.md — no unlabeled loosening):
// Clerk's client SDK loads its JS runtime + CSS and talks to its Frontend API
// (FAPI) from the Clerk accounts domain. Dev instances serve `*.clerk.accounts.dev`;
// production serves `*.clerk.accounts`. A custom Clerk domain (spec 018 / ADR 0013)
// is served from the app's own origin: with production keys, `clerkMiddleware`
// auto-proxies the FAPI/clerk-js through `'self'` (already CSP-allowed). A
// separately-hosted auth subdomain (`CLERK_PROXY_URL`) is added explicitly
// below for completeness. Without these origins the <SignIn>/<SignUp>
// components fail with `failed_to_load_clerk_js`.
const clerkManagedOrigins = "https://*.clerk.accounts.dev https://*.clerk.accounts";
const clerkProxyOrigin = process.env.CLERK_PROXY_URL
  ? new URL(process.env.CLERK_PROXY_URL).origin
  : "";
const clerkOrigins = (
  clerkManagedOrigins + (clerkProxyOrigin ? ` ${clerkProxyOrigin}` : "")
).trim();

// EXPLICIT RELAXATION (signed off, ADR 0014 — no unlabeled loosening): the demo
// anti-bot widget (Cloudflare Turnstile, feature 019) loads its JS + challenge
// iframe/styles/images from `challenges.cloudflare.com`. Without these origins
// on script/frame/connect/style/img/worker-src the widget silently fails on the
// (already third-party-contacting) demo path.
const turnstileOrigins = "https://challenges.cloudflare.com";

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
      cspScriptSrc + " " + clerkOrigins + " " + turnstileOrigins, // Next inline; Clerk JS; + Turnstile widget
      "style-src 'self' 'unsafe-inline' " + clerkOrigins + " " + turnstileOrigins, // + Turnstile inline styles
      // RELAXATION (signed off): Clerk serves OAuth provider logos (Google "G",
      // etc.) from its image CDN `https://img.clerk.com`, not the FAPI accounts
      // domain — without it, img-src blocks the logo and the button renders
      // icon-less. Scoped to img-src only.
      "img-src 'self' data: " + clerkOrigins + " https://img.clerk.com " + turnstileOrigins, // + Turnstile assets
      "font-src 'self' data:",
      "connect-src 'self' data: " + clerkOrigins + " " + turnstileOrigins, // + Turnstile siteverify/script
      // RELAXATION (signed off): the AI read-aloud client plays transient audio
      // via a blob: URL, and Chromium resolves media blobs under `media-src`.
      // Without it, default-src 'self' blocks the blob and the <audio> element
      // reports "no supported source". Scoped to media only.
      "media-src 'self' blob:",
      "worker-src 'self' blob: " + clerkOrigins + " " + turnstileOrigins, // @react-pdf worker + Clerk + Turnstile worker
      "frame-src 'self' " + clerkOrigins + " " + turnstileOrigins, // Clerk embeds + Turnstile challenge iframe
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
  env: {
    // Clerk routing URLs (spec 018). Defaults match the embedded <SignIn>/<SignUp>
    // on `/` and the post-auth playground `/form`. Without these, Clerk falls back
    // to its hosted Account Portal (`*.clerk.accounts.dev`), pulling users off
    // our anonymous-by-design `/` login screen. Overridable via real env /
    // .env.local (which takes precedence over this block).
    CLERK_SIGN_IN_URL: "/",
    CLERK_SIGN_UP_URL: "/",
    CLERK_AFTER_SIGN_IN_URL: "/form",
    CLERK_AFTER_SIGN_UP_URL: "/form",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withAnalysis(withNextIntl(nextConfig));
