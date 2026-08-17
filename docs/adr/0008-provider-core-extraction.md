# ADR 0008 — Extração de núcleo comum dos adapters de provider

- Status: Accepted
- Decisores: manutenção do `storybook-ai`
- Data: 2026-08-15
- Contextos relacionados: feature `008-refactor-provider-core` (US1/US2); ADR 0005 (geração de
  ilustrações com concorrência limitada).

## Contexto

Os adapters de geração de histórias (`openrouter-story-generation-provider.ts` e
`opencode-story-generation-provider.ts`) compartilhavam **helpers byte-idênticos** — schemas Zod de
candidatos, parse de JSON de chat, prompts de sistema (`NARRATIVE_SYSTEM_PROMPT`,
`narrativeUserPrompt`, `MODERATION_SYSTEM_PROMPT`), função de moderação e mapeamento de erro. O
transporte de ilustração `/images` também era duplicado entre `createOpenRouterIllustration` e
`createOpenCodeIllustration` (corpo POST e parsing de resposta idênticos, divergindo apenas no seam
de encoding WebP). Além disso, `image-optimizer.ts` (`optimizeImageBytes`) estava **órfão** em
produção: não era importado por nenhum caller, embora a guarda de tamanho de data-URI (4 MiB)
estivesse, na prática, implementada de forma independente em `agents/illustrator.ts`
(`maxIllustrationDataUriLength`). Duplicação desse tipo cria risco real de divergência: qualquer
correção de prompt/schema/parse precisaria ser replicada em dois lugares.

## Decisão

1. **Extrair um núcleo comum** `src/features/story-generation/server/provider-core/` com
   `schemas.ts`, `prompts.ts`, `chat-json.ts`, `provider-errors.ts`, `moderation.ts`, `image-client.ts`
   (transporte `/images` compartilhado) e barrel `index.ts` — todos `server-only`, sem estado e sem
   dados persistentes.
2. **Adaptadores viram thin shells**: cada provider mantém apenas a configuração específica (deps,
   env key, base URL, timeout, construção do cliente SDK) e importa os helpers do núcleo.
3. **Un-orphan do `image-optimizer`**: o `image-client.ts` passa a usar `optimizeImageBytes` /
   `WEBP_DATA_URI_PREFIX`, com fallback ao data-URI não-conservado quando o optimizador rejeita
   (mantendo o contrato do orquestrador; a guarda de 4 MiB do `illustrator.ts` continua valendo).
4. **Preservar comportamento**: prompts e schemas movidos sem alteração de conteúdo (baseline
   canônico); contratos públicos (`StoryGenerationProvider`, factories, `provider-routing`, `env.ts`,
   `story-generation-provider.ts`) intocados.

## Consequências

- Elimina ~58% da duplicação nos adapters (openrouter 350→168 linhas; opencode 231→120;
  `create-opencode-illustration` 125→60).
- Ajuste futuro de prompt/schema/parse em **um único lugar** (`provider-core/`).
- `image-optimizer.ts` deixa de ser código-morto.
- Risco de regressão mitigado por baseline de testes (535 testes verdes com fixtures inalteradas).

## Alternativas consideradas (rejeitadas)

- **Manter a duplicação**: mantém o risco de divergência; rejeitado.
- **Mover tudo para um único arquivo**: dificulta manutenção e fronteiras; rejeitado em favor de um
  subpacote coeso por domínio.
- **Remover/ignorar `image-optimizer`**: perderia o código canônico testado; rejeitado em favor de
  un-orphan via `image-client.ts`.
