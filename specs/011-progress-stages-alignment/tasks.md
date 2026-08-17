---

description: "Task list for aligning the generation progress stages with the multi-agent pipeline"
---

# Tasks: Estágios da tela de progresso alinhados ao pipeline multi-agente

**Input**: Design documents from `/specs/011-progress-stages-alignment/`

**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: TDD é obrigatório pelo constitution/AGENTS.md (Test-First, determinístico com fakes,
cobertura ≥80% total; os gates de safety/validation/orchestration não são tocados). Cada story
inclui testes escritos ANTES da implementação e que devem falhar primeiro.

**Organization**: Tasks agrupadas por user story do spec.md (US1–US4) + fases de setup e gates
finais. Fonte única da ordem canônica: `GENERATION_STAGES` no componente (Planner → Writer →
Moderator → Illustrator), nunca hardcoded no template.

**Remediation**: N/A — feature nova, sem findings de analyze.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências incompletas)
- **[Story]**: US1..US4 conforme spec.md
- Incluir caminhos exatos de arquivos

## Path Conventions

- **Single project (Next.js)**: `src/`, `tests/` na raiz do repositório
- Área-alvo: `src/features/story-request/components/`, `src/features/story-request/locales/`,
  `tests/unit/`

---

## Phase 1: Test-First (Red) — matemática, ARIA e contrato i18n

**Purpose**: Escrever/atualizar os testes para o comportamento novo (4 estágios) e confirmar que
falham contra a ordem atual (3 estágios) — prova de que capturam a mudança.

- [x] T001 [US3] Atualizar `tests/unit/story-generation-progress.test.tsx`: caso
  `getGenerationStage` para **4 estágios** com boundaries exatos 0→0, 7→0, 8→1, 15→1, 16→2, 23→2,
  24→3, 60→3 e clamp em 1000→3 (remover asserts de 3 estágios 0/8/16)
- [x] T002 [US3] Atualizar mesmo arquivo: `barPercent` default em 4 passos — 0/25/50/75 por estágio
  e 100 com `done=true`; remover asserts 33/66; manter o caso de generalização
  (`barPercent(stage, stageCount)`) para provar o API data-driven
- [x] T003 [US3] Atualizar mesmo arquivo: renderização com 4 badges (`ol` com 4 itens, badges
  ✓/2/3/4 no estágio 1), título adaptativo do estágio 0 = "Estruturando sua história…"
  (`pt-BR`), e `progressbar` com `aria-valuemax="3"` / `aria-valuenow` por estágio (remover "2")
- [x] T004 [US4] Atualizar `tests/unit/i18n-config.test.ts`: assert de que
  `story.progress.stagePlanning` é string nos dois catálogos (junto de `stageWriting`/
  `stageIllustrating`)

**Checkpoint**: `pnpm test` falha apenas nos casos atualizados (red) — nenhum outro teste quebrado.

---

## Phase 2: US1 + US2 — i18n e componente (Green)

**Purpose**: Implementar a correção — labels de planejamento e a ordem canônica de 4 estágios.

- [x] T005 [P] [US1] Adicionar `"stagePlanning": "Estruturando sua história…"` em
  `src/features/story-request/locales/pt-BR.json` e `"Structuring your story…"` em
  `src/features/story-request/locales/en.json` dentro de `story.progress` (antes de `stageWriting`)
- [x] T006 [P] [US1][US2] Em `src/features/story-request/components/story-generation-progress.tsx`:
  `GENERATION_STAGES = ["stageWriting", "stageIllustrating", "stageReviewing"]` →
  `["stagePlanning", "stageWriting", "stageReviewing", "stageIllustrating"]` — garantindo
  (US2) que `stageReviewing` precede `stageIllustrating` e `stagePlanning` é o primeiro
- [x] T007 [US3] Atualizar no mesmo arquivo os comentários/JSDoc: ordem de avanço
  "planning → writing → safety review → illustrating", "2×8 = 16 s" → "3×8 = 24 s"
  (último passo inicia em 24 s, abaixo de `TIMEOUT_CUE_AT_SECONDS = 30`), "three steps" →
  "four" na doc do prop `stepDurationSeconds` e no docblock do arquivo

**Checkpoint**: `pnpm test` verde (os testes da Phase 1 agora passam); versão pt-BR e en com os 4
badges na ordem canônica.

---

## Phase 3: US3 — Stories do Storybook (comportamento = app)

**Purpose**: Manter Storybook em sincronia com o app e a12y checada por story.

- [x] T008 [P] [US3] Atualizar `src/features/story-request/components/story-generation-progress.stories.tsx`:
  4 stories alinhadas — `Planning` (0 s), `Writing` (`STEP_DURATION_SECONDS`), `Reviewing`
  (`2 * STEP_DURATION_SECONDS`), `Illustrating` (`LAST_STAGE_AT_SECONDS` = 24 s) — com comentários
  de barra corretos (0/25/50/75%); **manter** `Timeout`, `SafetyRetry` e `ProviderFailure`
  inalteradas

**Checkpoint**: `pnpm storybook:test` com as 4 stories + a11y (AA) sem regressão.

---

## Phase 4: US4 — Consolidação de contrato i18n e migração completa

**Purpose**: Verificar que nenhum resíduo da matemática de 3 estágios sobreviveu.

- [x] T009 [US4] `rg` em `src/features/story-request/{components,locales}` e `tests/unit` por
  resíduos: `aria-valuemax="2"`, `33%`, `66%`, "three stages", "2×8", "stage[0-9]" fora de
  `GENERATION_STAGES` — remover qualquer ocorrência remanescente (docs/comentários inclusive)

**Checkpoint**: busca limpa; catálogos com 4 chaves de estágio; teste de contrato i18n verde.

---

## Phase 5: Gates finais (após a ÚLTIMA edição) — Definition of Done

**Purpose**: Rodar todos os gates depois da última edição; resultados anteriores são STALE
(AGENTS.md) e não contam.

- [x] T010 [P] `pnpm lint` (0 warnings) e `pnpm typecheck` (strict, sem `any`)
- [x] T011 [P] `pnpm format:check` sem drift — rodar `pnpm format` em/após TODOS os arquivos
  novos/editados (inclui `specs/011-progress-stages-alignment/*.md`)
- [x] T012 [P] `pnpm test` verde (unit + contrato) e `pnpm build` passando
- [x] T013 Revisar diff final: contrato HTTP/rotas/backend/privacidade **intocados** (nenhum
  arquivo fora da lista do plan.md); estado git limpo; (opcional) `pnpm storybook:test`

**Definition of Done**: 4 estágios exibidos na ordem Planner → Writer → Moderator → Illustrator
nos dois idiomas; badges/ARIA/percentuais corretos; sem resíduos de 3 estágios; gates verdes
re-rodados após a última edição; commit com gitmoji + Conventional Commits
(`:recycle: fix(story-request): align progress stages with agent pipeline`).