import "server-only";

/**
 * Identity metadata sent to AI providers (e.g. OpenRouter) as optional
 * HTTP headers so the app can be identified in provider-side dashboards and
 * rankings. These are APP identity only — never a direct identifier of the
 * child, so the anonymous-by-design invariant is preserved.
 */
export const APP_NAME = "storybook-ai";

/** OpenRouter-supported identification header to attach to every provider request. */
export const OPENROUTER_APP_HEADERS: Readonly<Record<string, string>> = {
  "X-Title": APP_NAME,
};
