# Implementation Plan: Geração multi-provedor (OpenCode + OpenRouter)

**Branch**: `005-multi-provider-generation` | **Date**: 2026-08-20 | **Spec**: [specs/005-multi-provider-generation/spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-multi-provider-generation/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Reestruturar o adapter de geração de histórias para **dois provedores simultâneos** por **roteamento de capacidade**: **OpenCode** para texto e moderação, **OpenRouter** para imagens. Uma única chamada de geração roteia cada capacidade ao provedor correto e serve a história completa, sem que o usuário perceba o roteamento.

O core é **estrutural** (US1, P1): hoje `createGenerationRuntime` usa um único `createOpenRouterStoryProvider()` que faz texto, moderação e imagem (via `OpenRouterDeps`). A mudança introduz um **roteador por capacidade** que deriva o provedor de cada `*_MODEL` pela convenção `provedor/resto` (primeiro segmento antes da 1ª `/`), com default por capacidade (texto/moderação→OpenCode, imagem→OpenRouter). O env migra para o **novo esquema por capacidade** (`OPENROUTER_API_KEY`, `OPENCODE_GO_API_KEY`, `TEXT_MODEL`, `IMAGE_MODEL`, `MODERATION_MODEL`), removendo o esquema antigo `OPENROUTER_*` (decisão D5-C: **somente novo esquema**, breaking change controlado). TTS/voice permanece em OpenRouter (feature `004-ai-natural-tts`) e não faz parte deste roteamento de tradução de imagem/texto.

Todos os invariantes se mantêm: anonimato (cada provedor recebe só o payload da sua capacidade, sem identificador; server-only), sem história parcial (erro tipado por capacidade, nunca série de ilustrações parcial), `STORIES_TEST_MODE=fake` e budgets de performance vigentes.

## Technical Context

**Language/Version**: TypeScript estrito (strict), Node.js 22 (runtime server), React 19, Next.js 16 (App Router)

**Primary Dependencies**: OpenAI SDK (ponto OpenRouter via `baseUrl`), `sharp` (transcode WebP das ilustrações, server-only/lazy), `zod` (validação de env e de candidatos estruturados), OpenCode provider via `TEXT_MODEL`/`MODERATION_MODEL`

**Storage**: N/A — sem novas entidades persistentes. Histórias e ilustrações seguem o contrato atual (em memória/transientes; zero persistência adicional)

**Testing**: Vitest (unit, contrato/env, pipeline com fakes determinísticos), Storybook + a11y, Playwright E2E e visual, budgets de performance (enforced em CI). Testes nunca chamam AI real; provider fake determinístico

**Target Platform**: `node` (server), browser (Next.js SSR/client); rotedores e provedores ficam em módulos `server-only`

**Project Type**: web-service (Next.js App Router) com camada sever-side de provedores

**Performance Goals**: geração completa ≤120 s end-to-end (texto + moderação + N imagens, N≤5); JS inicial ≤250 KiB gzip (sem impacto do roteamento); navegador de cena ≤100 ms p75

**Constraints**: sem identificador direto no payload/log/provedor (ânima); sever-only para chaves/provedores; image-optimizer mantém lazy `sharp`; rate limiting por provedor (default 10 req/60 s, `RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS`); remoção de `OPENROUTER_*` sem fallback (D5-C)

**Scale/Scope**: projeto pessoal não-comercial; roteamento de capacidade (texto, moderação, imagem) em um único adapter de geração

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Code Quality**: sem `any` em código de produção novo (aprovado/justificado); zero warnings de lint. → Sem novos `any`; usar tipos estritos para routing e erros. ✅
- **Testing Standards**: test-first (failing test → confirmar razão → implementar → refatorar). → Contrato/env, routing e pseudo de provedores escritos primeiro. ✅
- **UX Consistency**: roteamento dual não muda a experiência do usuário final; cada provedor entrega só sua capacidade. → Sem mudança de UX; provado por fakes em E2E determinístico. ✅
- **Performance Requirements**: budgets vigentes (≤120 s geração, ≤250 KiB JS inicial). → Roteamento não adiciona payload nem latência ao fluxo crítico. ✅
- **Privacy (constitution + AGENTS)**: nenhum identificador; server-only; sem persistência extra. → Cada capacidade envia só o payload anônimo; verificado por teste de privacidade por capacidade. ✅

*Nenhuma violação identificada na fase de design; sem entradas extra em Complexity Tracking.*

## Project Structure

### Documentation (this feature)

```text
specs/005-multi-provider-generation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── features/
│   └── story-generation/
│       └── server/
│           ├── story-generation-provider.ts       # Interface base (tipos, ProviderError, Scene schema)
│           ├── provider-routing.ts                # Novo: deriva provedor+modelo por capacidade a partir de *MODEL (FR-002/D2)
│           ├── opencode-story-generation-provider.ts  # Novo: texto + moderação via OpenCode
│           ├── openrouter-story-generation-provider.ts # Ajustado: imagem via OpenRouter (texto/moderacao movidos p/ OpenCode)
│           ├── create-opencode-illustration.ts    # se fará sentido conforme contrato (imagem OpenRouter mantém caminho atual)
│           ├── generation-runtime.ts              # Ajustado: monta runtime com roteador dual (US1)
│           ├── generate-story.ts                  # orquestração (inalterado no cliente da capacidade)
│           ├── safety-pipeline.ts                 # moderação (usa provider de moderação roteado)
│           ├── image-optimizer.ts                 # lazy sharp (inalterado)
│           ├── fixed-dev-provider.ts              # fake determinístico (US1/D4; mantém seletor STORIES_TEST_MODE)
│           └── schemas.ts                         # validação zod dos candidatos (inalterado)
├── lib/
│   └── env.ts                                     # Novo schema por capacidade + remoção OPENROUTER_* (FR-008)

tests/
├── unit/            # provider-routing.test.ts, env.test.ts (novo schema), opencode-provider.test.ts
├── contract/        # story-generation.openapi.yaml atualizado (capacidade dual)
└── e2e/             # fluxo dual determinístico com fakes (US1, US3)
```

**Structure Decision**: Mantém a estrutura em feature-branch atual (`src/features/story-generation/server/`). O roteador por capacidade (`provider-routing.ts`) é um módulo novo e puro (testável de forma determinística); os provedores OpenCode (novo) e OpenRouter (ajustado) continuam atrás da interface `StoryGenerationProvider`/by-capability (`ProviderError` com `kind`), preservando o contrato de segurança (server-only, sem história parcial).

## Complexity Tracking

> *Sob esta seção apenas se o Constitution Check apontar violações justificadas.*

Nenhuma violação de Constitution Check na fase de design. O roteador por capacidade é uma peça única e testável; não justifica multi-pacote. (Sem preenchimento.)
