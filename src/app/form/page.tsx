import { StoryRequestApp } from "../../features/story-request/components/story-request-app";

/**
 * `/form` route (T301 / Spec 009). Renders the anonymous request form (and the
 * inline `submitting` generation progress while `POST /api/stories` runs — the
 * URL stays `/form`, there is no `/steps` route). The screen mode is derived
 * from the path by the client wrapper; the in-memory session is shared via the
 * root layout's `StorySessionProvider`.
 */
export default function FormPage() {
  const isFake = process.env.STORIES_TEST_MODE === "fake";
  return <StoryRequestApp isFake={isFake} />;
}
