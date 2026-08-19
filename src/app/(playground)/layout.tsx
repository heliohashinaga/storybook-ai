import { PlaygroundSessionProvider } from "../../features/auth/client/playground-session-provider";

/**
 * Playground route group (`(playground)`): `/form` and `/reader`. The Auth.js
 * session provider is mounted here and **only** here — the anonymous demo path
 * (`/`, `/demo`) never mounts it and never touches a session cookie (spec 015).
 */
export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
  return <PlaygroundSessionProvider>{children}</PlaygroundSessionProvider>;
}
