import "server-only";
import {
  createRuntimeForMode,
  resolveGenerationMode,
} from "../../../features/story-generation/server/generation-runtime";
import { isAuthenticated } from "../../../features/auth/server/session";
import { createStoriesHandler } from "./create-stories-handler";
import { createTurnstileVerifier } from "../../../features/story-generation/server/turnstile-verify";

/**
 * `POST /api/stories` — the only server entry point for story generation.
 *
 * Privacy & safety contract (see AGENTS.md):
 * - accepts **only** `ageBand`, `locale`, `theme` (server re-validation);
 * - anonymous rate limiting via a short-lived pseudo-anonymous key;
 * - every response is `Cache-Control: no-store` (never persisted);
 * - request and story content are never logged here.
 *
 * The handler logic lives in `./create-stories-handler` (extracted so this file
 * exports only the standard `POST` — Next.js route type generation rejects
 * extra named exports).
 */

const realRuntime = createRuntimeForMode("playground");
const demoRuntime = createRuntimeForMode("demo");

/**
 * Mode-aware `POST /api/stories` (spec 015). The mode is derived **per request**
 * from the session: authenticated → real playground runtime; anonymous → the
 * deterministic demo runtime (never a live model, no credentials needed). The
 * wire contract (`ageBand|locale|theme|sceneCount`) is identical in both modes.
 */
export async function POST(request: Request): Promise<Response> {
  const mode = resolveGenerationMode(await isAuthenticated());
  const runtime = mode === "playground" ? realRuntime : demoRuntime;
  return createStoriesHandler({
    ...runtime,
    // Anti-bot gate is enforced on the anonymous demo path only, and only when
    // the server secret is configured (feature 019). Reads the optional secret
    // directly (mirrors AI_NARRATION_ENABLED) so fake/CI never forces getEnv().
    turnstile: createTurnstileVerifier(process.env.TURNSTILE_SECRET_KEY),
    enforceTurnstile: mode === "demo",
  })(request);
}
