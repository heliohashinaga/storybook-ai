import "server-only";
import { z } from "zod";
import type { TtsRuntime } from "../../../features/story-read-aloud/server/tts-runtime";
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
  ANONYMOUS_GLOBAL_KEY,
  createPseudoAnonymousKey,
  resolveClientIp,
  type RateLimiter,
} from "../../../lib/rate-limit";

/**
 * `createNarrateHandler` seam for `POST /api/narrate` (spec 004, US1-US3).
 *
 * Extracted from the route module so the route file exports only the standard
 * `POST` handler — Next.js route type generation rejects extra named exports,
 * which broke the webpack build's type check. The factory keeps its
 * dependency-injection seam so contract/unit tests can wire a fake runtime.
 *
 * Privacy & contract: accepts ONLY anonymous `sceneText` + `locale`, never an
 * identifier, exact age, or theme; every response is `Cache-Control: no-store`.
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

/** True when the raw payload carries an explicit but unsupported locale. */
function isUnsupportedLocalePayload(payload: unknown): boolean {
  const raw = payload as { locale?: unknown } | null;
  return (
    raw !== null && typeof raw.locale === "string" && !localeSchema.safeParse(raw.locale).success
  );
}

export interface NarrateRouteDeps {
  runtime: TtsRuntime;
  /** Per-anonymous-user rate limiter for TTS synthesis (spec 004 rate-limit). */
  rateLimiter: RateLimiter;
  /** Per-boot salt used to derive the pseudo-anonymous bucket key. */
  salt: string;
  /**
   * True when requests arrive through a trusted reverse proxy that rewrites
   * `X-Forwarded-For` (e.g. Vercel). When false, the header is treated as
   * client-forgeable and ignored (audit PR #2).
   */
  trustForwardedFor: boolean;
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
      if (isUnsupportedLocalePayload(payload)) {
        return jsonError(422, toNarrateErrorJson(narrateUnsupportedLocale));
      }
      return jsonError(400, toNarrateErrorJson(narrateInvalidInput));
    }

    // Anonymous per-user TTS budget (spec 004 rate-limit): bound synthesis cost
    // without storing any identity. The salt is per-boot and the IP is hashed,
    // so no raw IP or identifier is ever retained.
    const ip = resolveClientIp(
      {
        forwardedFor: request.headers.get("x-forwarded-for"),
        realIp: request.headers.get("x-real-ip"),
      },
      { trustForwardedFor: deps.trustForwardedFor }
    );
    const key = ip ? createPseudoAnonymousKey({ ip, salt: deps.salt }) : ANONYMOUS_GLOBAL_KEY;
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
