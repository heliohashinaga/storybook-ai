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

// HTTP security headers (audit §8 / PR #4). Defense-in-depth for an anonymous,
// static+JSON app with no client secrets. Calibrated so the CSP does NOT break
// the reader: it renders data: URIs (provider images) and next/font inlines
// CSS, so img-src must include `data:` and style-src must allow inline. HSTS is
// production-only (the dev server runs over http://localhost).
const securityHeaders: { key: string; value: string }[] = [
  // Content-Security-Policy: block XSS while keeping the app functional.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      cspScriptSrc, // Next inline scripts; + unsafe-eval in dev only
      "style-src 'self' 'unsafe-inline'", // next/font + legit inline styles
      "img-src 'self' data:", // reader shows provider data: images
      "font-src 'self' data:",
      "connect-src 'self'", // only own API (stories/narrate)
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
