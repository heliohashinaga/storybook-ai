# Tasks: Gerar mais cenas (contagem variável 3–5)

**Input**: Design documents from `specs/002-generate-more-scenes/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Tests**: Included — the spec mandates a "User Scenarios & Testing" section and the constitution
enforces test-first. Write failing tests before implementation.

**Organization**: Tasks grouped by user story so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 | US2 | US3 (see spec.md)
- Include exact file paths in descriptions.

## Path Conventions

- Single project: `src/`, `tests/` at repository root.
- Contract test reads the canonical OpenAPI at `specs/001-personalized-story-generation/contracts/story-generation.openapi.yaml` — that file MUST be updated alongside the 002 delta doc.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Branch + shared fixture groundwork; no behavior change.

- [ ] T001 Create/reconfirm feature branch `002-generate-more-scenes` and ensure working tree matches latest `main`; record scope (3–5 scenes, default 3) in the task file header
- [ ] T002 [P] Extend `sceneCount` fixture helper: parametrize `buildSafeCandidate(input)` in `tests/fixtures/story-generation/provider-fixtures.ts` to return `input.sceneCount` scenes (3/4/5), preserving existing 3-scene behavior by default
- [ ] T003 [P] Extend the fake provider in `tests/fixtures/story-generation/provider-fixtures.ts` to honor `input.sceneCount` across the `safe`, `unsafe-then-safe`, and `double-unsafe` scenarios; keep deterministic (no AI live)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story begins until the shared scene-count contract is in place.

**Purpose**: Single source of truth for scene count across schemas, provider boundary, and the
canonical API contract — the foundation every story depends on.

- [ ] T004 Add scene-count constants and schema in `src/features/story-generation/server/schemas.ts`: export `MIN_SCENES = 3`, `MAX_SCENES = 5`, `DEFAULT_SCENE_COUNT = 3`, `sceneCountSchema` (int, min 3, max 5), keep `N_SCENES` as backward-compatible alias; update `sceneSchema.ordinal` max to `MAX_SCENES`
- [ ] T005 [P] Update `generateRequestSchema` in `src/features/story-generation/server/schemas.ts`: add optional `sceneCount` (defaults to 3), still `.strict()` (reject names/identifiers); export `GenerateStoryRequest` type
- [ ] T006 [P] Update `storyResponseSchema` in `src/features/story-generation/server/schemas.ts`: add `sceneCount` field and change `scenes` to `min(3).max(5)`
- [ ] T007 Add `sceneCount?: number` (default 3) to `ProviderStoryInput` in `src/features/story-generation/server/story-generation-provider.ts`; keep the seam server-only and identifier-free
- [ ] T008 Update the canonical contract in `specs/001-personalized-story-generation/contracts/story-generation.openapi.yaml`: add `sceneCount` (3–5, default 3) to `GenerateStoryRequest`, set response scenes `minItems: 3`/`maxItems: 5`, add `sceneCount` to `GeneratedStory`; keep `Cache-Control: no-store` (mirror the delta in `specs/002-generate-more-scenes/contracts/story-generation.openapi.yaml`)

**Checkpoint**: Foundation ready — scene-count contract exist across client/dev-facing schemas, provider boundary, and the tested OpenAPI. User stories can begin.

---

## Phase 3: User Story 1 - Escolher quantas cenas a história terá (Priority: P1) 🎯 MVP

**Goal**: The responsible party picks 3/4/5 scenes (default 3) via an accessible, localized form
control; the anonymous integer is sent, revalidated server-side, and honored by the generation
pipeline (never a partial-success result). Requires Phase 2.

**Independent Test**: `pnpm test` — generate a story with `sceneCount` 4 and 5 through the fake
provider; assert the request carries only anonymous `ageBand`/`locale`/`theme`/`sceneCount` and the
response returns exactly the requested number of complete scenes; `pnpm test:contract` verifies the
OpenAPI contract.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, confirm they FAIL before implementing.**

- [ ] T009 [P] [US1] Unit test for `sceneCountSchema` boundaries and default in `tests/unit/schemas.test.ts` (or extend the existing schema test): 3/4/5 accepted, 2 and 6 rejected, omission defaults to 3
- [ ] T010 [P] [US1] Update `tests/unit/story-preferences-schema.test.ts` for client `sceneCount` field: valid values, rejected out-of-range, no identifier accepted
- [ ] T011 [P] [US1] Update `tests/unit/provider-fixtures.test.ts`: `buildSafeCandidate` returns `sceneCount` scenes (3/4/5) deterministically
- [ ] T012 [P] [US1] Contract test update in `tests/contract/story-generation.openapi.test.ts`: request with `sceneCount` 5 is valid and echoed; response scenes bound [3,5]; still no name/identifier allowed
- [ ] T013 [P] [US1] Integration test: exercise 3/4/5 scene counts end-to-end through the fake provider → safety pipeline → orchestrator → response in `tests/integration/provider-pipeline.test.ts`; assert exactly `sceneCount` complete scenes and a typed 400 on out-of-range

### Implementation for User Story 1

- [ ] T014 [US1] Add `sceneCount` (default 3, options 3/4/5) to `src/features/story-request/client/story-preferences-schema.ts` with fast, localized client validation
- [ ] T015 [US1] Add localized control (label + 3/4/5 options, a11y) to `src/features/story-request/components/story-request-form.tsx`; wire `defaultSceneCount` and in-session reuse (remember last choice for "nova história")
- [ ] T016 [US1] Extend `src/features/story-request/components/story-request-form.stories.tsx` with default/edge/error states for the scene-count control (incl. out-of-range) + a11y via storybook test-runner
- [ ] T017 [US1] Add locale strings in `src/features/story-request/locales/pt-BR.json` and `src/features/story-request/locales/en.json` (field label + option labels); no hardcoded strings
- [ ] T018 [P] [US1] Honor `input.sceneCount` in `src/features/story-generation/server/openrouter-story-generation-provider.ts`: build the prompt for `sceneCount` scenes; validate candidate scene array `min(3).max(5)`
- [ ] T019 [P] [US1] Honor `input.sceneCount` in `src/features/story-generation/server/fixed-dev-provider.ts` (deterministic variadic scenes)
- [ ] T020 [US1] Update `src/features/story-generation/server/safety-pipeline.ts`: pass `input.sceneCount` as expected count; reject count mismatch; validate partial sets (never partial-success)
- [ ] T021 [US1] Update `src/features/story-generation/server/generate-story.ts`: validate result matches `sceneCount`; reject partial/truncated stories; keep budgets/timeouts bounded
- [ ] T022 [US1] Update `src/app/api/stories/route.ts` to accept and revalidate `sceneCount` (default 3), pass it through, map `400 invalid_input` for out-of-range; keep `Cache-Control: no-store`
- [ ] T023 [US1] Update server schemas unit coverage for request/response round-trip (3/4/5) in the relevant `tests/unit/` schema test

**Checkpoint**: US1 complete — a 3/4/5-scene story can be requested, generated, and returned fully.

---

## Phase 4: User Story 2 - Ler uma história mais longa cena a cena (Priority: P1)

**Goal**: Reader reflects the real scene count ("Cena X de Y" with Y = actual), navigates all scenes
for 4–5-scene stories with focus management and `prefers-reduced-motion` respected. Requires US1's
backend to return >3 scenes end-to-end; reader change itself is independent.

**Independent Test**: `pnpm storybook:test` (a11y) + `pnpm e2e` — open a generated 4/5-scene story;
assert Y equals the real count and all scenes reachable.

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, confirm they FAIL before implementing.**

- [ ] T024 [P] [US2] Update `src/features/story-reader/components/story-reader.stories.tsx` with 4- and 5-scene stories (default/edge) + a11y coverage via storybook test-runner
- [ ] T025 [P] [US2] Update reader navigation e2e `tests/e2e/story-reader-navigation.spec.ts` (or pt-BR/en generate specs) for a 5-scene story across all cenas

### Implementation for User Story 2

- [ ] T026 [US2] Confirm/update `src/features/story-reader/components/story-reader.tsx` and `src/features/story-reader/client/story-switcher-utils.ts` to drive `total` from `scenes.length` (no hardcoded 3); keep focus move + arrow-nav for N scenes
- [ ] T027 [US2] Update `src/features/story-reader/client/story-response.ts` parser to accept stories with 3–5 scenes (and reject out-of-range as invalid rather than truncating)

**Checkpoint**: US2 complete — long stories read correctly, scene-by-scene, with real count.

---

## Phase 5: User Story 3 - Manter identidade e consistência em histórias longas (Priority: P2)

**Goal**: Export (PDF) renders ALL scenes in order with no truncation; long stories keep style/
character consistency across 3–5 scenes (never partial as success). Requires US1 + US2.

**Independent Test**: `pnpm test` (PDF unit) + `pnpm visual` — export a 5-scene story; assert N
pages/scenes and consistent illustration style; assert no partial story is produced on failure.

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, confirm they FAIL before implementing.**

- [ ] T028 [P] [US3] Update `tests/unit/build-story-pdf.test.ts` for 4- and 5-scene stories (pages == scene count, order preserved, WebP→PNG per page)
- [ ] T029 [P] [US3] Update `tests/unit/generate-story.test.ts` (or pipeline test) for a 5-scene consistency candidate: partial scene set never yields success; retry behavior bounded
- [ ] T030 [P] [US3] Unit test asserting a single `STYLE_DESCRIPTOR`/character is passed to all `sceneCount` illustration prompts (FR-006 style/character consistency)
- [ ] T031 [P] [US3] Unit test for illustration generation with bounded concurrency (2–3): all N prompts complete under `Promise.allSettled`, retry of the whole set is preserved, and the set still fails as a whole (never partial) when any call rejects (ADR 0005)

### Implementation for User Story 3

- [ ] T032 [US3] Confirm/update `src/features/story-export/client/build-story-pdf.tsx` to iterate all `story.scenes` (no truncation) and include every scene in order
- [ ] T033 [US3] Update the generation/illustration path so all N scenes share the same character/style descriptor and each scene is independently moderated (no partial success) — see `src/features/story-generation/server/generate-story.ts` and fixture `STYLE_DESCRIPTOR`
- [ ] T034 [US3] Implement bounded-concurrency illustration generation in `src/features/story-generation/server/generate-story.ts`: replace the sequential `for (const prompt of prompts)` with `Promise.allSettled` gated by a limited `concurrency` (2–3), preserving the whole-set `imageRetries` retry, the `IMAGE_TIMEOUT_MS` per-call timeout, the 4 MiB data-URI cap, and the “never partial success” rule (ADR 0005)
- [ ] T035 [US3] Visual regression: add/adjust `tests/visual/` coverage for a 5-scene story (approved baseline, no unintended diff)

**Checkpoint**: US3 complete — long stories export fully and consistently, never partial.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T036 [P] Documentation updates: sync `spec.md`/`data-model.md`/`quickstart.md`/`contracts/` if a contract behavior changed during implementation
- [ ] T037 Code cleanup and refactoring (remove dead code, unused deps; enforce strict TS; no `any`)
- [ ] T038 Run `pnpm quickstart` validation scenarios (3/4/5, pt-BR + en) end-to-end
- [ ] T039 [P] Final verification: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`, `pnpm storybook:test`, `pnpm test:e2e`, `pnpm visual`, `pnpm perf` all green; a11y AA
- [ ] T040 [P] Privacy invariant re-check: no direct identifier anywhere in payloads/logs/provider fakes/analytics; `Cache-Control: no-store` intact

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)**: No dependencies.
- **Foundational (2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (3–5)**: All depend on Foundational.
- **Polish (6)**: Depends on US1..US3 complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational; no dependency on US2/US3.
- **US2 (P1)**: After Foundational; end-to-end verification needs US1's backend (returns >3 scenes), but the reader change itself is independent.
- **US3 (P2)**: After US1 + US2 (needs variable stories + reader).

### Within Each User Story

- Tests written and FAIL first; then implementation until green; then refactor.
- Schemas → provider boundary → pipeline/orchestrator → route → UI.
- Story complete before next priority.

### Parallel Opportunities

- Setup: T002/T003 in parallel.
- Foundational: T005/T006/T007/T008 in parallel (T004 first — defines shared constants).
- US1 tests: T009–T013 parallel. US1 implementation: T014→T015→T016→T017 sequential (form + stories), T018/T019 parallel (providers), then T020→T021→T022.
- US2: T024/T025 tests parallel; T026/T027 impl sequential.
- US3: T028/T029/T030/T031 tests parallel; T032→T033→T034→T035 impl.
- US1/US2/US3 impl can be worked in parallel by different contributors after Foundational (respecting US3's dependency on US1+US2).

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together:
Task: "Unit test sceneCountSchema boundaries in tests/unit/schemas.test.ts"
Task: "Update story-preferences-schema test for sceneCount in tests/unit/story-preferences-schema.test.ts"
Task: "Update provider-fixtures test buildSafeCandidate sceneCount in tests/unit/provider-fixtures.test.ts"
Task: "Update contract test for sceneCount in tests/contract/story-generation.openapi.test.ts"

# Launch provider adapters together:
Task: "Honor sceneCount in openrouter provider"
Task: "Honor sceneCount in fixed-dev provider"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational (blocks all)
3. Phase 3: US1 (choose + generate 3/4/5 scenes)
4. STOP and VALIDATE: US1 independently (request→contract→pipeline→response)
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → test/demo (MVP)
3. Add US2 → long-story reading → test/demo
4. Add US3 → full export + consistency → test/demo
5. Polish → converge

### Framing / project notes

- **Timing**: whether 5 scenes is measurably slower is UNKNOWN (spec FR-008 deferred to planning);
  do not add speculative time-scaling logic — keep budgets bounded and never partial as success.
- **No persistence**: in-session scene-count reuse only; nothing stored; `Cache-Control: no-store`.
- **Anonymous**: `sceneCount` is the only new field, an integer; no identifiers.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps to spec user story for traceability.
- Verify tests fail before implementing.
- Commit after each coherent task group.
- Stop at any checkpoint to validate independently.
- Avoid vague tasks or cross-story conflicts that break independence.
