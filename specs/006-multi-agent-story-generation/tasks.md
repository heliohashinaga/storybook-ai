---

description: "Task list for the multi-agent story generation feature"
---

# Tasks: Sistema multi-agente de geração de histórias

**Input**: Design documents from `/specs/006-multi-agent-story-generation/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: TDD é obrigatório pelo constitution/AGENTS.md (Test-First, cobertura ≥80% total, ≥90% safety/validation/orchestration, determinístico com fakes). Cada story inclui testes escritos ANTES da implementação e que devem falhar primeiro.

**Organization**: Tasks são agrupadas por user story (US1..US4 com US3-b) para implementação e teste independentes.

**Remediation**: IDs reescritos em sequência (46 tasks no total) após incorporar findings do `/speckit.analyze` (rate-limit 429, regressão de contrato, estado a11y da narração).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências incompletas)
- **[Story]**: US1..US4 (US3-b) conforme spec.md
- Incluir caminhos exatos de arquivos

## Path Conventions

- **Single project (Next.js)**: `src/`, `tests/` na raiz do repositório
- Área-alvo: `src/features/story-generation/server/agents/` (novo), `tests/unit`, `tests/contract`, `tests/integration`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicializar estrutura do pipeline multi-agente e infra de teste do pipeline.

- [X] T001 Criar subpacote de agentes em `src/features/story-generation/server/agents/` com barrel `index.ts` (Coordinator, Planner, Writer, Reviewer, Illustrator, Reader)
- [X] T002 Definir tipos comuns `agent-result.ts` em `src/features/story-generation/server/agents/agent-result.ts` (`AgentResult<T> = Ok<T> | Err{stage, message, transient}`, `AgentId`)
- [X] T003 Implementar política de retry `retry.ts` em `src/features/story-generation/server/agents/retry.ts` (`runWithRetry(fn, { maxAttempts })`, default 2, leitura de env server-only)
- [X] T004 [P] Configurar fakes determinísticos do pipeline em `tests/fixtures/story-generation/agents.ts` (Planner/Writer/Reviewer/Illustrator/Reader fakes controláveis)
- [X] T005 [P] Adicionar helpers de medição de tempo/budget em `tests/unit/story-generation/agents` baseado em `generation-runtime.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Escada comum que TODO story bloqueia — o Coordinator é o tronco do pipeline.

**⚠️ CRITICAL**: Nenhum trabalho de user story começa antes desta fase

- [X] T006 Criar esqueleto `coordinator.ts` em `src/features/story-generation/server/agents/coordinator.ts` que encadeia Planner→Writer→Reviewer→(Illustrator|Reader) com `AgentResult` e orquestra via `retry.ts`
- [X] T007 Add `generateStoryPipeline(ctx: JobContext): Promise<AgentResult<GeneratedStory>>` como API pública do pipeline em `src/features/story-generation/server/agents/coordinator.ts`
- [X] T008 Integrar `JobContext` (ageBand, locale, theme, sceneCountRequested, trace token) em `src/features/story-generation/server/schemas.ts` reaproveitando `MIN_SCENES/MAX_SCENES/DEFAULT_SCENE_COUNT`
- [X] T009 [P] Mapear `GenerationRuntime` (provider/illustrate/rateLimiter) para os agentes via `src/features/story-generation/server/story-generation-provider.ts` mantendo a interface existente
- [X] T010 Adicionar validação Zod de re-validação server (ageBand/locale/theme/sceneCount) antes de qualquer provider em `src/app/api/stories/route.ts` (via `schemas.ts`)

**Checkpoint**: Coordinator tronco funcional — stories podem começar

---

## Phase 3: User Story 1 - Geração coordenada por agentes (Priority: P1) 🎯 MVP

**Goal**: Pipeline coordenado em que cada role executa suas ações (Planner planeja, Writer escreve, Reviewer aprova, Coordinator monta) e retorna `GeneratedStory` completo. O passo do **Reader** é opcional nesta story (entregue integralmente na US3-b) e não bloqueia a conclusão (ref. AC-1 da spec).

**Independent Test**: `pnpm exec vitest run tests/unit/story-generation` com fakes — verificar cada role produziu saída (outline, narrativa, aprovação), ordem respeitada e resultado completo; `tests/contract/story-generation.openapi.test.ts` continua verde (contrato inalterado, regressão SC-006); throttling 429 tratado como transitório.

### Tests for User Story 1 (TDD — escrever primeiro, FAIL antes) ⚠️

- [X] T011 [P] [US1] Unit de `planner.ts` (outline 3..5 cenas, tema/locale, sem identificador) em `tests/unit/story-generation/agents/planner.test.ts`
- [X] T012 [P] [US1] Unit de `writer.ts` (narrativa por faixa etária/tom, sem identificador) em `tests/unit/story-generation/agents/writer.test.ts`
- [X] T013 [P] [US1] Unit de orquestração do `coordinator.ts` (ordem e montagem de `GeneratedStory` completo; Reader opcional não bloqueia) em `tests/unit/story-generation/agents/coordinator.test.ts`
- [X] T014 [P] [US1] Contrato de pipeline (US1 produz contrato válido `ordinal/title/body/illustrationDataUri`) em `tests/contract/story-generation.pipeline.test.ts`
- [X] T015 [P] [US1] Unit de throttling 429 no Coordinator (falha transitória → retry bounded → erro tipado de throttling, sem expor o usuário) em `tests/unit/story-generation/agents/coordinator-throttling.test.ts`

### Implementation for User Story 1

- [X] T016 [P] [US1] Implementar `planner.ts` em `src/features/story-generation/server/agents/planner.ts` produzindo `Outline` de 3..5 cenas
- [X] T017 [P] [US1] Implementar `writer.ts` em `src/features/story-generation/server/agents/writer.ts` escrevendo narrativa localizada por idade/tom
- [X] T018 [US1] Refatorar `generate-story.ts` em `src/features/story-generation/server/generate-story.ts` para delegar a `generateStoryPipeline` (Coordinator) mantendo erros tipados 502/504 e `unsafe_unrecoverable`
- [X] T019 [US1] Implementar montagem do `GeneratedStory` no Coordinator em `src/features/story-generation/server/agents/coordinator.ts` (atômica — só após todos os estágios)
- [X] T020 [US1] Garantir `POST /api/stories` (`src/app/api/stories/route.ts`) `Cache-Control: no-store` e único entry-point de geração
- [X] T021 [P] [US1] Rodar/confirmar `tests/contract/story-generation.openapi.test.ts` existente segue verde como regressão do contrato (SC-006) após o refactor

**Checkpoint**: US1 funcional e testável isoladamente (deploy/demo = MVP)

---

## Phase 4: User Story 2 - Reviewer como gate autoritativo (Priority: P1)

**Goal**: Reviewer valida segurança/tom/adequação; rejeita→regenera 1x→senão erro seguro localizado; nada inseguro retorna/loga. TDD por invariante de privacidade.

**Independent Test**: fakes devolvendo candidato inseguro → bloqueado; regeneração única; 2ª insegura → erro seguro genérico; assert nenhum identificador direto em payload/logs/fakes.

### Tests for User Story 2 (TDD) ⚠️

- [X] T022 [P] [US2] Unit do Reviewer (block, regenerate-once, erro seguro localizado) em `tests/unit/story-generation/agents/reviewer.test.ts`
- [X] T023 [P] [US2] Contrato/invariante de privacidade (nenhum `name`/identificador cruza o gate) em `tests/contract/story-generation.privacy.test.ts`

### Implementation for User Story 2

- [X] T024 [P] [US2] Implementar `reviewer.ts` em `src/features/story-generation/server/agents/reviewer.ts` (gate autoritativo sobre saída do Writer)
- [X] T025 [US2] Integrar Reviewer ao Coordinator pós-Writer em `src/features/story-generation/server/agents/coordinator.ts` (regeneração única com restrições mais fortes)

**Checkpoint**: US1 + US2 funcionam e são testáveis independentemente

---

## Phase 5: User Story 3 - Ilustrações por agente com prompts em inglês (Priority: P2)

**Goal**: Illustrator gera `imagePrompt` sempre em inglês + ilustração por cena aprovada; conjunto parcial nunca é "sucesso".

**Independent Test**: fakes — cada cena aprovada tem exatamente 1 prompt em inglês + 1 ilustração; falha de 1 cena → erro tipado, nunca `GeneratedStory` parcial.

### Tests for User Story 3 (TDD) ⚠️

- [X] T026 [P] [US3] Unit do Illustrator (prompt en, 1 ilustração/cena, sem parcial) em `tests/unit/story-generation/agents/illustrator.test.ts`
- [X] T027 [P] [US3] Unit de cenário de falha parcial (1 cena falha → erro tipado) em `tests/unit/story-generation/agents/illustrator-partial.test.ts`

### Implementation for User Story 3

- [X] T028 [P] [US3] Implementar `illustrator.ts` em `src/features/story-generation/server/agents/illustrator.ts` (prompts sempre em inglês; gatilho por cena)
- [X] T029 [US3] Integrar Illustrator ao Coordinator pós-Reviewer em `src/features/story-generation/server/agents/coordinator.ts` (impeds cena não aprovada; conjunto completo exigido)

**Checkpoint**: US1, US2, US3 funcionalmente completas

---

## Phase 6: User Story 3-b - Reader lê o texto da cena (Priority: P2)

**Goal**: Reader lê o texto da cena em voz alta; áudio SOB DEMANDA via `POST /api/narrate` (payload de `GeneratedStory` sem áudio embutido).

**Independent Test**: `GeneratedStory` sem blob/base64 de áudio; cada cena obtém narração via `/api/narrate`; com `AI_NARRATION_ENABLED=false` cai para fallback/desligado; narração parcial nunca quebra história.

### Tests for User Story 3-b (TDD) ⚠️

- [X] T030 [P] [US3-b] Unit de leitura sob demanda (`reader` via `story-read-aloud`, payload sem áudio) em `tests/unit/story-generation/agents/reader.test.ts`
- [X] T031 [P] [US3-b] Contrato de ausência de áudio embutido em `GeneratedStory` em `tests/contract/story-generation.no-audio.test.ts`

### Implementation for User Story 3-b

- [X] T032 [P] [US3-b] Implementar `reader.ts` em `src/features/story-generation/server/agents/reader.ts` encaminhando texto localizado para `tts-runtime`/`/api/narrate` (reuso, sem nova rota)
- [X] T033 [US3-b] Integrar Reader ao Coordinator (pós-aprovação) em `src/features/story-generation/server/agents/coordinator.ts` sem alterar `story-read-aloud`/`use-read-aloud`
- [X] T034 [P] [US3-b] Implementar estado acessível do player de narração (anúncio ler/parar via `aria-live`/`aria-busy`) no leitor em `src/features/story-reader/client/` + story de edge em Storybook (AC-2 da US3-b)

**Checkpoint**: all stories 1–3 funcionalmente completas

---

## Phase 7: User Story 4 - Orquestração com paralelização segura (Priority: P3)

**Goal**: paralelizar apenas estágios seguros (ilustrações por cena; Illustrator ∥ Reader pós-aprovação), respeitando dependências e budget ≤120 s; serial baseline garantido.

**Independent Test**: instrumentação de tempo do fake — dependências respeitadas (sem Write antes de Plan, sem Ilustração/Reader antes de Review); total ponta-a-ponta ≤120 s.

### Tests for User Story 4 (TDD) ⚠️

- [X] T035 [P] [US4] Unit de dependências/ordenação (nenhum estágio antes de suas dependências) em `tests/unit/story-generation/agents/parallelism.test.ts`
- [X] T036 [P] [US4] Teste de latência ponta-a-ponta ≤120 s com fake em `tests/performance/pipeline-latency.test.ts`

### Implementation for User Story 4

- [X] T037 [US4] Implementar paralelização segura em `src/features/story-generation/server/agents/coordinator.ts` (ilustrações concorrentes; Illustrator ∥ Reader pós-aprovação)
- [X] T038 [US4] Ajustar `generation-runtime.ts` para suportar paralelismo controlado e medição de budget

**Checkpoint**: pipeline completo, dentro do budget, sem quebrar dependências

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Robustez, confiabilidade, privacidade e validação final trans-stories.

- [X] T039 Rodar/integrar invariantes de privacidade (nenhum identificador direto em payload/logs/fakes) em `tests/contract/story-generation.privacy.test.ts`
- [X] T040 Atualizar `contracts/story-generation.openapi.yaml`? NÃO — contrato externo inalterado (SC-006); adicionar nota em `specs/006-multi-agent-story-generation/contracts/agent-pipeline.md`
- [X] T041 [P] Atualizar/confirmar cobertura ≥80% total e ≥90% safety/validation/orchestration em `pnpm test:coverage:check`
- [X] T042 Rodar `quickstart.md` (cenários 1–5) em `specs/006-multi-agent-story-generation/quickstart.md`
- [X] T043 [P] Confirmar budgets: geração ≤120 s, navegação ≤100 ms, bundle inicial ≤250 KiB (lazy-import PDF) via `pnpm test:performance`
- [X] T044 [P] Garantir strings localizadas (pt-BR/en) via next-intl, sem hardcode, nos novos agentes (erros tipados localizados)
- [X] T045 Rodar gates finais `pnpm lint` (0 warnings), `pnpm format:check`, `pnpm typecheck` — após a ÚLTIMA edição
- [X] T046 [P] Storybook: stories de loading/error/edge para o leitor (preservar a11y do `use-read-aloud`) via `pnpm storybook:test`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — inicia imediatamente
- **Foundational (Phase 2)**: depende do Setup; **BLOQUEIA** todas as stories
- **User Stories (Phase 3+)**: todas dependem do Foundational
  - US1 (P1) primeiro; US2 (P1) pode entrar em paralelo com US1 após T010/T019
  - US3 (P2) e US3-b (P2) dependem do Coordinator (US1) + Reviewer (US2)
  - US4 (P3) depende de US3/US3-b
- **Polish (Phase 8)**: depende de todas as stories desejadas completas

### User Story Dependencies

- **US1 (P1)**: somente Foundational — base do pipeline
- **US2 (P1)**: Foundational + orchestration US1; testável isoladamente via fakes
- **US3 (P2)**: Foundational + US1 (Coordinator) + US2 (Reviewer gate)
- **US3-b (P2)**: Foundational + US1 (Coordinator); reusa `story-read-aloud` existente
- **US4 (P3)**: US3 + US3-b (paralelização de Illustrator/Reader)

### Within Each User Story

- Testes escritos e FALHANDO antes da implementação
- Modelos/tipos → agentes (services) → integração no Coordinator
- Implementação central antes da integração final

### Parallel Opportunities

- Setup T004/T005 em paralelo (arquivos distintos)
- Tests de cada story (marcados [P]) podem rodar em paralelo entre si
- US1 Planner (T016) ∥ Writer (T017) após tipos compartilhados (T002)
- US3 Illustrator ∥ US3-b Reader (arquivos distintos) após US1+US2
- Polish T041/T043/T044/T046 em paralelo

---

## Parallel Example: User Story 1

```bash
# Testes de US1 juntos (TDD fail primeiro):
Task: "Unit de planner.ts em tests/unit/story-generation/agents/planner.test.ts"
Task: "Unit de writer.ts em tests/unit/story-generation/agents/writer.test.ts"

# Implementação paralela (Planner e Writer em arquivos distintos):
Task: "Implementar planner.ts em src/features/story-generation/server/agents/planner.ts"
Task: "Implementar writer.ts em src/features/story-generation/server/agents/writer.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational (CRITICAL — Coordinator via T006–T010)
3. Phase 3: User Story 1
4. **STOP e VALIDATE**: `pnpm exec vitest run tests/unit/story-generation tests/contract/story-generation.pipeline.test.ts tests/contract/story-generation.openapi.test.ts`
5. Deploy/demo se pronto

### Incremental Delivery

1. Setup + Foundational → foundation pronto
2. US1 → testar isolado → Demo (MVP!)
3. US2 → testar → Demo
4. US3 → testar → Demo
5. US3-b → testar → Demo
6. US4 → testar → Demo

### Parallel Team Strategy

1. Equipe faz Setup + Foundational juntos
2. Depois: Dev A (US1), Dev B (US2); depois Dev A (US3), Dev B (US3-b); depois US4
3. Stories integram-se sem quebrar independência

---

## Notes

- [P] = arquivos diferentes, sem dependências
- [Story] mapeia task a story para rastreabilidade
- Cada story independentemente completável e testável
- Testes falham antes de implementar
- Commit após cada task ou grupo lógico
- Gates finais (`lint`/`format:check`/`typecheck`) re-rodados APÓS a última edição
- Evitar: tasks vagas, conflito de mesmo arquivo, interdependências que quebram independência
