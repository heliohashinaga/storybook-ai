# 013 — Consolidar a orquestração dos adapters de geração (provider)

| | |
|---|---|
| **Feature branch** | `013-provider-orchestration` |
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

1. `openrouter` e `opencode` passam a ser **adaptadores finos**: apenas `resolveDeps()`,
   `getClient()` (baseUrl/modelos/defaultHeaders) e a composição da factory — **sem**
   corpo de `generateStory`/`moderateText`/`moderateImage` duplicado.
2. A **orquestração única** vive em `provider-core` como uma factory
   (`createChatCompletionsProvider(deps)`) que devolve o objeto que implementa
   `StoryGenerationProvider`.
3. **Behavior-preserving**: nenhuma mudança de semântica, modelo, prompt, timeout,
   retry, capabilidades ou tratamento de erro. Interface pública e routing intactos.
4. Não há **nenhum** arquivo de código duplicado no repo (sem prova nova), e a feature
   `008` permanece intacta (não é revertida nem re-escrita).
5. Todos os gates verdes: `pnpm lint`, `pnpm format:check`, `pnpm typecheck` e
   `pnpm test` (baseline de teste existente dos dois adapters garante paridade).

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

## Tasks (resumo — detalhe em `tasks.md`)

- `T001` Extrair factory `createChatCompletionsProvider` em `provider-core`.
- `T002` Refatorar `openrouter` para consumir a factory.
- `T003` Refatorar `opencode` para consumir a factory.
- `T004` Garantir que nenhum corpo duplicado sobreviva (grep de `parseChatJson`/
  `moderateText`/`moderateImage` fora do `provider-core`).
- `T005` Rodar gates completos e confirmar gates verdes no diff final.

## ADR

- [ADR-0010 — Provider orchestration factory](../../docs/adr/adr-0010-provider-orchestration-factory.md)

## Applied Patches

- Nenhum até a primeira convergência.
