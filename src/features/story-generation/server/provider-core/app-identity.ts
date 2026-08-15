import "server-only";

/**
 * Identity metadata sent to AI providers (e.g. OpenRouter) as optional
 * HTTP headers so the app can be identified in provider-side dashboards and
 * rankings. These are APP identity only — never a direct identifier of the
 * child, so the anonymous-by-design invariant is preserved.
 */
export const APP_NAME = "Storybook AI";

/** Optional public URL of the deployed app (used as the OpenRouter `HTTP-Referer`). */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://storybook-ai.example.com";

/** OpenRouter-supported identification headers to attach to every provider request. */
export const OPENROUTER_APP_HEADERS: Readonly<Record<string, string>> = {
  "X-Title": APP_NAME,
  "HTTP-Referer": APP_URL,
};
