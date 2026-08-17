# 013 — Consolidar a orquestração dos adapters de geração (provider)

| | |
|---|---|
| **Feature branch** | `013-refactor-provider-orchestration` |
| **Criado** | 2026-08-17 |
| **Status** | Draft |
| **Input** | `012-fake-content-catalog` |

## Summary

Extrair a camada de **orquestração** dos dois adapters de geração OpenAI-compatíveis
(`openrouter-story-generation-provider.ts` e `opencode-story-generation-provider.ts`)
para uma **factory única, behavior-preserving** em `provider-core/`. Este é o passo
seguinte e complementar ao `008-refactor-provider-core`, que consolidou as **primitivas
de baixo nível** (`parseChatJson`, `moderate`, schemas, prompts, erros) mas **não** a
fatia de orquestração — por isso `generateStory()`, `moderateText()` e `moderateImage()`
continuam **idênticos byte a byte** entre os dois adapters.

## Problem Statement

Os dois adapters duplicam, linha por linha, o seguinte:

- `generateStory()` — chat completion com `response_format: json_object`, prompt de
  narrativa → `parseChatJson` → `storyCandidateSchema.parse` → mesmo tratamento de
  `ZodError`/`ProviderError` → `toProviderError`.
- `moderateText()` / `moderateImage()` — delegações idênticas para
  `moderate(getClient(), deps.moderationModel, …)`.
- `resolveDeps()` — mesmo padrão de `getEnv()`/fallback, variando só as env keys.
- `getClient()` — mesmo lazy client OpenAI, variando só no `defaultHeaders` (OpenRouter).

O risco prático: alterar um timeout, um retry, um prompt de system ou o tratamento de
erro em um adapter e esquecer o outro — divergência silenciosa de comportamento entre
providers. Como o routing (`provider-routing.ts`) escolhe o provider por prefixo de
modelo, essa divergência é invisível em runtime até quebrar.

## Success Criteria

- **SC-001** `openrouter` e `opencode` passam a ser **adaptadores finos**: apenas
  `resolveDeps()`, `getClient()` (baseUrl/modelos/defaultHeaders) e a composição da
  factory — **sem** corpo de `generateStory`/`moderateText`/`moderateImage` duplicado.
- **SC-002** A **orquestração única** vive em `provider-core` como uma factory
  (`createChatCompletionsProvider(deps)`) que devolve o objeto que implementa
  `StoryGenerationProvider`.
- **SC-003** **Behavior-preserving**: nenhuma mudança de semântica, modelo, prompt,
  timeout, retry, capabilidades ou tratamento de erro. Interface pública e routing
  intactos; os testes existentes dos dois adapters continuam verdes **sem alteração de
  expectativa** (paridade garantida).
- **SC-004** Não há **nenhum** corpo de orquestração duplicado entre os adapters (grep de
  `parseChatJson`/`moderateText`/`moderateImage` retorna ocorrências **apenas** em
  `provider-core/`), e a feature `008` permanece intacta (não é revertida nem re-escrita).
- **SC-005** Todos os gates verdes no diff final: `pnpm lint`, `pnpm format:check`,
  `pnpm typecheck` e `pnpm test`.

## Out of Scope (ainda que parecido)

- **Não** reescrever `fixed-dev-provider.ts` (fake dev, ~395 linhas) — fora do escopo.
- **Não** consolidar os providers de TTS (`story-read-aloud/server`) — pequena duplicação
  análoga, mas separada; registrar apenas como follow-up.
- **Não** consolidar imagem em `create-opencode-illustration.ts` vs OpenRouter, além de
  reutilizar o que `provider-core/image-client.ts` já expõe — só se o diff o permitir
  sem risco; caso contrário, registrar como follow-up.
- **Não** alterar `provider-routing.ts`, o contrato OpenAPI, nem a interface
  `StoryGenerationProvider`.

## User Stories

- **US1 — Factory única**: Como desenvolvedor, quero que a orquestração de
  chat-completions (story + moderação) exista **uma vez só** em `provider-core`, para
  que os adapters sejam finos e não possam divergir silenciosamente.
- **US2 — Adapters finos**: Como mantenedor, quero que `openrouter` e `opencode`
  contenham apenas a configuração (baseUrl, modelos, defaultHeaders) e a composição da
  factory, para reduzir a superfície de duplicação.
- **US3 — Paridade garantida**: Como integrador, quero que os testes existentes dos
  dois adapters continuem verdes **sem modificação de expectativa**, provando que o
  refactor é behavior-preserving.

## Tasks (resumo — detalhe e IDs completos em `tasks.md`)

- **Phase 1 (Setup)** — `T001`–`T003`: baseline verde, branch ativa, `feature.json` alinhado.
- **Phase 2 (Factory — US1)** — `T010`–`T013`: criar `create-chat-provider.ts` (verbatim),
  exportar via barrel, teste novo que falha-antes/passa-depois.
- **Phase 3 (Adapters finos — US2)** — `T020`–`T023`: refatorar `openrouter`/`opencode`
  para compor a factory; comportamento de imagem por decisão (`T022`).
- **Phase 4 (Verificação — US3)** — `T030`–`T035`: prova de ausência de duplicação,
  remoção de dead code, ADR/review, gates finais pós-edição, restauração do `feature.json`.

> Os IDs em `tasks.md` usam numeração esparsa por faixa de fase (T0xx/T1xx/…); não há
> `T004`–`T009`/`T014`–`T019`/`T024`–`T029` — consulte `tasks.md` para a lista definitiva.

## ADR

- [ADR-0010 — Provider orchestration factory](../../docs/adr/adr-0010-provider-orchestration-factory.md)

## Applied Patches

- Nenhum até a primeira convergência.
