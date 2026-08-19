---

description: "Task list for feature implementation: Mobile UX Refinements"
---

# Tasks: Mobile UX Refinements

**Input**: Design documents from `/specs/016-mobile-ux-refinements/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md
(decisions R-01..R-06), data-model.md (no data changes), contracts/ (no interface changes)

**Tests**: Story/unit tests are included because the project constitution (II Testing Standards,
III UX Consistency) mandates co-located `.stories.tsx` (default/edge/error + a11y) and unit tests
for every changed component, and Storybook must mirror the app.

**Organization**: Tasks are grouped by user story (spec priorities) for independent
implementation and testing. Feature is **purely presentational** (no setup/foundational infra).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project at repo root: `src/`, `tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline gate before any presentational change; no new dependencies.

- [ ] T001 [P] Record baseline: run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`
  and confirm the project is green with visual baselines in sync (no code change)
- [ ] T002 [P] Confirm the responsive utility set is available and token-compliant
  (`line-clamp-2`, `break-words`, `whitespace-nowrap`, `min-w-0`, `sm:` variants, `p-md`/`py-*`
  tokens) and record compliance in `specs/016-mobile-ux-refinements/research.md` (R-06) (no code change)

**Checkpoint**: Baseline captured — user story work can begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Nenhuma infraestrutura real é necessária (feature de apresentação). Define-se apenas o
enfoque compartilhado que todas as stories seguem.

- [ ] T003 [P] Confirm a11y config in stories já cobre contraste (color-contrast) para os
  componentes alterados, e que os alvos de toque manterão `≥44px` (research R-01) (no code change)

**Checkpoint**: Foundation acknowledged — user stories can proceed.

---

## Phase 3: User Story 1 - Texto legível sem overflow/quebra no mobile (Priority: P1) 🎯 MVP

**Goal**: Nenhum texto localizado do formulário (descrições de tema, nome de idioma, unidade de
cenas) estoura o contêiner, corta, ou quebra em meio de palavra em viewport estreito — nas duas
línguas.

**Independent Test**: Viewport 360px — inspecionar cards de tema (descrição longa pt-BR/en),
botão "Português (Brasil)" e unidade "cenas"; nenhuma rolagem horizontal, nenhum corte, quebra em
palavra limpa (quickstart cenários 1–2).

**Tests & Stories (write first, confirm they FAIL before impl) ⚠️**

- [ ] T004 [P] [US1] Add ChoiceCard story for a long localized description asserting no overflow /
  clean wrap (default/edge) in `src/components/ui/choice-card.stories.tsx`
- [ ] T005 [P] [US1] Add unit test that long strings wrap clean (no mid-word split / no
  horizontal overflow) in `tests/unit/` (choice-card/theme-selector)

**Implementation**

- [ ] T006 [P] [US1] Add `min-w-0` + `break-words` + `leading-snug` to the ChoiceCard description
  in `src/components/ui/choice-card.tsx`
- [ ] T007 [P] [US1] Ensure theme grid columns allow wrapping (`min-w-0`) in
  `src/features/story-request/components/theme-selector.tsx`
- [ ] T008 [US1] Make locale buttons wrap centered cleanly (`text-center leading-snug`) in
  `src/features/story-request/components/story-request-form.tsx`
- [ ] T009 [US1] Add `whitespace-nowrap` to the scene-count unit so number+unit never split in
  `src/features/story-request/components/story-request-form.tsx`
- [ ] T010 [US1] Update `theme-selector.stories.tsx`, `story-request-form.stories.tsx` and
  `choice-card.stories.tsx` to cover the new wrapping states (Storybook = app)

**Checkpoint**: US1 funciona e é testável de forma independente.

---

## Phase 4: User Story 2 - Controles proporcionais no mobile (Priority: P2)

**Goal**: Controles (cenas, cartões de tema, idioma, OAuth, CTA) mantêm alvo acessível `≥44px` com
densidade visual proporcional no mobile, sem regressão em desktop (≥640px).

**Independent Test**: Viewport 360px — inspecionar altura/padding dos controles; cada alvo ≥44px;
desktop (≥640px) inalterado. (R-01, R-04; quickstart cenário 4)

> **Nota de dependência**: US1 e US2 tocam arquivos compartilhados (`story-request-form.tsx`,
> `choice-card.tsx`). Executar **US2 após US1** (sequencial) para evitar conflito de escrita.

**Tests & Stories ⚠️**

- [ ] T011 [P] [US2] Update OAuth button story + a11y (visual density, target preserved) in
  `src/features/auth/components/oauth-provider-button.stories.tsx`
- [ ] T012 [P] [US2] Add/update unit test asserting touch targets ≥44px **and** intact keyboard
  operability, visible focus, and semantics (FR-005: nothing is touch-only) on
  scene-count/locale/theme/OAuth controls in `tests/unit/`

**Implementation**

- [ ] T013 [US2] Reduce scene-count button height `min-h-14` → `min-h-12 sm:min-h-14` in
  `src/features/story-request/components/story-request-form.tsx`
- [ ] T014 [P] [US2] Add mobile density to theme cards (`p-md` + emoji `text-2xl` on mobile via
  `sm:` preserving desktop) in `src/components/ui/choice-card.tsx` and
  `src/features/story-request/components/theme-selector.tsx`
- [ ] T015 [P] [US2] Reduce OAuth button visual padding `py-3` → `py-2` while keeping `min-h-12`
  in `src/features/auth/components/oauth-provider-button.tsx`
- [ ] T016 [US2] Set primary CTA `size="md" sm:size="lg"` in
  `src/features/story-request/components/story-request-form.tsx`
- [ ] T017 [US2] Update `story-request-form.stories.tsx` + `choice-card.stories.tsx` for the new
  proportional states

**Checkpoint**: US1 e US2 funcionam de forma independente.

---

## Phase 5: User Story 3 - Título da história legível no reader (Priority: P3)

**Goal**: Título do reader permanece legível no mobile — quebra em até 2 linhas em vez de cortar.

**Independent Test**: História com título longo no reader a 360px — título visível em até 2 linhas,
sem corte/elipse de linha única (R-03; quickstart cenário 3).

**Tests & Stories ⚠️**

- [ ] T018 [P] [US3] Add story-reader edge case (long title) asserting readable 2-line title in
  `src/features/story-reader/components/story-reader.stories.tsx`
- [ ] T019 [P] [US3] Add/update unit test for title wrapping (no single-line truncation) in
  `tests/unit/`

**Implementation**

- [ ] T020 [US3] Change `<h1>` title from `truncate` to `line-clamp-2` (keep `min-w-0`) in
  `src/features/story-reader/components/story-reader.tsx`
- [ ] T021 [US3] Regenerate the reader visual baseline intentionally (build + `--update-snapshots`)
  and commit in `tests/visual/reader.spec.ts`

**Checkpoint**: Todas as stories funcionam de forma independente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Re-aprovar baselines, validar suíte completa, sincronizar docs.

- [ ] T022 [P] Re-approve/regenerate all affected visual baselines (`tests/visual/`) intentionally
  (the reader baseline is already covered by T021 in US3) via `pnpm build` + `--update-snapshots`
  and commit (SC-005)
- [ ] T023 [P] Run full validation suite per `specs/016-mobile-ux-refinements/quickstart.md`
  (`pnpm lint`, `format:check`, `typecheck`, `pnpm test`, `storybook:test`, `test:visual`,
  `test:e2e`)
- [ ] T024 Update docs if any drift in `specs/016-mobile-ux-refinements/` and README; run
  `format:check` on all new/changed docs
- [ ] T025 Re-run quality gates **after the last edit** (lint/format/typecheck), verify no
  hardcoded strings added (FR-007), and commit per gitmoji/conventional commits

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no deps; captured baseline.
- **Foundational (Phase 2)**: depend on Setup; acknowledges shared approach (no infra).
- **US1 (P1)**: after Setup/Foundational.
- **US2 (P2)**: after US1 — **compartilha arquivos** (`story-request-form.tsx`,
  `choice-card.tsx`), executar sequencial.
- **US3 (P3)**: independente de arquivo (só `story-reader.tsx`); pode iniciar em paralelo com US2.
- **Polish**: após as stories desejadas.

### User Story Dependencies

- **US1**: independente (nenhuma outra story blockeia).
- **US2**: depende de US1 concluída (mesmos arquivos).
- **US3**: independente; pode rodar em paralelo com US2.

### Within Each Story

- Stories/tests primeiro e falhando; depois implementação; stories re-sincronizadas ao final.

### Parallel Opportunities

- T001 ∥ T002 ∥ T003 (fases Setup/Foundational)
- T004 ∥ T005 (tests US1)
- T006 ∥ T007 (impl US1, arquivos distintos)
- T011 ∥ T012 (tests US2); T014 ∥ T015 (US2, arquivos distintos)
- T018 ∥ T019 (tests US3)
- T022 ∥ T023 (Polish)

---

## Parallel Example: User Story 3 (independente de arquivo)

```bash
# Tests de US3 juntos:
Task: "Add story-reader edge case (long title) in story-reader.stories.tsx"
Task: "Add/update unit test for title wrapping in tests/unit/"

# Implementação após os testes:
Task: "Change <h1> title truncate -> line-clamp-2 in story-reader.tsx"
Task: "Regenerate reader visual baseline (reader.spec.ts)"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1–2 (baseline + enfoque)
2. Phase 3: User Story 1 (texto do formulário)
3. **STOP and VALIDATE**: viewport 360px nos componentes do form; `storybook:test` + unit verdes
4. Deploy/demo do MVP

### Incremental Delivery

1. Foundation (Setup) ✓
2. US1 → valida mobile do form → demo (MVP!)
3. US2 → controles proporcionais → valida 360px + desktop ≥640px → demo
4. US3 → título do reader + re-aprovar baseline visual → demo
5. Cada story agrega valor sem quebrar as anteriores

### Parallel Team Strategy

- Após Setup/Foundational:
  - Dev A: US1 (form/temas)
  - Dev B: **aguarda US1** (compartilha arquivos) OU toma US3 (independente)
  - Dev C: US3 (reader title)
  - Usar US1→US2 sequencialmente; US3 em paralelo.

---

## Notes

- [P] tasks = different files, no incomplete-task dependencies.
- [Story] maps task to its user story for traceability.
- US1/US2 compartilham `story-request-form.tsx` e `choice-card.tsx` → sequencial (não parar em
  paralelo nesses arquivos).
- Manter alvos de toque `≥44px` (R-01) e tokens/primitivas (Princípios III/IV); sem strings
  hardcoded (FR-007); sem JS novo no bundle (R-06).
- Commit após cada tarefa/grupo lógico; revalidar após o último edit (T025).
