import { ClerkProviderGate } from "../../features/auth/client/clerk-provider";

// Authenticated playground routes are rendered on demand so the Clerk provider
// is present at request time; the anonymous demo path never mounts it (spec 018
// / ADR 0013).
export const dynamic = "force-dynamic";

/**
 * Playground route group (`(playground)`): `/form` and `/reader`. The Clerk
 * provider is mounted here and **only** here — the anonymous demo path
 * (`/`, `/demo`) never mounts it and never touches a session cookie (spec 018 /
 * ADR 0013). On a demo-only deploy (no Clerk keys) it renders children without
 * a provider, so the demo stays cookie/anonymity-free.
 */
export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProviderGate>{children}</ClerkProviderGate>;
}
