# Quickstart & Validation Guide: Personalized Story Generation

This guide defines the runnable validation path to be implemented for feature
`001-personalized-story-generation`. The repository currently contains planning artifacts only;
the commands below become the required package scripts when implementation is bootstrapped.

## Prerequisites

- Node.js 22 LTS and Corepack-enabled pnpm.
- An approved AI-provider development credential. Do not use a production credential locally.
- Provider data-processing approval before sending any real child-related traffic. The application
  does not collect direct identifiers and sends only age band, locale, and theme for generation.

## Setup

```bash
corepack enable
pnpm install
cp .env.example .env.local
```

Set the development-only server secrets in `.env.local`:

```dotenv
OPENROUTER_API_KEY=replace-with-development-key
OPENROUTER_TEXT_MODEL=replace-with-approved-structured-output-model
OPENROUTER_IMAGE_MODEL=replace-with-approved-image-model
OPENROUTER_MODERATION_MODEL=replace-with-approved-moderation-model
```

`.env.local` must be gitignored. It must never contain child data, generated stories, or exported
files.

## Run Locally

```bash
pnpm dev
```

Open `http://localhost:3000`. The default interface locale is `pt-BR`.

## Required Automated Checks

Run these before merging any implementation change:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm storybook:test
pnpm test:e2e
pnpm test:visual
pnpm build
```

Expected checks:

| Command | Expected outcome |
|---------|------------------|
| `pnpm lint` / `pnpm format:check` | No lint warnings or formatting changes. |
| `pnpm typecheck` | Strict TypeScript succeeds with no `any` introduced in production code. |
| `pnpm test` | Unit, component, API-contract, and generation-pipeline tests pass using fixtures/fakes only. |
| `pnpm test:coverage` | At least 80% overall lines/branches and at least 90% lines/branches in safety, validation, direct-identifier exclusion, and generation-orchestration modules. |
| `pnpm storybook:test` | Every component story (default/loading/error/edge) and accessibility check passes. |
| `pnpm test:e2e` | Playwright validates the primary pt-BR and English journeys with a fake provider; no network call reaches a live AI service. |
| `pnpm test:visual` | Approved reader/form screenshots have no unintended diff. |
| `pnpm build` | Production build completes and can serve the anonymous flow. |

## End-to-End Acceptance Scenarios

### 1. Default pt-BR generation (P1)

1. Start the app with the deterministic fake provider enabled.
2. Select age `6`, keep `pt-BR`, and select `coragem`; verify the form contains no name or other
   direct-identifier field.
3. Request a story.
4. Verify a three-scene story appears, every scene has an illustration and localized alt text, and
   the narrative is suitable for the selected age band and theme.
5. Inspect the route fixture/request capture: it contains only `ageBand: "5-7"`, `locale: "pt-BR"`,
   and `theme: "courage"`; it contains no direct identifier or exact age.
6. Verify the reader contains no template/interpolation marker or direct identifier.

### 2. English generation (P3)

1. Change the UI language and requested story locale to English.
2. Generate a story with `friendship` for age `9`.
3. Verify all reader text, scene content, and alt text are English and match age band `8-12`.
4. Verify choosing an unsupported language is blocked with a localized, clear error before any API
   request is sent.

### 3. Safety regeneration (P1 / FR-006)

1. Use the provider fake that returns an unsafe first candidate and a safe second candidate.
2. Request any supported story.
3. Verify the unsafe candidate is not shown, logged, or included in the HTTP response.
4. Verify the reader receives the safe regenerated story and reports the normal success state.
5. Use the fake that returns two unsafe candidates; verify a generic safe retry state is shown,
   without provider details or unsafe text.

### 4. Anonymous session behavior (P2 / P3)

1. Generate two stories with different themes in the same active session.
2. Verify the second request reuses the browser-held age and language preferences without asking again.
3. Navigate next/previous through each story and switch between them in the active tab.
4. Reload the page or open a fresh tab; verify no exact age, preferences, or prior stories are restored.
5. Inspect browser storage, cookies, URLs, network logs, and application logs; verify no direct
   identifier, exact age, or story content is persisted by the application.

### 5. Export and print (FR-013)

1. With a generated story open, select Download/Print.
2. Verify the PDF contains the localized title, all three scenes, and illustrations, with no direct
   child identifier.
3. Verify export generation happens in the browser: no export HTTP request occurs and no final PDF
   is stored by the app.

### 6. Failure handling and accessibility

1. Exercise invalid ages (`1`, `13`, non-integer), unexpected direct-identifier request fields, a
   provider timeout, missing image, and request-rate-limit fixtures.
2. Verify each state has a clear localized recovery message, keyboard-accessible controls, visible
   focus, a non-blocking retry where appropriate, AA contrast for text, and `prefers-reduced-motion`
   respected (no flashing). UI must be styled only with design tokens — no ad-hoc values.
3. Run Storybook accessibility checks and Playwright keyboard flow tests for form, loading, error,
   and reader components.

## Performance Validation

The implementation must record and enforce these budgets in CI:

- Initial form/reader route: LCP at p75 ≤ 2.5 s on a simulated mid-tier mobile/4G profile.
- Initial route JavaScript: ≤ 250 KiB gzip, excluding image data and the lazily loaded PDF module.
- Scene navigation after assets are present: interaction response ≤ 100 ms at p75.
- Full three-scene generation, moderation, images, and response: ≤ 120 s end-to-end under the
  approved provider test environment.
- PDF/export code is dynamically imported and not present in the initial-route bundle.

Use a fixed provider fixture for ordinary CI. A scheduled, credentialed staging check may measure
real provider latency, but must use synthetic non-child data and must not run as part of deterministic
unit/visual tests.
