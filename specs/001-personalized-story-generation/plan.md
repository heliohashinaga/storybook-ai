# Implementation Plan: Personalized Story Generation

**Branch**: `001-personalized-story-generation` | **Date**: 2026-08-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-personalized-story-generation/spec.md`

## Summary

Build an anonymous, responsive web experience where a parent selects a child's age, language, and
a positive-value theme to receive a safe, relevant, illustrated three-scene story. The product does
not ask for or receive a child's name or any other direct identifier. The MVP supports `pt-BR`
(default) and English; age bands 2–4, 5–7, and 8–9; and courage, friendship, and kindness themes.
Stories are read scene-by-scene and exported/printed locally as a PDF.

Use one full-stack Next.js application. Browser memory retains the exact age and generated stories
for the open tab only. The server receives only derived age band, locale, and theme; it uses a
provider adapter to generate, moderate, and illustrate an anonymous story. No direct child
identifier is collected, sent to the server/provider, or retained by the application.

## Technical Context

**Language/Version**: TypeScript 5.x in strict mode (`strict`, `noUncheckedIndexedAccess`); Node.js 22 LTS.

**Primary Dependencies**: Next.js 16 App Router + React 19; Zod for input/provider schemas;
`next-intl` for UI localization; Tailwind CSS for tokenized UI styling; the OpenRouter SDK/
compatible client behind a server-only provider adapter; `sharp` for transient WebP optimization; `@react-pdf/renderer` for
lazily loaded client-side export.

**Storage**: No database, object store, account store, cookies, browser durable storage, or server
story cache. React in-memory state holds active-session data. The generation route returns
`Cache-Control: no-store`. V1 enforces **anonymous rate limiting** on generation: short time
window, short-lived pseudo-anonymous key (e.g., salted, rotated hash of IP), localized `429`;
the key must never become a direct identifier or store story content/profile. There is **no
story-count cap per session** — the parent/child may generate as many stories as they want until
the tab closes; the short-window rate limit is the only cost protection, and session memory holds
generated stories in the browser only.

**Testing**: Vitest + React Testing Library; MSW/provider fakes for integration and contract tests;
Storybook component/accessibility tests; Playwright for end-to-end, keyboard, and visual-regression
tests. All normal CI tests use fixtures and never call a live AI service.

**Target Platform**: Modern mobile and desktop browsers; Node.js server runtime (not Edge) so image
optimization can use `sharp`; standard Node-compatible serverless/container deployment.

**Project Type**: Single full-stack web application.

**Performance Goals**:

- Complete generation (story, safety, three illustrations) in ≤120 seconds end-to-end.
- Initial form/reader LCP at p75 ≤2.5 seconds on a simulated mid-tier mobile/4G profile.
- Initial route JavaScript ≤250 KiB gzip, excluding scene images and lazy PDF-export code.
- Scene navigation after assets load at p75 ≤100 ms.

**Constraints**:

- Anonymous only: no account, server-side profile, story history, child data persistence, or direct
  child identifier in the form, request, log, analytics, or provider payload.
- Exact launch locales: `pt-BR` default and English. Exact launch themes: courage, friendship,
  kindness — **exactly one theme per story**; multi-theme combinations are out of scope for v1. Exact age bands: 2–4, 5–7, 8–9.
- Exactly three scenes per MVP story — validated constant `N = 3`, the scene-count extension
  point for a future variable count (3, 4, or 5 per team direction); each scene must have an
  approved illustration and localized alt text.
- Safety pipeline must prevent unsafe candidates — story text **and each illustration** — from
  being returned, auto-regenerate once, and expose only safe generic error states if no safe
  candidate can be produced. A scene is complete only when its text and its illustration both pass.
- PDF is generated locally in the browser and must not trigger an export/upload request.

**Scale/Scope**: One public responsive application; three user-facing flows (create/read,
re-generate in an active tab, download/print); one active generation per tab; two locale paths;
three themes; no persistence or multi-user features. Apply a platform/provider rate limit to guard
anonymous generation and keep load within the approved provider quota.

**Future (out of MVP scope)**: A Multi-Agent System (Coordinator, Planner, Writer, Reviewer,
Illustrator) is a planned future evolution of the generation pipeline. It will replace the single
provider adapter behind the same `StoryGenerationProvider` interface and the same API contract.
It is recorded in
[future-multi-agent-system.md](./future-multi-agent-system.md) and will be specced as its own
feature. It does not change this MVP plan.

## Constitution Check

### Pre-Research Gate

| Constitution requirement | Plan response | Status |
|---|---|---|
| I. Code Quality | Strict TypeScript, Zod at UI/API/provider boundaries, feature-based modules, documented OpenAPI contract, no `any`. | PASS |
| II. Testing Standards | Test-first tasks; deterministic provider fixtures; unit, integration, contract, Storybook, accessibility, E2E, and visual test tiers. Feature target: ≥80% overall and ≥90% safety/validation/orchestration coverage. | PASS |
| III. UX Consistency | Shared tokenized UI primitives; component stories for default/loading/error/edge states; keyboard and screen-reader checks; `pt-BR`/English static strings; identical reader behavior in Storybook and app. UI work follows the repo design-system conventions (`.pi/skills/design-system`): semantic token taxonomy, primitive API contract (variant/size/state, no ad-hoc values), accessibility bar (AA contrast, keyboard, `aria-live`, reduced motion), and visual-regression baseline workflow. | PASS |
| IV. Performance | `N = 3` scene constant (validated, scene-count extension point); parallel bounded image generation; transient optimized WebP images; lazy PDF module; explicit route, interaction, and end-to-end budgets, parameterized by scene count. | PASS |
| Privacy / child safety | No child name or other direct identifier is collected. Exact age remains only in browser memory; the server/provider receives only age band, locale, and theme. No durable app data or unsafe intermediate content is returned. Provider data-processing approval is a production-release gate. | PASS |

**Gate result**: PASS. No constitution violation is required.

## Project Structure

### Documentation (this feature)

```text
specs/001-personalized-story-generation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── story-generation.openapi.yaml
└── tasks.md                    # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   └── stories/
│   │       └── route.ts                    # Validates request, invokes pipeline, sends no-store response
│   ├── layout.tsx
│   ├── page.tsx                            # Session-scoped create/read experience
│   └── globals.css
├── components/
│   └── ui/                                 # Shared, tokenized accessible primitives
├── features/
│   ├── story-request/
│   │   ├── components/
│   │   │   ├── story-request-form.tsx
│   │   │   ├── story-request-form.stories.tsx
│   │   │   └── story-generation-progress.tsx
│   │   ├── client/
│   │   │   ├── story-preferences-schema.ts
│   │   │   ├── age-band.ts
│   │   │   └── story-session-context.tsx
│   │   └── locales/
│   │       ├── en.json
│   │       └── pt-BR.json
│   ├── story-generation/
│   │   └── server/
│   │       ├── schemas.ts
│   │       ├── story-generation-provider.ts
│   │       ├── openrouter-story-generation-provider.ts
│   │       ├── safety-pipeline.ts
│   │       ├── image-optimizer.ts
│   │       └── generate-story.ts
│   ├── story-reader/
│   │   ├── components/
│   │   │   ├── story-reader.tsx
│   │   │   ├── scene-view.tsx
│   │   │   └── scene-view.stories.tsx
│   │   └── client/
│   │       └── story-response.ts
│   └── story-export/
│       ├── components/
│       │   └── export-story-button.tsx
│       └── client/
│           └── build-story-pdf.tsx
├── i18n/
│   └── config.ts
└── lib/
    ├── env.ts
    ├── http-errors.ts
    └── rate-limit.ts

.storybook/
├── main.ts
└── preview.ts

tests/
├── unit/
│   ├── age-band.test.ts
│   ├── story-preferences-schema.test.ts
│   ├── story-response.test.ts
│   └── safety-pipeline.test.ts
├── integration/
│   ├── generate-story-route.test.ts
│   └── provider-pipeline.test.ts
├── contract/
│   └── story-generation.openapi.test.ts
├── e2e/
│   ├── generate-pt-br.spec.ts
│   ├── generate-english.spec.ts
│   ├── safety-regeneration.spec.ts
│   └── anonymous-session-and-export.spec.ts
├── visual/
│   └── reader.spec.ts
└── fixtures/
    └── story-generation/
```

**Structure Decision**: A single Next.js project is selected. The route is the only server entry
point; AI vendor integration is isolated inside `story-generation/server`; exact age is derived to
an age band in client-side state and PDF assembly remains client-side; feature components and their
Storybook stories are co-located.

## Design Details

### Request and privacy flow

1. The form validates the **exact age** (number, 2–9), locale, and theme in the browser; it
   contains no name or other direct-identifier field.
2. The browser derives `ageBand` and posts only `ageBand`, `locale`, and `theme` to
   `POST /api/stories`; direct identifiers and the exact age are never serialized — the exact-age
   value must not cross the network, appear in logs/telemetry, or be written to any storage (a test
   asserts this).
3. The route repeats schema validation, rate-limits safely, creates a server-owned age-appropriate
   anonymous-protagonist prompt, and asks the provider adapter for a structured three-scene story.
4. The safety pipeline validates plain-text structure, rejects interpolation markers/identifiers,
   moderates narrative **and each illustration** (text and image candidates), retries generation
   once with stronger safe constraints when required, and creates illustrations only from approved
   prompts; a scene is complete only when its text and its illustration both pass.
5. The route optimizes the three transient images to WebP data URIs and returns the approved story
   with `Cache-Control: no-store`.
6. Browser code adds the result to React session state and renders scenes. No app code serializes
   that state to durable storage. A "generate another" action re-uses the current age band, locale,
   and theme and **appends a new story to the session** — it never replaces the current story, and
   it counts against the same anonymous rate limit.
7. The export button dynamically loads the PDF module and creates/downloads the document locally.

### Failure and recovery flow

- Invalid age, unsupported locale/theme, and unexpected direct-identifier fields are caught before
  a provider call and shown as localized field-level errors.
- Provider schema/moderation/image failures never return raw output. The user receives a sanitized,
  localized retry state with a safe alternative action.
- A request that exceeds the time budget or rate limit returns a typed error contract. The existing
  session stories remain readable.
- A partial image set is not a successful story; retry the missing image once, then return a typed
  recoverable error rather than an incomplete story.

### Illustration generation

- The three illustrations share the same art style and a coherent character: the image prompt
  reuses a fixed style descriptor plus a stable anonymous character description derived from the
  age band across all three scenes.
- A consistency check validates the three illustrations as a set; an inconsistent or partial set is
  not a successful story (retry once, else a typed recoverable error).
- Each illustration passes the same safety pipeline as the narrative before it is shown.
- Images are optimized to transient WebP data URIs on the Node runtime and never persisted.

### Observability

- Production logs are anonymous and structured (locale, theme, age band, status, duration, short
  trace ID); no name, exact age, story content, provider payloads, or persisted IP identity.
- Error tracking (e.g., Sentry) is allowed with mandatory two-layer scrubbing: in the SDK before any
  data leaves the app, and server-side without storing request/response bodies.
- No app code serializes story content or the exact age to logs, telemetry, or storage.

### UI and accessibility conventions

- **Tokens**: style only with the semantic design tokens (color/typography/spacing/radius/shadow/motion) defined in the Tailwind theme and `globals.css`; no ad-hoc hex, px, or arbitrary values; inline styles forbidden except justified computed values. Dark mode, if added, must be a token swap.
- **Primitives**: shared primitives live in `src/components/ui` with an explicit API contract (`variant`/`size`/state props such as disabled, loading, error), forwarded refs where element identity matters, and no business logic. Feature composites live in `src/features/*/components`.
- **Accessibility bar**: contrast AA (4.5:1) for text; full keyboard navigation with visible focus; correct ARIA roles/labels; `aria-live` for generation progress and errors, `aria-busy` while loading; localized meaningful alt text per scene (decorative images `alt=""` + `aria-hidden`); respect `prefers-reduced-motion`.
- **React 19 hooks**: use `useActionState`/`useTransition`/`useOptimistic` for form submission and pending states; `use` for async; avoid `useEffect` for derived state. Server Actions or the single Route Handler only — no extra endpoints.
- **Visual regression**: approved screenshots are the baseline; any diff must be intentional and reviewed — no blind baseline updates.

### Quality gates

- Every UI state has a Storybook story: normal, form validation error, loading/progress, safe retry,
  rate limit, scene first/middle/last, and export-disabled/export-ready.
- Provider, moderation, and image APIs are fully faked in normal tests. Tests assert that no direct
  identifier is accepted by the form/API or appears in HTTP payloads, logs, or provider fake inputs;
  that the exact-age value never crosses the network; that each illustration (not only the text)
  passes moderation; and that a scene is complete only when text and image both pass.
- Illustration consistency and anonymous observability are exercised by tests: a set of three
  inconsistent images is not a successful story, and telemetry scrubs story content and the exact
  age (asserted in logging tests).
- API behavior is tested against `contracts/story-generation.openapi.yaml`; route responses include
  `Cache-Control: no-store`.
- CI runs lint, format check, strict typecheck, tests + coverage, Storybook/a11y checks, E2E, visual
- Coverage is enforced directly in `vitest.config.ts`: a global ≥80% floor across lines/branches/functions/statements plus per-file ≥90% thresholds for the safety (`safety-pipeline`), validation (`schemas`, `story-preferences-schema`), direct-identifier-exclusion (`age-band`), and orchestration (`generation-runtime`, `generate-story`) modules. `pnpm test:coverage` (alias `test:coverage:check`) exits non-zero when any gate is unmet.
  regression, production build, and budget validation.

### Post-Design Constitution Check

| Constitution requirement | Post-design evidence | Status |
|---|---|---|
| Code Quality | Small feature modules, strict typed boundary schemas, one documented route contract, no provider leakage to UI. | PASS |
| Testing Standards | Deterministic fakes cover validation, direct-identifier exclusion, exact-age exclusion, text + image moderation, illustration consistency, auto-regeneration, rate limiting, provider failure, export, locales, and accessibility. | PASS |
| UX Consistency | Co-located Storybook states, shared primitives, localized recovery UX, keyboard navigation, local export. Follows the design-system skill: token-only styling, primitive API contract, a11y bar (AA contrast, `aria-live`, reduced motion), visual-regression baseline workflow, React 19 pending-state hooks. | PASS |
| Performance | `N = 3` scenes, bounded/concurrent image work, optimized WebP response, no cache persistence, lazy export, CI budgets parameterized by scene count. | PASS |

**Post-design result**: PASS. No complexity exception is needed.
