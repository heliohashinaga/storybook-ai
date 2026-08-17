---
description: "Lista de tarefas para implementação do recurso"
---

# Tasks: Consolidação da Orquestração dos Adapters de Provider

**Input**: Documentos de design de `/specs/013-refactor-provider-orchestration/`

**Prerequisites**: plan.md (obrigatório), spec.md (obrigatório; user stories US1-US3, todas de qualidade preservadora de comportamento)

**Tests**: Testes existentes dos adapters (`tests/unit/` — `openrouter`/`opencode`) são o baseline a manter verde **sem alterar expectativas**; testes novos (se necessários) escritos ANTES e confirmados a FALHAR.

**Organization**: Tarefas agrupadas por user story (US1-US3), com a Phase 2 (Fundacional) bloqueando US1-US3. Feature **preservadora de comportamento** — nenhuma mudança de UI, contrato, env ou prompt.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar o contexto da refatoração e proteger o baseline.

- [ ] T001 Confirmar que a branch `013-refactor-provider-orchestration` está ativa e limpa
  (git status limpo; scaffold do spec commitado), a partir do base `012-fake-content-catalog`.
- [ ] T002 Rodar o baseline de qualidade na árvore atual (antes de qualquer edição): `pnpm lint`,
  `pnpm format:check`, `pnpm typecheck`, `pnpm test` — registrar o resultado **e um snapshot das
  fixtures dos adapters** (entrada/saída de `generateStory`/`moderateText`/`moderateImage`) como
  referência para comparar após a refatoração (paridade behavior-preserving, SC-003).
- [ ] T003 Verificar que `.specify/feature.json` aponta para `specs/013-refactor-provider-orchestration`
  (atualizar se necessário; registrar o valor anterior para restauração ao final).

**Checkpoint**: Árvore verde no baseline; branch 013 ativo; a refatoração começa em terreno conhecido.

---

## Phase 2: Fundacional (Factory de orquestração)

**Purpose**: Criar `createChatCompletionsProvider` em `provider-core/`, movendo o corpo de
orquestração dos adapters **verbatim** — sem quebrar os adapters ainda (eles continuam a usar as
próprias definições até a troca completa).

**⚠️ CRITICAL**: Nenhum user story pode ser marcado completo até a factory existir, ser exportada
via barrel e testada.

- [ ] T010 (US1) Criar `src/features/story-generation/server/provider-core/create-chat-provider.ts`
  com a `ChatCompletionsProviderDeps` e a factory `createChatCompletionsProvider`, contendo
  `generateStory`, `moderateText`, `moderateImage` — **cópia verbatim** do corpo dos adapters
  (sem mudança de semântica, prompt, timeout, retry ou tratamento de erro).
- [ ] T011 (US1) Exportar a factory + tipo `ChatCompletionsProviderDeps` no barrel
  `provider-core/index.ts` (`export * from './create-chat-provider'`), coerente com os exports atuais.
- [ ] T012 (US1) **Teste novo ANTES de implementar o restante** (se necessário): um teste de unit da
  factory que confirme que `generateStory`/`moderateText`/`moderateImage` produzem exatamente o
  mesmo output das fixtures dos adapters (baseline T002), com `fetchImpl` fake
  e `STORIES_TEST_MODE=fake`. Confirmar que **falha** antes da factory existir, e **passa** depois.
- [ ] T013 (US1) Rodar `pnpm typecheck` e `pnpm test` — a factory nova compila e os testes dela
  verdes, sem tocar nos adapters ainda.

**Checkpoint**: Factory existe, exportada e testada; adapters ainda intactos (verde).

---

## Phase 3: Adapters finos (US2)

**Purpose**: Trocar `openrouter` e `opencode` para compor a factory, eliminando o corpo duplicado.

- [ ] T020 (US2) Refatorar `openrouter-story-generation-provider.ts`: remover o corpo de
  `generateStory`/`moderateText`/`moderateImage` e delegar a `createChatCompletionsProvider({ client,
  textModel, moderationModel, fetchImpl })`, mantendo `resolveDeps()`, `getClient()` (baseUrl +
  `defaultHeaders`) e a interface `StoryGenerationProvider` intacta.
- [ ] T021 (US2) Refatorar `opencode-story-generation-provider.ts`: idêntico ao T020, mantendo
  `getClient()` **sem** `defaultHeaders` (como hoje).
- [ ] T022 (US2) Comportamento de imagem: se houver drift entre `createOpenRouterIllustration`/
  `create-opencode-illustration` e o `provider-core/image-client.ts`, **não** mesclar nesta feature —
  registrar follow-up no `reviews.md` (SC: fora do escopo, ver Decisão-4). Se o diff for trivial,
  reutilizar o que `image-client.ts` já expõe.
- [ ] T023 (US2) Rodar `pnpm typecheck` e `pnpm test` — os testes existentes dos dois adapters
  verdes **sem alteração de expectativa** (paridade garantida, SC-003).

**Checkpoint**: Adapters são finos; nenhum corpo de orquestração duplicado permanece fora do
`provider-core`.

---

## Phase 4: Verificação e higiene (US3)

**Purpose**: Provar que não sobrou duplicação e que os gates finais estão verdes no diff final.

- [ ] T030 (US3) **Prova de ausência de duplicação**: grep de `parseChatJson`/`moderateText`/
  `moderateImage`/`storyCandidateSchema.parse` — deve retornar ocorrências **apenas** em
  `provider-core/` (factory), nunca no corpo dos adapters.
- [ ] T031 (US3) Remover dead code: confirmar que nenhum import/helper órfão ficou nos adapters após
  a extração (sem imports não usados, sem funções mortas).
- [ ] T032 (US3) Documentação: criar `docs/adr/adr-0010-provider-orchestration-factory.md` seguindo
  o template dos ADRs existentes (ex.: `adr-0008-provider-core-extraction.md`), registrando a
  decisão da factory única e o motivo (evitar divergência silenciosa entre providers).
- [ ] T033 (US3) Atualizar `specs/013-refactor-provider-orchestration/spec.md` e `plan.md` se o
  diff final divergir do desenhado (sem relaxar invariantes).
- [ ] T034 (US3) **Gates finais pós-edição** (no diff final, não antes): `pnpm lint` (0 warnings),
  `pnpm format:check` (rodar `pnpm format` em QUALQUER arquivo novo/editado, incluindo specs e ADR),
  `pnpm typecheck`, `pnpm test`.
- [ ] T035 (US3) Restaurar `.specify/feature.json` para `specs/012-fake-content-catalog` e confirmar
  que o scafffdo da branch está limpo e pronto para review.

**Checkpoint**: Diff final verde (lint/format/typecheck/test); ADR-0010 criado; nenhuma duplicação;
branch 013 pronta para merge e review.

---

## Definition of Done (resumo)

- [ ] `openrouter` e `opencode` são adapters finos (só config + composição da factory).
- [ ] `createChatCompletionsProvider` vive em `provider-core/` e é exportado pelo barrel.
- [ ] Nenhum corpo de `generateStory`/`moderateText`/`moderateImage` fora do `provider-core`.
- [ ] Testes existentes dos adapters verdes **sem alteração de expectativa**.
- [ ] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` verdes no diff final.
- [ ] ADR-0010 criado; `spec.md`/`plan.md` em sincronia; `feature.json` restaurado para `012`.
