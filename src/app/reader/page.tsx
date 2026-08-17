import { StoryRequestApp } from "../../features/story-request/components/story-request-app";

/**
 * `/reader` route (T302 / Spec 009). Renders the active story reader plus the
 * in-session history switcher (multistory navigation lives here, never on
 * `/form`). A `/reader` without a session (deep-link / reload) redirects to the
 * clean `/form` via the client session gate. The screen mode is derived from the
 * path; `?story=` is rejected/deferred (Spec 011).
 */
export default function ReaderPage() {
  const isFake = process.env.STORIES_TEST_MODE === "fake";
  return <StoryRequestApp isFake={isFake} />;
}
