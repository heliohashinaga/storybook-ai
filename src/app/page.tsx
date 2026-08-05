/**
 * Minimal root page shell (Phase 1 placeholder).
 *
 * The personalized story form and story-reader land in Phase 3 (T033 onwards).
 * This bare server component only exists so the app serves a real `/` route
 * (required for the Playwright e2e/visual webServer readiness gate). No story
 * features, no identifiers, no feature copy — that is owned by T033.
 */
export default function HomePage() {
  return <section />;
}
