---
description: "Lista de tarefas para implementação do recurso"
---

# Tasks: Núcleo Comum dos Adapters de Provider

**Input**: Documentos de design de `/specs/008-refactor-provider-core/`

**Prerequisites**: plan.md (obrigatório), spec.md (obrigatório; user stories US1-US3 refatoradas como objetivos de qualidade)

**Tests**: Testes existentes são o baseline a manter verde; testes novos (se necessários) são escritos ANTES e confirmados a FALHAR.

**Organization**: Tarefas agrupadas por user story (US1-US3), com a Fase 2 (Fundacional) bloqueando todas.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar o contexto da refatoração e proteger o baseline.

- [ ] T001 Confirmar que a branch `008-refactor-provider-core` está ativa e limpa (scaffold commitado),
  com `pnpm install` íntegro (`pnpm list --depth 0` / `pnpm install`). A criação da branch já foi
  feita a partir de `007-adopt-blossom-design`; verificação serve como baseline.
- [ ] T002 Rodar o baseline de qualidade na árvore atual (antes de qualquer edição): `pnpm lint`,
  `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage:check` — registrar o
  resultado **e um snapshot das fixtures dos adapters** (referência de commit/árvore limpa) para
  comparar fixtures de entrada/saída após a refatoração (SC-002).
- [ ] T003 Verificar que `.specify/feature.json` aponta para `specs/008-refactor-provider-core` (já
  atualizado pelo `create-new-feature.sh`); anotar para restaurar `007` ao final (T027).

**Checkpoint**: Árvore vaiária verde no baseline; branch 008 criado; a refatoração começa em terreno conhecido.

---

## Phase 2: Fundacional (Blocking Prerequisites)

**Purpose**: Criar o núcleo `provider-core/` e o cliente de imagem base — sem quebrar os adapters, ainda usando os módulos novos em paralelo aos antigos até a troca completa.

**⚠️ CRITICAL**: Nenhum user story pode ser marcado completo até o núcleo existir e ser testado.

### 2.1 Núcleo de texto/moderação

- [ ] T004 **Teste primeiro** — criar `tests/unit/provider-core/schemas.test.ts`, `prompts.test.ts`, `chat-json.test.ts`, `moderation.test.ts`, `provider-errors.test.ts` que exercitam `sceneCandidateSchema`, `storyCandidateSchema`, `moderationSchema`, `parseChatJson`, `NARRATIVE_SYSTEM_PROMPT`/`narrativeUserPrompt`, `MODERATION_SYSTEM_PROMPT`/`moderate` e `toProviderError`. **Confirmar que falham** (módulos inexistentes) antes de implementar — conforme constitution.
- [ ] T005 [US1] Criar `src/features/story-generation/server/provider-core/schemas.ts` extraindo `sceneCandidateSchema`, `storyCandidateSchema` e `moderationSchema` (tal como atuais em openrouter/opencode). Fazer `diff` vazio com as definições originais.
- [ ] T006 [US1] Criar `src/features/story-generation/server/provider-core/prompts.ts` com `NARRATIVE_SYSTEM_PROMPT`, `narrativeUserPrompt(input)` e `MODERATION_SYSTEM_PROMPT`. **`diff` vazio obrigatório** com os textos atuais dos dois providers (usar como fonte a versão canônica idêntica confirmada; não editar conteúdo).
- [ ] T007 [US1] Criar `src/features/story-generation/server/provider-core/chat-json.ts` com `parseChatJson` (idêntico ao dos adapters).
- [ ] T008 [US1] Criar `src/features/story-generation/server/provider-core/moderation.ts` com `moderate(...)` (usando `MODERATION_SYSTEM_PROMPT` + `moderationSchema`) e `provider-errors.ts` com `toProviderError`.
- [ ] T009 [US1] Criar `src/features/story-generation/server/provider-core/index.ts` como barrel `server-only` re-exportando o núcleo.

### 2.2 Cliente de imagem

- [ ] T010 **Teste primeiro** — criar `tests/unit/provider-core/image-client.test.ts` que exercita o POST `/images` com `fetchImpl` fake: caso `b64_json`, caso `url`, caso sem `data`, caso `!response.ok`, caso timeout (abort). **Confirmar falha** antes de implementar.
- [ ] T011 [US2] Criar `src/features/story-generation/server/provider-core/image-client.ts` com a função de transporte compartilhada `postImages(...) => { bytes, mediaType }` (corpo `{model, prompt, n:1, output_format:"webp", aspect_ratio:"1:1"}`), usando AbortController/timeout e re-utilizando o encoding/guarda de `image-optimizer.ts`.
- [ ] T012 [US2] Integrar `image-optimizer.ts` ao `image-client.ts`: o novo cliente DEVE chamar `optimizeImageBytes` / `defaultSharpEncoder` no caminho real de geração, aplicando `DEFAULT_MAX_DATA_URI_LENGTH` (guarda de 4 MiB) — conforme confirmado na pesquisa, hoje órfão e a guarda não roda em produção. Isso fecha o vão de tamanho de data-URI; não manter órfão.
- [ ] T013 **Teste primeiro** — escrever/ajustar `tests/unit/image-optimizer.test.ts` (e, se
  necessário, novo teste do `image-client.ts`) para cobrir a guarda de tamanho e o reuso pelo
  caminho real de geração. **Um teste que falha primeiro** é escrito antes da implementação e
  confirmado a falhar (constitution).

**Checkpoint**: Núcleo creador + cliente de imagem extraídos e verdes isoladamente; ainda nada de produção chamando eles (troca nos user stories).

---

## Phase 3: User Story 1 — Núcleo único de texto/moderação (Priority: P1) 🎯 MVP

**Goal**: Adaptadores OpenRouter/OpenCode passam a consumir `provider-core` eliminando duplicação de texto/moderação.

**Independent Test**: `tests/unit/openrouter-story-generation-provider.test.ts` e `opencode-story-generation-provider.test.ts` seguem 100% verdes com fixtures de entrada/saída inalteradas.

### Tests for User Story 1 ⚠️

- [ ] T014 [US1] Garantir que os testes existentes dos dois adapters cobrem o caminho de moderação
  (regen de cenário inseguro) e erro. Se for detectado um gap, escrever um teste que falha primeiro em
  `tests/unit/*story-generation-provider.test.ts` antes da implementação (constitution).

### Implementation for User Story 1

- [ ] T015 [P] [US1] Refatorar `src/features/story-generation/server/opencode-story-generation-provider.ts`: trocar definições locais pelos imports de `provider-core` (schemas, `parseChatJson`, prompts, `moderate`, `toProviderError`); manter apenas `OpenCodeDeps`, `resolveDeps` (env key `OPENCODE_GO_API_KEY`), `createOpenCodeStoryProvider` e a construção do cliente SDK.
- [ ] T016 [P] [US1] Refatorar `src/features/story-generation/server/openrouter-story-generation-provider.ts`: trocar definições locais pelos imports de `provider-core`; manter `OpenRouterDeps`, `resolveDeps` (env key `OPENROUTER_API_KEY`, `imageModel` via `modelWithoutProviderPrefix`, `imageEncoder`), construção do cliente SDK. **A remoção do código de imagem acontece em US2** (evitar dupla mudança).
- [ ] T017 [US1] Remover as definições duplicadas dos módulos antigos (`grep` para confirmar zero ocorrência restante de cada helper fora de `provider-core/`).
- [ ] T018 [US1] Rodar `pnpm test` + `pnpm typecheck` + `pnpm lint` + `pnpm format:check` na árvore suja e garantir verdes.

**Checkpoint**: US1 entrega o MVP — ambos adapters mais finos, comportamento idêntico, testes verdes.

---

## Phase 4: User Story 2 — Transporte único de ilustração `/images` (Priority: P2)

**Goal**: `createOpenRouterIllustration` e `createOpenCodeIllustration` passam a usar o `image-client.ts` (via `image-optimizer.ts`), eliminando o transporte `/images` duplicado e tirando a imagem de dentro do adapter OpenRouter.

**Independent Test**: `tests/unit/opencode-illustration.test.ts`, `tests/unit/illustration-concurrency.test.ts` e `tests/unit/image-optimizer.test.ts` verdes com as mesmas respostas fake.

### Implementation for User Story 2

- [ ] T019 [US2] Refatorar `src/features/story-generation/server/create-opencode-illustration.ts` para chamar `postImages` + encoding via `image-optimizer` (removendo `defaultImageEncoder`/`toProviderError`/`resolveDeps` locais duplicados; manter `OpenCodeIllustrationDeps` e o seam de timeout).
- [ ] T020 [US2] Refatorar `createOpenRouterIllustration` dentro de `openrouter-story-generation-provider.ts` para usar `postImages` + encoding via `image-optimizer` (removendo `isWebP`/`defaultImageEncoder`/`toWebPBuffer` locais). Manter o `imageEncoder` injetável como opt-in do núcleo.
- [ ] T021 [P] [US2] Avaliar `src/features/story-export/client/build-story-pdf.tsx` que re-declara `WEBP_DATA_URI_PREFIX`; se um re-export seguro (fora de `server-only`) for possível sem puxar código server-only ao client, reutilizar a constante; senão, deixar como está por fronteira (documentar escolha na review).
- [ ] T022 [US2] Rodar pipeline de testes de ilustração + `pnpm typecheck` + `pnpm lint` + `pnpm format:check` na árvore suja.

**Checkpoint**: US1 + US2 completos — transporte e encoding de imagem centralizados, adapters enxutos.

---

## Phase 5: User Story 3 — Higiene e validação de fechamento (Priority: P3)

**Goal**: `generation-runtime.ts` e `fixed-dev-provider.ts` sem duplicação nova; gates finais pós-última-edição; documentação sincronizada.

**Independent Test**: execução do pipeline completo com a árvore suja (não-deployed) em `STORIES_TEST_MODE=fake`.

- [ ] T023 [P] [US3] Confirmar `src/features/story-generation/server/generation-runtime.ts`: atualizar apenas imports/seams se algum caminho de import dos adapters mudou; roteamento por provider (texto/moderação/imagem) permanece idêntico.
- [ ] T024 [US3] Revisar `src/features/story-generation/server/fixed-dev-provider.ts` (287 linhas): consolidar fixtures determinísticas com as usadas nos testes/pipeline (sem re-declarar estruturas repetidas), só se isso não alterar comportamento fake.
- [ ] T025 [P] [US3] Executar TODOS os gates na árvore suja APÓS a última edição: `pnpm lint`,
  `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage:check`, `pnpm test:coverage`,
  `pnpm build` — registrar resultado (sem stale). **Anexar a verificação de SC-005**: `wc -l`/`git diff
  --stat` dos dois adapters (antes vs depois) e checagem de cobertura pós-remoção.
- [ ] T026 [P] [US3] Atualizar documentação: se algum contrato mudou, ajustar `docs/adr/`/`story-generation.openapi.yaml` (esperado: N.A.); registrar a decisão de extração do núcleo em `docs/adr/` (ADR novo) e em `specs/008-refactor-provider-core/reviews.md`.

**Novo (remediação)**:

- [ ] T028 [P] [US3] **Verificação de privacidade**: assertar (via `grep`/review) que a refatoração não
  introduziu identificador direto novo nos payloads/fakes, mantendo a fronteira `server-only` e
  `POST /api/stories` como única entrada (FR-006). Registrar resultado em `reviews.md`.
- [ ] T027 [US3] Restaurar `.specify/feature.json` para `specs/007-adopt-blossom-design` (ou conforme convenção do workflow) e atualizar/revisar `reviews.md`.

**Checkpoint**: Recurso completo — duplicação eliminada, gates verdes na árvore suja, docs sincronizadas.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências; começa imediato.
- **Fundacional (Phase 2)**: depende do Setup; **BLOQUEIA** os user stories.
- **US1 (Phase 3)**: depende da Phase 2 (núcleo).
- **US2 (Phase 4)**: depende da Phase 2 (image-client). Pode rodar depois de US1 ou em paralelo (arquivos distintos), mas os dois adapters compartilham `openrouter-story-generation-provider.ts` — então US1 e US2 mexem no mesmo arquivo OpenRouter; **recomendado sequencial** para evitar conflito.
- **US3 (Phase 5)**: depende de US1 + US2 completos.

### User Story Dependencies

- **US1 (P1)**: pode iniciar após a Fundacional; sem dependência de US2.
- **US2 (P2)**: pode iniciar após a Fundacional; integra com US1 no arquivo OpenRouter (sequencial recomendado).
- **US3 (P3)**: validação de fechamento; depende de US1 + US2.

### Within Each User Story

- Testes (quando novos) escritos e **falhando** antes da implementação.
- Núcleo antes dos adapters; backend (server-only) sempre.
- Story completo antes do próximo.

### Parallel Opportunities

- T015/T016 (US1) — arquivos distintos, podem rodar em paralelo.
- T021 (US2 build-story-pdf) — independente, pode rodar em paralelo com T019/T020.
- T023/T025/T026 (US3) — podem rodar em paralelo, mas T025 é o meio-fio final.

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1: Setup (baseline verde + branch).
2. Phase 2: Fundacional (núcleo + cliente de imagem) — CRÍTICO, bloqueia tudo.
3. Phase 3: US1 → VALIDAR (adapters verdes, thin shells).
4. Fase 4: US2 → VALIDAR.
5. Fase 5: US3 (gates finais + docs).

### Parallel Strategy (se 2 devs)

- Dev A: US1 (T015/T016).
- Dev B: US2 (T019/T020) + T021.
- Ambos esperam Fundacional; coordenar o arquivo OpenRouter (um faz T016, o outro T020 — de preferência sequencial).

## Notes

- [P] = arquivos diferentes, sem dependências.
- Cada símbolo duplicado deve ser definido **uma única vez** em `provider-core/` no fim (SC-001).
- Gates (`lint`/`format:check`/`typecheck`) re-executados APÓS a última edição — resultado stale é inaceitável.
- Nenhum commit com `--no-verify`; hook pré-commit executando lint/format/typecheck.
