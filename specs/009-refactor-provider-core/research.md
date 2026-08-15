# Pesquisa — Núcleo Comum dos Adapters de Provider

**Phase 0 output** | 2026-08-14

## Objetivo

Confirmar, com evidência no código, o escopo exato da duplicação que fundamenta o `spec.md`. Não é
necessária pesquisa externa de mercado/tecnologia — é uma auditoria interna de código.

## Evidência coletada (via grep/diff no repositório)

### A) Duplicação de texto/moderação entre os dois adapters de provider

Arquivos:
- `src/features/story-generation/server/openrouter-story-generation-provider.ts` (350 linhas)
- `src/features/story-generation/server/opencode-story-generation-provider.ts` (231 linhas)

Símbolos presentes de forma byte-idêntica/estruturalmente idêntica nos DOIS arquivos:
- `const sceneCandidateSchema = z.object({...})` (linha 49 em ambos)
- `const storyCandidateSchema = z.object({...})` (linha 55)
- `const moderationSchema = z.object({...})` (linha 59)
- `parseChatJson(...)` — idêntico
- `NARRATIVE_SYSTEM_PROMPT` + `narrativeUserPrompt(input)` — idênticos (diff vazio)
- `MODERATION_SYSTEM_PROMPT` — idêntico
- `moderate(...)` — idêntico
- `toProviderError(...)` — idêntico

**O que diverge** (deve permanecer por provider): `DEFAULT_BASE_URL`, `DEFAULT_TIMEOUT_MS`,
`OpenRouterDeps`/`OpenCodeDeps`, `resolveDeps` (env key `OPENROUTER_API_KEY` vs `OPENCODE_GO_API_KEY`;
OpenRouter adiciona `imageModel` via `modelWithoutProviderPrefix` e `imageEncoder`), construção do
cliente OpenAI (OpenCode in-lines no `createOpenCodeStoryProvider`; OpenRouter usa `buildChatClient`).

### B) Duplicação de transporte de imagem `/images`

- `createOpenRouterIllustration` (dentro do provider openrouter, ~linhas 288-311+) — usa `toWebPBuffer`
  + `isWebP` + `defaultImageEncoder` + `IMAGE_TIMEOUT_MS`
- `createOpenCodeIllustration` em `create-opencode-illustration.ts` (~122 linhas) — usa
  `defaultImageEncoder(bytes, mediaType)` com fallback de sharp + `resolveDeps` + `IMAGE_TIMEOUT_MS`

**Comum byte-idêntico**: corpo do POST `{ model, prompt, n:1, output_format:"webp",
aspect_ratio:"1:1" }`, headers `Authorization: Bearer` + `Content-Type`, parsing de resposta
(`data[].b64_json` / `data[].url` / `media_type`), tratamento de `!response.ok` e timeout via
AbortController.

**Diverge**: seam de encoding WebP (OpenRouter injeta `imageEncoder`; OpenCode tem encoder interno
com fallback de sharp) e base URL.

### C) `image-optimizer.ts` órfão — e guarda de tamanho ausente em produção

- `src/features/story-generation/server/image-optimizer.ts` define `optimizeImageBytes`,
  `defaultSharpEncoder` (resize + webp com lazy `sharp`), `WEBP_DATA_URI_PREFIX`,
  `DEFAULT_MAX_DATA_URI_LENGTH` (4 MiB), `DEFAULT_MAX_DIMENSION` (1024).
- **Confirmado órfão em produção**: `optimizeImageBytes`/`DEFAULT_MAX_DATA_URI_LENGTH` não são
  importados por NENHUM arquivo de `src/` (grep). Só o próprio módulo e `tests/unit/image-optimizer.test.ts`
  o referenciam (além de um re-uso distinto de `WEBP_DATA_URI_PREFIX` no `build-story-pdf.tsx` do
  cliente de export).
- **Consequência**: a guarda de 4 MiB por data-URI é exercida apenas em teste, NÃO no runtime real de
  geração. Os adapters de ilustração atuais retornam bytes sem limite aplicado. Integrar o
  `image-client.ts` ao `image-optimizer.ts` no novo núcleo fecha essa lacuna.
- Testado por `tests/unit/image-optimizer.test.ts`.

### D) Consumidor / roteamento

- `generation-runtime.ts` é o ÚNICO consumidor real dos seeds: roteia por
  `route.provider === "opencode-go" ? createOpenCodeStoryProvider : createOpenRouterStoryProvider` e
  idem para as ilustrações `createOpenCodeIllustration`/`createOpenRouterIllustration`. Não muda o
  contrato — apenas o que os adapters importam.

### E) Testes existentes (baseline a manter verde)

- `tests/unit/openrouter-story-generation-provider.test.ts`
- `tests/unit/opencode-story-generation-provider.test.ts`
- `tests/unit/opencode-illustration.test.ts`
- `tests/unit/illustration-concurrency.test.ts`
- `tests/unit/image-optimizer.test.ts`
- demais: `provider-routing.test.ts`, `provider-pipeline.test.ts`, `agents/*`, `generation-runtime`
  etc.

## Conclusão

A duplicação é real e localizada. Estimativa de linhas compartilháveis entre os dois adapters de
texto/moderação: ~60–70% do volume de helpers. O transporte `/images` está duplicado de forma
byte-idêntica. `image-optimizer.ts` é um candidato canônico que deve ser integrado ao novo cliente
de imagem (ou consolidado/removido se provado redundante). Nenhuma mudança de contrato/env/prompt é
necessária ou desejada.
