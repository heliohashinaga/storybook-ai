import { requireSession } from "../../../features/auth/server/session";
import { StoryRequestApp } from "../../../features/story-request/components/story-request-app";
import { ScrollToTop } from "../../../components/ui/scroll-to-top";

// The playground session gate is request-time: without a session cookie this
// page redirects to `/`. Never statically prerender (which would bake the
// anonymous redirect in at build time and make the playground unreachable).
export const dynamic = "force-dynamic";

/**
 * `/reader` route (T302 / Spec 009) — **playground only** (spec 015). Renders
 * the active story reader plus the in-session history switcher (multistory
 * navigation lives here, never on `/form`). `requireSession()` guards this
 * server-side so a deep link / hard reload can never reach it anonymously. The
 * screen mode is derived from the path; `?story=` is rejected/deferred
 * (Spec 011).
 */
export default async function ReaderPage() {
  await requireSession();
  return (
    <>
      <ScrollToTop />
      {/** `isFake` is derived from the mount path (`/reader` ⇒ playground). */}
      <StoryRequestApp />
    </>
  );
}
