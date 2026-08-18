import { StoryRequestApp } from "../../../features/story-request/components/story-request-app";

/**
 * `/demo/reader` (US3 / spec 015) — anonymous demo story reader. Same cookie-less
 * guarantee as `/demo`; the screen mode is derived from the path (see
 * `deriveScreenFromPath`), so this URL renders the reader screen of the demo
 * catalog. No identity is ever sent, logged, or stored.
 */
export default function DemoReaderPage() {
  return <StoryRequestApp isFake={true} />;
}
