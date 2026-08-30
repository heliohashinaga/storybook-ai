# Plano de Implementação: Consolidação da Orquestração dos Adapters de Provider

**Branch**: `013-refactor-provider-orchestration` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Especificação de recurso de `/specs/013-refactor-provider-orchestration/spec.md`

## Summary

Refatoração **preservadora de comportamento** que elimina a última fatia de duplicação deixada
pelo `008-refactor-provider-core`: a **camada de orquestração** dos dois adapters
OpenAI-compatíveis (`openrouter` e `opencode`). O `008` consolidou as primitivas de baixo nível
(`parseChatJson`, `moderate`, schemas, prompts, `toProviderError`) em `provider-core/`, mas os
métodos `generateStory()`, `moderateText()` e `moderateImage()` continuam **idênticos byte a byte**
nos dois adapters — exatamente o que esta feature resolve.

Três user stories de qualidade (US1-US3), todas preservadoras de comportamento:

1. **US1 (P1)** — extrair para `provider-core/` uma **factory única** de orquestração
   (`createChatCompletionsProvider(deps)`) que encapsula o fluxo inteiro
   `chat.completions.create → parseChatJson → storyCandidateSchema.parse → toProviderError`
   e os wrappers de moderação (`moderateText`/`moderateImage` delegando a `moderate()`).
2. **US2 (P2)** — transformar `openrouter` e `opencode` em **adapters finos**: só `getClient()`
   (baseUrl/modelos/defaultHeaders) e a composição da factory — sem corpo de orquestração.
3. **US3 (P3)** — provar paridade: os testes existentes dos dois adapters continuam verdes **sem
   mudança de expectativa**, e nenhum corpo duplicado sobrevive fora do `provider-core`.

## Decisões de clarificação

- **Decisão-1**: Formato do trabalho é **Spec Kit** (usuário optou por "criar uma nova branch e um
  speckit"); fluxo `specify → plan → tasks → implement`, com commits por unidade lógica e gates
  finais pós-edição.
- **Decisão-2**: Esta feature **complementa** o `008`, não o duplica nem o reverte. O `008` está
  convergido (35/35 tasks naquela especificação) e sua extração de baixo nível é o **baseline**
  desta feature. A factory de orquestração é o passo seguinte não coberto pelo `008`.
- **Decisão-3**: A factory recebe o **client via lazy getter** — `getClient: () => OpenAI`
  (função de zero argumentos, invocada na primeira operação) + modelos (`textModel`, `moderationModel`),
  devolvendo um objeto que implementa `StoryGenerationProvider` nas capacidades text+moderation.
  A construção do client (`getClient()` com `baseUrl`/`defaultHeaders`/app-identity) **permanece em
  cada adapter** — a factory não conhece `defaultHeaders` nem builda o client. Isso preserva a
  invariante de que **importar/criar o provider nunca exige env de provedor** (as api keys são
  validadas via `getEnv()` apenas no primeiro request real — ver Clarifications Session 2026-08-17).
  **Não** move prompt/defaultHeaders para a factory a menos que sejam idênticos entre os dois — se
  houver drift, registrar no `reviews.md` e conservar.
- **Decisão-4**: Interface pública (`StoryGenerationProvider`, `provider-routing`, `env.ts`,
  `generate-story`, OpenAPI) **não muda**. Nenhum novo identificador/front; fronteira `server-only`
  mantida. A geração de ilustrações (openrouter `/images` vs opencode) **fica de fora** desta
  feature — reutilizar `image-client.ts` apenas se o diff for trivial (mudança mecânica, sem
alteração de comportamento, ≤ ~15 linhas e coberta por teste existente); caso contrário, registrar
  como follow-up.

## Technical Context

**Language/Version**: TypeScript estrito (Next.js 16 / React 19 / App Router), `pnpm` workspace.

**Primary Dependencies**: OpenAI-compatible SDK (`openai`), `zod` (validação de boundary),
`server-only`.

**Storage**: N/A — não há persistência; não há mudança de armazenamento.

**Testing**: Vitest (unit/contract). Os testes existentes dos dois adapters
(`tests/unit/` — `openrouter`/`opencode`) são o baseline a manter verde **sem modificar
expectativas**. Playwright E2E/visual **fora do escopo** (nenhuma mudança de UI).

## Design

### Alvo: factory de orquestração em `provider-core`

Novo módulo (ex.: `provider-core/create-chat-provider.ts`), coberto por barrel no
`provider-core/index.ts`:

```ts
export interface ChatCompletionsProviderDeps {
  getClient: () => OpenAI;        // lazy getter passado pelo adapter; invocado na 1ª operação
  textModel: string;
  moderationModel: string;
}

export function createChatCompletionsProvider(deps: ChatCompletionsProviderDeps): {
  generateStory(input: ProviderStoryInput): Promise<GeneratedStoryCandidate>;
  moderateText(text: string): Promise<ModerationDecision>;
  moderateImage(prompt: string): Promise<ModerationDecision>;
}
```

- `generateStory`: reproduz **exatamente** o corpo atual dos dois adapters —
  `deps.getClient().chat.completions.create(...)` com `NARRATIVE_SYSTEM_PROMPT`/`narrativeUserPrompt`/
  `response_format: json_object` → `parseChatJson` → `storyCandidateSchema.parse` → catch
  `ZodError`/`ProviderError` → `toProviderError`. Sem mudança de semântica.
- `moderateText`/`moderateImage`: delega a `moderate(deps.getClient(), deps.moderationModel, …)`
  idêntico ao que os dois adapters já fazem.

### Resultado esperado nos adapters

- `openrouter-story-generation-provider.ts`: mantém `resolveDeps()`, `getClient()`
  (baseUrl + `defaultHeaders: OPENROUTER_APP_HEADERS`/app-identity) e a **composição**:
  `createChatCompletionsProvider({ getClient, textModel, moderationModel })`.
- `opencode-story-generation-provider.ts`: idêntico, sem `defaultHeaders` (como hoje).

## Phases

- **Phase 1 — Setup**: baseline verde registrado; feature.json apontando para `013`.
- **Phase 2 — Factory**: criar `provider-core/create-chat-provider.ts` + barrel, com o corpo de
  orquestração movido dos adapters **verbatim**; teste novo da factory (obrigatório, fail-before/
  pass-after, fixtures dos adapters como paridade) ANTES e a falhar (ver Clarifications Session 2026-08-17).
- **Phase 3 — Adapters finos**: trocar os dois adapters para composição da factory.
- **Phase 4 — Verificação**: gates completos + grep de prova de ausência de duplicação.

## ADR

- [ADR-0010 — Provider orchestration factory](../../docs/adr/0010-provider-orchestration-factory.md)

## Applied Patches

- Nenhum até a primeira convergência.
