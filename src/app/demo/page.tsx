import { StoryRequestApp } from "../../features/story-request/components/story-request-app";

/**
 * `/demo` (US3 / spec 015) — anonymous demo request form. Fully cookie-less:
 * no Auth.js provider, no session. Uses the deterministic pre-generated catalog
 * (spec 012) and the offline demo runtime on the server; `POST /api/stories`
 * resolves to the demo mode because there is no session. No identity is ever
 * sent, logged, or stored.
 */
export default function DemoPage() {
  return <StoryRequestApp isFake={true} />;
}
