import { requireSession } from "../../../features/auth/server/session";
import { StoryRequestApp } from "../../../features/story-request/components/story-request-app";

// The playground session gate is request-time: without a session cookie this
// page redirects to `/`. Never statically prerender (which would bake the
// anonymous redirect in at build time and make the playground unreachable).
export const dynamic = "force-dynamic";

/**
 * `/form` route (T301 / Spec 009) — **playground only** (spec 015). This is the
 * authenticated real-LLM request form (and the inline `submitting` generation
 * progress while `POST /api/stories` runs). `requireSession()` guarantees an
 * authenticated session server-side; anonymous visitors are sent to the login
 * gate `/`. The screen mode is derived from the path by the client wrapper and
 * the in-memory session is shared via the root layout's `StorySessionProvider`.
 */
export default async function FormPage() {
  await requireSession();
  const isFake = process.env.STORIES_TEST_MODE === "fake";
  return <StoryRequestApp isFake={isFake} />;
}
