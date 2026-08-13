import "server-only";
import { z } from "zod";
import {
  createTtsRuntime,
  type TtsRuntime,
} from "../../../features/story-read-aloud/server/tts-runtime";
import type { TtsProviderError } from "../../../features/story-read-aloud/server/tts-provider";
import {
  narrateInvalidInput,
  narrateRateLimited,
  narrateTimeout,
  narrateUnavailable,
  narrateUnsupportedLocale,
  toNarrateErrorJson,
  type NarrateHttpError,
} from "../../../features/story-read-aloud/server/narrate-http-errors";
import {
  createPseudoAnonymousKey,
  generateSalt,
  InMemoryRateLimiter,
  type RateLimiter,
} from "../../../lib/rate-limit";

/**
 * `POST /api/narrate` — server-only AI narration (spec 004, US1-US3).
 *
 * Privacy & contract (see `contracts/tts.openapi.yaml` + AGENTS.md):
 * - accepts **only** anonymous scene text and locale (never an identifier,
 *   exact age, or theme); server re-validates with Zod;
 * - when `AI_NARRATION_ENABLED=false` the client uses browser Web Speech
 *   directly and this endpoint is never called — we still answer 204 as a
 *   safety net for misbehaving clients;
 * - every response is `Cache-Control: no-store` (zero persistence);
 * - `sceneText` is never logged and the response is transient audio bytes;
 * - on provider failure there is NO fallback to Web Speech — an accessible
 *   typed error (502/504/429) is returned instead (US2).
 */

/** Upper bound for `sceneText` — mirrors the test-contract fixture. */
export const NARRATE_TEXT_MAX = 2000;

const localeSchema = z.enum(["pt-BR", "en"]);

const narrateRequestSchema = z
  .object({
    sceneText: z.string().trim().min(1).max(NARRATE_TEXT_MAX),
    locale: localeSchema,
  })
  .strict();

const NO_STORE = {
  "Cache-Control": "no-store",
} as const;

function jsonError(status: number, body: ReturnType<typeof toNarrateErrorJson>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...NO_STORE },
  });
}

/** Maps a typed {@link TtsProviderError} kind to a wire-safe JSON error. */
function providerErrorJson(error: TtsProviderError): Response {
  const target: NarrateHttpError = error.kind === "timeout" ? narrateTimeout : narrateUnavailable;
  return jsonError(target.status, toNarrateErrorJson(target));
}

export interface NarrateRouteDeps {
  runtime: TtsRuntime;
  /** Per-anonymous-user rate limiter for TTS synthesis (spec 004 rate-limit). */
  rateLimiter: RateLimiter;
  /** Per-boot salt used to derive the pseudo-anonymous bucket key. */
  salt: string;
}

export function createNarrateHandler(deps: NarrateRouteDeps) {
  return async function POST(request: Request): Promise<Response> {
    if (!deps.runtime.enabled) {
      // AI narration off → the client should be using Web Speech. Answering
      // 204 keeps us honest: no audio, no fallback, just an explicit "off".
      return new Response(null, { status: 204, headers: NO_STORE });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return jsonError(400, toNarrateErrorJson(narrateInvalidInput));
    }

    const parsed = narrateRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const raw = payload as { locale?: unknown } | null;
      if (raw && typeof raw.locale === "string" && !localeSchema.safeParse(raw.locale).success) {
        return jsonError(422, toNarrateErrorJson(narrateUnsupportedLocale));
      }
      return jsonError(400, toNarrateErrorJson(narrateInvalidInput));
    }

    // Anonymous per-user TTS budget (spec 004 rate-limit): bound synthesis cost
    // without storing any identity. The salt is per-boot and the IP is hashed,
    // so no raw IP or identifier is ever retained.
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = forwarded || "unknown";
    const key = createPseudoAnonymousKey({ ip, salt: deps.salt });
    const rate = await deps.rateLimiter.consume(key);
    if (!rate.allowed) {
      const response = jsonError(429, toNarrateErrorJson(narrateRateLimited));
      response.headers.set("Retry-After", String(rate.retryAfterSeconds ?? 1));
      return response;
    }

    const { sceneText, locale } = parsed.data;
    // Only `sceneText`/`locale` are sent to the provider — no identifier,
    // exact age, or theme ever crosses this boundary.
    let narration;
    try {
      narration = await deps.runtime.synthesize(sceneText, { locale });
    } catch (error) {
      // Provider failure with AI enabled → accessible typed error, no Web
      // Speech fallback, no retry loop (US2).
      return providerErrorJson(error as TtsProviderError);
    }

    return new Response(new Uint8Array(narration.audio), {
      status: 200,
      headers: {
        "Content-Type": narration.format,
        ...NO_STORE,
      },
    });
  };
}

const TTS_RATE_LIMIT_MAX_REQUESTS = Number(process.env.TTS_RATE_LIMIT_MAX_REQUESTS ?? 30);
const TTS_RATE_LIMIT_WINDOW_MS = Number(process.env.TTS_RATE_LIMIT_WINDOW_MS ?? 60_000);

const runtime = createTtsRuntime();

const salt = generateSalt();
const rateLimiter = new InMemoryRateLimiter({
  limit: TTS_RATE_LIMIT_MAX_REQUESTS,
  windowMs: TTS_RATE_LIMIT_WINDOW_MS,
});

export const POST = createNarrateHandler({ runtime, rateLimiter, salt });
