# Plano de Implementação: Núcleo Comum dos Adapters de Provider

**Branch**: `008-refactor-provider-core` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Especificação de recurso de `/specs/008-refactor-provider-core/spec.md`

## Summary

Refatoração **preservadora de comportamento** da camada de adapters de geração de histórias que
elimina a duplicação verificada entre os adapters de provider e consolida o transporte de imagem,
sem nenhuma mudança funcional, de env, de contrato ou de UX.

Três objetivos:

1. **US1 (P1)** — extrair para `server/provider-core/` os helpers byte-idênticos partilhados por
   `openrouter-story-generation-provider.ts` e `opencode-story-generation-provider.ts`: schemas Zod,
   `parseChatJson`, prompts de sistema, moderação e `toProviderError`. Cada adapter vira um thin
   shell que mantém só a parte específica do provider.
2. **US2 (P2)** — extrair o transporte `/images` compartilhado entre
   `createOpenRouterIllustration` e `createOpenCodeIllustration` em um cliente núcleo de imagem, e
   consolidar o encoding/guarda de WebP em `image-optimizer.ts` (que hoje está órfão).
3. **US3 (P3)** — higiene do `generation-runtime.ts`, reuso de fixtures em `fixed-dev-provider.ts` e
   validação final dos gates na árvore suja + documentação.

## Decisões de clarificação

- **Decisão-1**: Formato do trabalho é **Spec Kit** (usuario optou por "formato spec"); fluxo
  `specify → plan → tasks → implement`, com commits por unidade lógica e gates finais pós-edição.
- **Decisão-2**: Escopo informado ao usuário foi o "plano completo 1–3" proposto na análise (itens 1,
  2 e a higiene 3); o usuário validou seguir o formato spec, mantendo os três objetivos.
- **Decisão-3**: Os prompts duplicados (`NARRATIVE_SYSTEM_PROMPT`/`MODERATION_SYSTEM_PROMPT` e
  `narrativeUserPrompt`) são tratados como **baseline canônico**: a extração os move preservando o
  texto atual (diff vazio antes de consolidar); não se "melhora" prompt no mesmo commit. **Regra de
  conflito (A10)**: se, ao extrair, um prompt diferir entre os dois adapters, registrar o drift no
  `reviews.md`, conservar a versão efetivamente em uso em runtime e NÃO mesclar automaticamente —
  decisão explícita separada.
- **Decisão-4**: Interface pública (`StoryGenerationProvider`, `provider-routing`, `env.ts`,
  `generate-story`, OpenAPI) **não muda**. Nenhum novo identificador/front; fronteira `server-only`
  mantida.

## Technical Context

**Language/Version**: TypeScript estrito (Next.js 16 / React 19 / App Router), `pnpm` workspace.

**Primary Dependencies**: OpenAI-compatible SDK (`openai`), `sharp` (lazy, encoding WebP), `zod`
(validação de boundary), `server-only`.

**Storage**: N/A — não há persistência; ilustrações são data-URIs em memória, nunca escritas em
disco (ADR/T026).

**Testing**: Vitest (unit/contract/pipeline) com `STORIES_TEST_MODE=fake` + fixtures determinísticas;
Playwright E2E e visual fora do escopo desta refatoração (sem mudança de UI); Storybook não tocado.

**Target Platform**: Server (bordas server-only) — adapters e cliente de imagem executam no
servidor, nunca no cliente.

**Project Type**: Web app (Next.js) — refatoração interna server-side.

**Performance Goals**: Nenhuma mudança de objetivo; sem impacto em LCP/bundles. Reduzir peso de
manutenção (linhas duplicadas) sem afetar latência.

**Constraints**: Sem regressão funcional; diff vazio nos prompts e no corpo do POST `/images`;
preservar `timeoutMs`/`maxRetries` (texto 60 s, imagem 120 s) e os seams injetáveis de teste
(`fetchImpl`, encoder).

**Scale/Scope**: ~5 arquivos de origem na camada de geração + testes co-localizados. Escopo
limitado a `story-generation/server`; não toca em `story-export`, `story-request` nem `story-reader`
exceto se um re-export de constante pura for claramente seguro (avaliar em US2).

## Constitution Check

*GATE: deve passar antes da Fase 0 de pesquisa. Re-checar após a Fase 1 de design.*

> **Pós-design (Phase 1)**: re-avalido após data-model/contracts/quickstart. Nenhuma mudança de
> arquitetura além do agrupamento `provider-core/`; contrato público congelado (documentado em
> `contracts/provider-interface.md`). GATES: lint/format/typecheck/cobertura seguem definidos em
> FR-007/SC-003/SC-004. **Status permanece PASS.**

Avaliação contra `.specify/memory/constitution.md` v1.1.0:

- **Code Quality**: refatoração reduz duplicação -> atende. Sem `any` novo (strict) -> atende.
- **Testing Standards**: test-first exigido; testes existentes são o baseline a manter verde; novos
  testes (se necessário) escritos antes e confirmados a falhar -> atende.
- **User Experience**: sem mudança intencional de UX -> atende (não regressivo).
- **Performance**: sem impacto; lazy `sharp` mantido -> atende.

**Status: PASS**. Nenhuma violação que exija autorização de complexidade.

## Project Structure

### Documentation (this feature)

```text
specs/008-refactor-provider-core/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── reviews.md
├── checklists/requirements.md
└── contracts/
    └── provider-interface.md   # contrato público congelado (NÃO muda)
```

### Source Code (repository root)

Layout alvo pós-refatoração (feature-based, `src/features/...`):

```text
src/features/story-generation/server/
├── provider-core/
│   ├── index.ts               # barrel público do núcleo
│   ├── schemas.ts             # sceneCandidateSchema, storyCandidateSchema, moderationSchema
│   ├── chat-json.ts           # parseChatJson
│   ├── prompts.ts             # NARRATIVE_SYSTEM_PROMPT, narrativeUserPrompt, MODERATION_SYSTEM_PROMPT
│   ├── moderation.ts          # moderate(...)
│   ├── provider-errors.ts     # toProviderError
│   └── image-client.ts        # postImages({baseUrl, apiKey, imageModel, prompt, timeoutMs, fetchImpl}) -> {bytes, mediaType}; + WebP normalize (re-usa image-optimizer)
├── openrouter-story-generation-provider.ts   # thin shell (texto+moderação+imagem delegando)
├── opencode-story-generation-provider.ts     # thin shell
├── create-opencode-illustration.ts           # thin shell delegando ao image-client
├── image-optimizer.ts                        # canonical (size guard, resize) — consumido pelo image-client
├── generation-runtime.ts                     # consumidor único (ajuste de imports apenas)
├── provider-routing.ts                       # NÃO MUDA
├── story-generation-provider.ts              # NÃO MUDA (ProviderError/base types mantidos como fonte de verdade)
└── ... (generate-story.ts, safety-pipeline.ts, schemas.ts do orchestrador, agents/)
```

**Structure Decision**: Extração em um subpacote `provider-core/` coeso (não um arquivo único), pois
os helpers pertencem a domínios distintos (schemas vs prompts vs transporte) e isso mantém a
separação de responsabilidades do projeto (`provider/` núcleo reutilizável; adapters são shells
finos). `ProviderError` e tipos base continuam em `story-generation-provider.ts` para não acoplar o
núcleo ao contrato de um provider específico. Este é o caminho mais simples e alinhado à estrutura
de features existente; nenhuma violação de complexidade.

## Complexity Tracking

> Nenhuma violação. (Categoria de complexidade: nenhuma camada/abstração além das já existentes;
> `provider-core/` é um agrupamento, não uma arquitetura nova.)

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
