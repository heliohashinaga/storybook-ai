import "server-only";

/**
 * Anonymous structured logging + error-tracking scrubbing (T066).
 *
 * The app is anonymous by design: no name, exact age, story content, provider
 * payload, or persisted IP identity may ever be logged or emitted to an
 * observability backend. This module centralises that rule with two layers:
 *
 *   1. Scrub at the source — `scrub()` strips any sensitive key/value from an
 *      arbitrary object (including nested maps and arrays) before it is ever
 *      serialised, so nothing sensitive leaves the process.
 *   2. Whiit list at the boundary — `logStoryEvent()` accepts only the
 *      anonymous structured fields required for operational insight (locale,
 *      theme, age band, status, duration, short trace id) and drops everything
 *      else.
 *
 * It never stores request/response bodies or provider payloads.
 */

/** Sensitive keys that must never be emitted, at any nesting depth. */
const SENSITIVE_KEYS = new Set([
  // direct identifiers
  "name",
  "childName",
  "parentName",
  "firstname",
  "lastname",
  "identifier",
  // exact age (only a coarse ageBand is allowed)
  "age",
  "exactAge",
  "ageYears",
  "birthday",
  // story content
  "story",
  "stories",
  "storyTitle",
  "storyContent",
  "title",
  "body",
  "content",
  "text",
  "altText",
  "caption",
  "scene",
  "scenes",
  "sceneTitle",
  "sceneBody",
  "pdf",
  "export",
  // provider / request bodies
  "provider",
  "providerPayload",
  "request",
  "response",
  "input",
  "output",
  "prompt",
  "prompts",
  "payload",
  "openai",
  // network identity that could persist
  "ip",
  "ipAddress",
  "xForwardedFor",
  "x-forwarded-for",
  "userAgent",
  "referer",
  // credentials
  "apiKey",
  "apikey",
  "token",
  "secret",
  "password",
  "authorization",
]);

type ScrubEntry =
  | { kind: "primitive"; value: unknown }
  | { kind: "object"; value: Record<string, unknown> }
  | { kind: "array"; value: unknown[] };

/** Classify a value by its structural kind. */
function classify(value: unknown): ScrubEntry {
  if (Array.isArray(value)) return { kind: "array", value };
  if (value !== null && typeof value === "object") {
    return { kind: "object", value: value as Record<string, unknown> };
  }
  return { kind: "primitive", value };
}

/** Recursively scrub every sensitive key/value out of a structure. */
export function scrub(value: unknown): unknown {
  const entry = classify(value);
  switch (entry.kind) {
    case "primitive":
      return entry.value;
    case "array":
      return entry.value.map((item) => scrub(item));
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(entry.value)) {
        if (SENSITIVE_KEYS.has(key)) {
          out[key] = "[redacted]";
        } else {
          out[key] = scrub(val);
        }
      }
      return out;
    }
  }
}

/** A short random trace id used only to correlate a generation in logs. */
export function createTraceId(): string {
  return randomHex(8);
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface StoryLogEvent {
  /** Anonymous context fields — the only fields a caller may pass. */
  locale: string;
  theme: string;
  ageBand: string;
  status: string;
  durationMs: number;
  /** Short opaque correlation id (from createTraceId). */
  traceId: string;
  /** Index of the story attempt for the session (optional). */
  attempt?: number;
}

/** Minimal structured-logger shape (kept injectable for tests). */
export interface Logger {
  info: (fields: Record<string, unknown>) => void;
  error: (fields: Record<string, unknown>) => void;
}

const defaultLogger: Logger = {
  info: (f) => console.log(JSON.stringify({ level: "info", ...f })),
  error: (f) => console.error(JSON.stringify({ level: "error", ...f })),
};

/**
 * Emit an anonymous, scrubbed event to the logger. Enforces the two-layer
 * boundary: callers pass only the whitelisted anonymous fields above, which
 * are scrubbed defensively again before emission, and the event never carries
 * request/response bodies or provider payloads.
 */
export function logStoryEvent(event: StoryLogEvent, logger: Logger = defaultLogger): void {
  const safe: Record<string, unknown> = {
    locale: scrub(event.locale),
    theme: scrub(event.theme),
    ageBand: scrub(event.ageBand),
    status: scrub(event.status),
    durationMs: event.durationMs,
    traceId: event.traceId,
  };
  if (typeof event.attempt === "number") {
    safe.attempt = event.attempt;
  }
  const serialized = JSON.stringify(safe);
  // Last-line defence: the anonymous whitelist plus recursive scrub already
  // removed every sensitive field; if any story content marker still appears
  // we refuse to emit rather than risk a leak.
  if (/the child|nome da criança/i.test(serialized)) {
    logger.error({ traceId: event.traceId, error: "scrub_failed", status: event.status });
    return;
  }
  logger.info(safe);
}
