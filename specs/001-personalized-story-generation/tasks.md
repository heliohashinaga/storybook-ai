# Tasks: Personalized Story Generation

**Input**: Design documents from `specs/001-personalized-story-generation/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/story-generation.openapi.yaml`, `quickstart.md`, and the project constitution.

**Tests**: Tests are mandatory. Constitution Principle II requires test-first development, and this
feature's plan requires deterministic unit, integration, contract, Storybook, E2E, accessibility,
and visual coverage. Write each test task first and verify it fails for the expected reason before
implementing its dependent task.

**Organization**: Tasks are grouped by user story. The future Multi-Agent System / Python
LangGraph service documented in `future-multi-agent-system.md` is explicitly out of scope for this
MVP task list.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after stated dependencies complete; it changes a distinct file set.
- **[Story]**: Maps a task to the user story it delivers.
- Every task lists the exact path(s) it changes or validates.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the TypeScript/Next.js application and its quality tooling.

- [x] T001 Initialize the pnpm project, Node 22 engine constraint, and required scripts in `package.json`.
    - Review: APPROVED · SECURE · attempt 2 · route integrator · [reviews.md](reviews.md#phase-1-tooling-t001t008--review--attempt-2--2026-08-05t0527z)
- [x] T002 Configure strict TypeScript and Next.js App Router in `tsconfig.json`, `next.config.ts`, and `src/app/layout.tsx`.
    - Review: APPROVED · SECURE · attempt 2 · route integrator · [reviews.md](reviews.md#phase-1-tooling-t001t008--review--attempt-2--2026-08-05t0527z)
- [x] T003 [P] Configure ESLint and Prettier with zero-warning checks in `eslint.config.mjs`, `.prettierrc.json`, and `package.json`.
    - Review: APPROVED · SECURE · attempt 2 · route integrator · [reviews.md](reviews.md#phase-1-tooling-t001t008--review--attempt-2--2026-08-05t0527z)
- [x] T004 [P] Configure Tailwind semantic design tokens (color/typography/spacing/radius/shadow/motion, token-only, no ad-hoc values) and global base styles in `tailwind.config.ts`, `postcss.config.mjs`, and `src/app/globals.css`.
    - Review: APPROVED · SECURE · attempt 2 · route integrator · [reviews.md](reviews.md#phase-1-tooling-t001t008--review--attempt-2--2026-08-05t0527z)
- [x] T005 [P] Configure Vitest, React Testing Library, MSW, coverage reporting, and test scripts in `vitest.config.ts`, `tests/setup.ts`, and `package.json`.
    - Review: APPROVED · SECURE · attempt 2 · route integrator · [reviews.md](reviews.md#phase-1-tooling-t001t008--review--attempt-2--2026-08-05t0527z)
- [x] T006 [P] Configure Storybook with the Next.js integration and accessibility addon in `.storybook/main.ts` and `.storybook/preview.ts`.
    - Review: APPROVED · SECURE · attempt 2 · route integrator · [reviews.md](reviews.md#phase-1-tooling-t001t008--review--attempt-2--2026-08-05t0527z)
- [x] T007 [P] Configure Playwright for Chromium E2E and visual-regression runs in `playwright.config.ts` and `package.json`.
    - Review: APPROVED · SECURE · attempt 2 · route integrator · [reviews.md](reviews.md#phase-1-tooling-t001t008--review--attempt-2--2026-08-05t0527z)
- [x] T008 [P] Create secret-safe environment and ignore rules in `.env.example` and `.gitignore`; include only provider-model variable names, never user data.
    - Review: APPROVED · SECURE · attempt 2 · route integrator · [reviews.md](reviews.md#phase-1-tooling-t001t008--review--attempt-2--2026-08-05t0527z)

**Checkpoint**: `pnpm install`, lint, format, typecheck, test, Storybook, and Playwright commands are defined before feature work begins.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared typed primitives, localization infrastructure, and privacy-safe boundaries
that every user story depends on.

**⚠️ CRITICAL**: Complete this phase before any user-story implementation.

- [x] T009 [P] Write failing age-band and story-preferences validation tests in `tests/unit/age-band.test.ts` and `tests/unit/story-preferences-schema.test.ts` for ages 2–12, `pt-BR`/`en`, and allow-listed themes.
    - Review: APPROVED (reviewer) · MEETS_TASK (tester) · SECURE (security-reviewer) · [reviews.md](reviews.md#T009)
  - Review: APPROVED + SECURE (reviewer), MEETS_TASK (tester), SECURE (security-reviewer), attempt 2 — [reviews.md](reviews.md#T009—reviewer—Attempt-1—2026-08-05T21-55-13Z)
- [x] T010 Implement `AgeBand`, `Locale`, `Theme`, age derivation, and browser-only `StoryPreferences` schemas in `src/features/story-request/client/age-band.ts` and `src/features/story-request/client/story-preferences-schema.ts`.
    - Review: APPROVED (reviewer) · MEETS_TASK (tester) · SECURE (security-reviewer) · [reviews.md](reviews.md#T010)
    - Review: APPROVED + SECURE (reviewer, after remediation d8d9fdd), MEETS_TASK (tester), SECURE (security-reviewer) — [reviews.md](reviews.md#T010—reviewer—Attempt-1—2026-08-05T22-21-00Z)
- [x] T011 [P] Define the typed locale/theme catalogs and default `pt-BR` behavior in `src/lib/story-catalog.ts`.
    - Review: APPROVED (reviewer) · MEETS_TASK (tester) · LOW_RISK (security-triage) · [reviews.md](reviews.md#T011)
- [x] T012 [P] Implement validated server environment access and typed sanitized HTTP errors in `src/lib/env.ts` and `src/lib/http-errors.ts`.
    - Review: APPROVED (reviewer) · MEETS_TASK (tester) · LOW_RISK (security-triage) · [reviews.md](reviews.md#T012)
- [x] T013 [P] Implement the platform-adaptable anonymous rate-limit interface in `src/lib/rate-limit.ts`; short-lived pseudo-anonymous key (e.g., salted, rotated hash of IP) with localized `429`, never retaining direct identifiers or story content.
    - Review: APPROVED (reviewer) · MEETS_TASK (tester) · LOW_RISK (security-triage) · [reviews.md](reviews.md#T013)
- [x] T014 [P] Configure `next-intl` and baseline Brazilian Portuguese UI messages in `src/i18n/config.ts` and `src/features/story-request/locales/pt-BR.json`.
    - Review: APPROVED (reviewer) · MEETS_TASK (tester) · LOW_RISK (security-triage) · [reviews.md](reviews.md#T014)
- [x] T015 [P] Write failing schema/contract-shape tests for a three-scene safe story and for rejection of unknown/name fields in `tests/unit/story-response.test.ts`.
    - Review: APPROVED/MEETS_TASK/LOW_RISK (parent-run) · test-first red→green with T016 · [reviews.md](reviews.md#T015/T016)
- [x] T016 Implement Zod schemas for `GenerateStoryRequest`, generated stories/scenes, typed failures, and direct-identifier rejection in `src/features/story-generation/server/schemas.ts`.
    - Review: APPROVED/MEETS_TASK/LOW_RISK (parent-run) · [reviews.md](reviews.md#T015/T016)
- [x] T017 Define the server-only `StoryGenerationProvider` interface and a deterministic fake-provider seam in `src/features/story-generation/server/story-generation-provider.ts` and `tests/fixtures/story-generation/provider-fixtures.ts`.
    - Review: APPROVED/MEETS_TASK/LOW_RISK (parent-run) · [reviews.md](reviews.md#T017)
- [x] T018 Create accessible shared UI primitives for buttons, form controls, alerts, and progress states in `src/components/ui/button.tsx`, `src/components/ui/select.tsx`, `src/components/ui/alert.tsx`, and `src/components/ui/progress.tsx`; explicit variant/size/state API (disabled, loading, error), forwarded refs, no business logic, and the a11y bar (AA 4.5:1 contrast, keyboard navigation, visible focus, `aria-live`/`aria-busy`, `prefers-reduced-motion`).
    - Review: APPROVED/MEETS_TASK/LOW_RISK (parent-run) · [reviews.md](reviews.md#T018)

**Checkpoint**: Shared validation, catalogs, error types, locale baseline, provider seam, rate-limit seam, and reusable accessible primitives are ready. No client or API boundary accepts a name/direct identifier.

---

## Phase 3: User Story 1 - Create a Personalized Story (Priority: P1) 🎯 MVP

**Goal**: A parent selects age, language, and a positive theme; the app returns a safe, complete,
illustrated three-scene story without collecting a direct child identifier.

**Independent Test**: With a deterministic fake provider, select age `6`, `pt-BR`, and courage;
receive a three-scene story with illustrations and localized alt text. Assert that the API request
contains only `ageBand`, `locale`, and `theme`, and that unsafe first attempts are never shown.

### Tests for User Story 1 — write and observe failure first

- [x] T019 [P] [US1] Write the `POST /api/stories` OpenAPI contract test in `tests/contract/story-generation.openapi.test.ts`, covering only allowed request fields, `Cache-Control: no-store`, three scenes, and typed 400/422/429/502/504 failures.
- [x] T020 [P] [US1] Write safety-pipeline unit tests in `tests/unit/safety-pipeline.test.ts` for unsafe-candidate discard (story text **and each illustration**), one safe regeneration, identifier/template-marker rejection, and safe unrecoverable failure.
- [x] T021 [P] [US1] Write provider-pipeline integration tests with deterministic fixtures in `tests/integration/provider-pipeline.test.ts` for structured narrative, text **and image** moderation, three image prompts, illustration-set consistency, missing-image retry, and no unsafe result leakage.
- [x] T022 [P] [US1] Write request-form component tests in `tests/unit/story-request-form.test.tsx` for valid input, invalid age/theme, loading state, and absence of a name/direct-identifier field.
- [x] T023 [P] [US1] Write the default `pt-BR` generation E2E journey in `tests/e2e/generate-pt-br.spec.ts`, including request-payload inspection and a no-identifier assertion.

### Implementation for User Story 1

- [X] T024 [US1] Implement the server-only OpenRouter narrative/image/moderation adapter in `src/features/story-generation/server/openrouter-story-generation-provider.ts`, reading model identifiers only from `src/lib/env.ts`.
- [x] T025 [US1] Implement the schema-validation, text **and image** moderation, bounded-regeneration, and safe-error pipeline in `src/features/story-generation/server/safety-pipeline.ts`.
- [x] T026 [US1] Implement transient WebP image optimization and response-size guarding in `src/features/story-generation/server/image-optimizer.ts`.
- [x] T027 [US1] Implement `N`-scene generation orchestration (`N = 3` validated constant, scene-count extension point), shared style/character consistency across the illustration set, bounded image retry, and provider error mapping in `src/features/story-generation/server/generate-story.ts`.
- [x] T028 [US1] Implement `POST /api/stories` in `src/app/api/stories/route.ts`; validate only `ageBand`, `locale`, and `theme`, apply rate limits, return `no-store`, and never log request/story content.
- [x] T029 [US1] Implement client-side parsing of the approved story response and typed sanitized error mapping in `src/features/story-reader/client/story-response.ts`.
- [x] T030 [US1] Implement in-memory request status, active-story, and typed failure state in `src/features/story-request/client/story-session-context.tsx`; do not serialize state to storage.
- [x] T031 [US1] Implement the accessible age/language/theme request form in `src/features/story-request/components/story-request-form.tsx`, deriving `ageBand` locally and sending no exact age or identifier.
- [x] T032 [US1] Implement localized progress, timeout, safety-retry, and provider-failure states in `src/features/story-request/components/story-generation-progress.tsx`.
- [x] T033 [US1] Integrate form submission, API response handling, and the first approved-story state in `src/app/page.tsx`.
- [x] T034 [US1] Add default, validation-error, loading, safe-retry, rate-limit, and success stories to `src/features/story-request/components/story-request-form.stories.tsx`.

**Checkpoint**: User Story 1 is independently usable with fixtures: it creates a safe three-scene
`pt-BR` story without a name field, unsafe intermediate content, durable storage, or live-provider
test dependency.

---

## Phase 4: User Story 2 - Read a Story Scene by Scene (Priority: P2)

**Goal**: A parent and child can read an in-session story one scene at a time, navigate safely in
both directions, and locally download/print it.

**Independent Test**: Open a fixture-backed in-session story, navigate first → middle → last →
previous, verify illustration/alt text and progress for every scene, then export a PDF without an
export HTTP request.

### Tests for User Story 2 — write and observe failure first

- [x] T035 [P] [US2] Write reader and scene-navigation component tests in `tests/unit/story-reader.test.tsx` for first/middle/last bounds, previous/next, progress, focus management, and localized alt text.
- [x] T039 [US2] Implement an accessible single-scene renderer with optimized image, localized alt text, and semantic reading structure in `src/features/story-reader/components/scene-view.tsx`.
- [x] T040 [US2] Implement ordered next/previous navigation, scene progress, and in-session resume in `src/features/story-reader/components/story-reader.tsx`.
- [x] T036 [P] [US2] Write the scene-by-scene keyboard E2E journey in `tests/e2e/story-reader-navigation.spec.ts`, including in-session resume behavior.
- [ ] T037 [P] [US2] Add reader visual-regression coverage for all three scene positions in `tests/visual/reader.spec.ts`.
- [ ] T038 [P] [US2] Write local PDF-export tests in `tests/unit/build-story-pdf.test.ts` that assert all scenes/images are included and no network export call occurs.

### Implementation for User Story 2

- [ ] T041 [US2] Add default/first/middle/last/error accessibility stories for the reader and scene view in `src/features/story-reader/components/scene-view.stories.tsx`.
- [ ] T042 [US2] Implement lazily loaded browser-only PDF composition in `src/features/story-export/client/build-story-pdf.tsx` using the in-memory story and images.
- [ ] T043 [US2] Implement accessible export/download/print controls and disabled/loading states in `src/features/story-export/components/export-story-button.tsx`.
- [ ] T044 [US2] Integrate the reader and local export controls with the approved in-session story in `src/app/page.tsx`.

**Checkpoint**: User Stories 1 and 2 work together: a safely generated story is fully readable,
keyboard-operable, visually documented, and locally exportable without server-side retention.

---

## Phase 5: User Story 3 - Generate and Read Multiple Stories in One Visit (Priority: P3)

**Goal**: During one open-tab session, a parent can create multiple stories with different or repeated themes (via a "generate another" action), reuse age/language preferences, switch among generated stories, and lose all state on reload.

**Independent Test**: Generate two fixture stories with different themes plus one with a repeated theme ("generate another" keeps current age/language/theme and **appends** a new story — it never replaces the current one); switch between them, confirm age/language are reused, verify no story-count cap blocks additional generations, and verify that page reload restores neither preferences nor stories.

### Tests for User Story 3 — write and observe failure first

- [ ] T045 [P] [US3] Write session-state tests in `tests/unit/story-session-context.test.tsx` for multi-story ordering, active-story switching, preference reuse, "generate another" append behavior (never replaces the current story), no story-count cap, and clear-on-reload/no-serialization behavior.
- [ ] T046 [P] [US3] Write the anonymous multi-story E2E flow in `tests/e2e/anonymous-session-and-export.spec.ts`, including a browser storage/cookie/URL no-persistence audit.
- [ ] T047 [P] [US3] Write an integration test for same-session preference reuse and preserved readable stories in `tests/integration/anonymous-session.test.ts`.

### Implementation for User Story 3

- [ ] T048 [US3] Extend the in-memory session reducer/context for multiple story entries, newest-first ordering, active-story selection, append-only "generate another" (never replaces the current story), no story-count cap, and explicit non-persistence in `src/features/story-request/client/story-session-context.tsx`.
- [ ] T049 [US3] Implement the in-session story switcher/history UI with accessible story labels and active-state semantics in `src/features/story-reader/components/story-history.tsx`.
- [ ] T050 [US3] Update the request form to reuse in-memory age/language preferences while allowing a new theme selection, and add a "generate another" action that keeps the current age band/locale/theme and appends a new story in `src/features/story-request/components/story-request-form.tsx`.
- [ ] T051 [US3] Integrate the story switcher and session-clearing behavior into `src/app/page.tsx`.

**Checkpoint**: User Stories 1–3 work without accounts or persistent profiles: multiple stories are
usable in one tab, and a fresh page has no restored exact age, preferences, or story content.

---

## Phase 6: User Story 4 - Generate Stories in Multiple Languages (Priority: P3)

**Goal**: The interface and generated output support default `pt-BR` and English consistently; an
unsupported language is rejected before generation.

**Independent Test**: Generate fixture stories using `pt-BR` and English, verify the full reader
text and alt text match the chosen locale, and assert an unsupported locale cannot reach the API.

### Tests for User Story 4 — write and observe failure first

- [ ] T052 [P] [US4] Write locale/unsupported-locale tests in `tests/unit/story-preferences-schema.test.ts` and `tests/integration/generate-story-route.test.ts` for `pt-BR`, English, and API rejection before provider invocation.
- [ ] T053 [P] [US4] Write the English generation E2E journey in `tests/e2e/generate-english.spec.ts`, covering English UI, story, alt text, and selected age band.
- [ ] T054 [P] [US4] Add Portuguese and English localized Storybook interaction/accessibility cases in `src/features/story-request/components/story-request-form.stories.tsx`.

### Implementation for User Story 4

- [ ] T055 [US4] Add reviewed English static UI messages and locale-switch labels in `src/features/story-request/locales/en.json` and `src/features/story-request/locales/pt-BR.json`.
- [ ] T056 [US4] Implement the locale-provider/selector wiring and localized unsupported-language recovery UX in `src/i18n/config.ts`, `src/features/story-request/components/story-request-form.tsx`, and `src/app/layout.tsx`.
- [ ] T057 [US4] Enforce locale-specific narrative, title, and alt-text output constraints in `src/features/story-generation/server/openrouter-story-generation-provider.ts` and `src/features/story-generation/server/safety-pipeline.ts`.

**Checkpoint**: User Stories 1–4 work in both supported languages; default `pt-BR` and English have
localized UI, story text, scene descriptions, and pre-provider rejection for unsupported locales.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Enforce the constitution's quality, accessibility, security/privacy, performance, and
documentation gates across the completed MVP.

- [ ] T058 [P] Configure and enforce ≥80% overall and ≥90% safety/validation/orchestration coverage thresholds in `vitest.config.ts` and `package.json`.
- [ ] T059 [P] Add application-level accessibility coverage for form, loading/error, reader, switcher, and export controls in `tests/e2e/accessibility.spec.ts` and `.storybook/preview.ts`; assert AA contrast and `prefers-reduced-motion` behavior.
- [ ] T060 [P] Add performance budget tooling for initial JS, LCP, scene navigation, lazy PDF import, and ≤120-second generation in `tests/performance/story-generation-budget.spec.ts` and `package.json`.
- [ ] T061 [P] Add a privacy/logging/cache regression audit for no identifiers, no exact-age API payload, no persistence, and `no-store` responses in `tests/integration/privacy-boundary.test.ts`.
- [ ] T062 Configure the required CI gates (format, lint, typecheck, unit/coverage, Storybook/a11y, E2E, visual, build, and performance) in `.github/workflows/ci.yml`.
- [ ] T063 Document local setup, safe environment use, supported locales/themes, anonymous-session behavior, and test commands in `README.md`.
- [ ] T064 Reconcile implemented commands, acceptance scenarios, and performance evidence with `specs/001-personalized-story-generation/quickstart.md`.
- [ ] T065 Run the complete quickstart validation suite, resolve all failures, and record final evidence in `specs/001-personalized-story-generation/tasks.md`.
- [ ] T066 [P] Implement anonymous structured logging and error-tracking scrubbing in `src/lib/observability.ts` (or equivalent): structured fields (locale, theme, age band, status, duration, short trace ID) with two-layer scrubbing — in the SDK before data leaves the app and server-side without storing request/response bodies; never emit name, exact age, story content, provider payloads, or persisted IP identity, and add a logging test asserting these exclusions.

**Checkpoint**: The MVP satisfies its constitution, OpenAPI contract, privacy boundary, accessibility,
performance budgets, and documented validation path.

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1: Setup
  → Phase 2: Foundational
      → Phase 3: US1 (MVP story generation)
          → Phase 4: US2 (reader + export)
              → Phase 5: US3 (multi-story active session)
              → Phase 6: US4 (English support)
                  → Phase 7: Polish
```

### User Story Dependencies

- **US1 (P1)**: Depends only on foundational setup; it is the minimum viable product.
- **US2 (P2)**: Depends on US1 because a reader requires an approved in-session story.
- **US3 (P3)**: Depends on US1's session state and reuses US2's reader; it may proceed after US2's
  component contracts are stable.
- **US4 (P3)**: Depends on US1's request/provider path; it can proceed in parallel with US3 after
  Phase 4 if separate writers avoid the shared form/page/provider files.
- **Polish**: Depends on the user stories selected for the release.

### Within Each User Story

1. Write and run listed tests first; confirm the relevant test fails for the expected reason.
2. Implement data/schema/provider logic before routes and UI integration.
3. Implement UI components before page integration.
4. Add Storybook states and run the independent test criterion before declaring the story complete.

## Parallel Opportunities

- **Setup**: T003–T008 can run in parallel after T001 establishes `package.json`.
- **Foundational**: T011–T015 can run in parallel after T009/T010 establish shared test/schema
  expectations; T012–T014 modify independent paths.
- **US1 tests**: T019–T023 can run in parallel after Phase 2.
- **US2 tests**: T035–T038 can run in parallel after US1 produces the story response shape.
- **US3 tests**: T045–T047 can run in parallel after US2 has stable reader/session contracts.
- **US4 tests**: T052–T054 can run in parallel after US1; implementation T055 and locale-specific
  provider work can proceed in parallel only if writers coordinate shared message/form files.
- **Polish**: T058–T061 and T066 can run in parallel once all selected stories are stable.

> Resource note: the current machine advisor recommends sequential execution (parallelism 1) because
> available memory is low. Treat the opportunities above as file-conflict guidance for a better
> provisioned environment, not a request to run all tasks concurrently here.

## Parallel Example: User Story 1

```text
After Phase 2, these test tasks touch distinct files and can be assigned independently:

- T019 Contract test: tests/contract/story-generation.openapi.test.ts
- T020 Safety tests: tests/unit/safety-pipeline.test.ts
- T021 Provider integration: tests/integration/provider-pipeline.test.ts
- T022 Form tests: tests/unit/story-request-form.test.tsx
- T023 E2E journey: tests/e2e/generate-pt-br.spec.ts
```

## Parallel Example: User Story 2

```text
After US1 establishes the story response, these tests touch distinct files:

- T035 Reader component tests: tests/unit/story-reader.test.tsx
- T036 Keyboard E2E: tests/e2e/story-reader-navigation.spec.ts
- T037 Visual regression: tests/visual/reader.spec.ts
- T038 PDF unit tests: tests/unit/build-story-pdf.test.ts
```

## Implementation Strategy

### MVP First — User Story 1 only

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational).
3. Complete Phase 3 (US1).
4. Run T019–T023 and the US1 independent test criterion with deterministic fixtures.
5. Demo a safe three-scene `pt-BR` story generation flow with no name field and no persisted data.

### Incremental Delivery

1. **US1**: Safe anonymous story generation — minimum usable value.
2. **US2**: Reader, navigation, and local PDF export.
3. **US3**: Multiple stories/reused preferences in an active session only.
4. **US4**: Full English support and unsupported-language handling.
5. **Polish**: CI, budgets, accessibility, privacy audit, docs, full quickstart validation.

### Future Boundary

Do not implement Coordinator/Planner/Writer/Reviewer/Illustrator agents, Python, LangGraph, a
separate generation service, accounts, or durable storage in this task list. Those items belong to
the separately specced future Multi-Agent System in `future-multi-agent-system.md`.

## Notes

- Every task uses the required checklist format: checkbox, sequential ID, optional `[P]`, required
  user-story label for story tasks, clear description, and exact file path(s).
- Apply the repo skills when executing: `nextjs` (RSC/`server-only` boundaries, single `no-store`
  route, React 19 pending-state hooks) and `design-system` (token-only styling, primitive API
  contract, a11y bar, Storybook states, visual-regression baseline workflow).
- Follow the constitution: no unapproved `any`, no flaky/live-provider CI tests, Storybook states
  for component changes, and no merge while a quality gate fails.
- Commit after each coherent task group; use the project Gitmoji convention for commit messages.
