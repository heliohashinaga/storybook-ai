import "server-only";
import {
  createTtsRuntime,
  createDemoTtsRuntime,
} from "../../../features/story-read-aloud/server/tts-runtime";
import { isAuthenticated } from "../../../features/auth/server/session";
import { createNarrateHandler } from "./create-narrate-handler";
import { generateSalt, InMemoryRateLimiter, trustForwardedForEnv } from "../../../lib/rate-limit";

/**
 * `POST /api/narrate` — server-only AI narration (spec 004, US1-US3).
 *
 * Privacy & contract (see `contracts/tts.openapi.yaml` + AGENTS.md):
 * - accepts **only** anonymous scene text and locale (never an identifier,
 *   exact age, or theme); server re-validates with Zod via `createNarrateHandler`;
 * - when `AI_NARRATION_ENABLED=false` the client uses browser Web Speech
 *   directly and this endpoint is never called — we still answer 204 as a
 *   safety net for misbehaving clients;
 * - every response is `Cache-Control: no-store` (zero persistence);
 * - `sceneText` is never logged and the response is transient audio bytes;
 * - on provider failure there is NO fallback to Web Speech — an accessible
 *   typed error (502/504/429) is returned instead (US2).
 *
 * The handler logic lives in `./create-narrate-handler` (extracted so this file
 * exports only the standard `POST` — Next.js route type generation rejects
 * extra named exports).
 */

const TTS_RATE_LIMIT_MAX_REQUESTS = Number(process.env.TTS_RATE_LIMIT_MAX_REQUESTS ?? 30);
const TTS_RATE_LIMIT_WINDOW_MS = Number(process.env.TTS_RATE_LIMIT_WINDOW_MS ?? 60_000);

const realRuntime = createTtsRuntime();
const demoRuntime = createDemoTtsRuntime();

const salt = generateSalt();
const rateLimiter = new InMemoryRateLimiter({
  limit: TTS_RATE_LIMIT_MAX_REQUESTS,
  windowMs: TTS_RATE_LIMIT_WINDOW_MS,
});

/**
 * Mode-aware `POST /api/narrate` (spec 015). Mirrors the generation runtime:
 * the anonymous demo path always synthesizes with the deterministic offline
 * provider (never a live model), while the authenticated playground may use the
 * real TTS adapter. The contract (anonymous `sceneText`|`locale`) is unchanged.
 */
export async function POST(request: Request): Promise<Response> {
  // Narration runtime follows auth + `AI_NARRATION_ENABLED` (not
  // `resolveGenerationMode`, which forces demo under `STORIES_TEST_MODE=fake`
  // for story generation). This lets a local fake-generation run still exercise
  // real AI narration on the authenticated playground, while the anonymous
  // demo stays offline (spec 015). `demoRuntime` answers 204 (Web Speech).
  const authed = await isAuthenticated();
  const aiEnabled = process.env.AI_NARRATION_ENABLED === "true";
  const runtime = authed && aiEnabled ? realRuntime : demoRuntime;
  return createNarrateHandler({
    runtime,
    rateLimiter,
    salt,
    trustForwardedFor: trustForwardedForEnv(),
  })(request);
}
