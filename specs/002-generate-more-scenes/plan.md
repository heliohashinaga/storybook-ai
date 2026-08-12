# Implementation Plan: Gerar mais cenas (contagem variável 3–5)

**Branch**: `002-generate-more-scenes` | **Date**: 2026-08-12 | **Spec**: [`specs/002-generate-more-scenes/spec.md`](spec.md)

**Input**: Feature specification from `specs/002-generate-more-scenes/spec.md`

## Summary

Esta entrega introduz **contagem de cenas variável (3, 4 ou 5)** na geração de histórias, tornando a extensão prevista em `001` uma capacidade efetiva para o usuário: o responsável escolhe, antes de gerar, quantas cenas a história terá, por meio de um controle acessível e localizado no formulário, com padrão **3** (comportamento de v1 preservado).

O escopo é estritamente a capacidade de contagem variável e o impacto decorrente no contrato (novo campo numérico anônimo de requisição), na orquestração/segurança (validação por `sceneCount`, nenhum conjunto parcial de cenas tratado como sucesso; a parametrização de tempo por contagem permanece **adiada** — FR-008), e na UI/UX (controle no formulário, leitor e exportação refletindo a contagem real). **NÃO** introduz cadastro, persistência, coleta de identificadores ou mudança de anonimato.

**Abordagem técnica**: reutiliza a arquitetura estabelecida em `001` — schema `sceneCountSchema` (3–5, padrão 3) como fonte única de verdade no servidor, passado via `ProviderStoryInput`, propagado por safety-pipeline (`expectedCount`), orquestrador, e contratos; o reader/exportação já iteram sobre `story.scenes` dinamicamente, então apenas precisam validar/garantir a contagem real. O contrato `story-generation.openapi.yaml` ganha o campo `sceneCount`.

## Technical Context

**Linguagem/Plataforma**: TypeScript strict, Next.js 16 (App Router) + React 19, Node.js 22 LTS. Extensão da stack já estabelecida em `001`; nenhum "NEEDS CLARIFICATION" — stack e padrões definidos (ADR do projeto, ex. ADR 0003 single-locale).

**Dependências primárias**: Zod (validação em duas camadas), next-intl (pt-BR/en), Tailwind v4 (tokens semânticos). Provider server-only: OpenRouter adapter (produção) / fixed-dev-provider determinístico (testes/e2e). `@react-pdf/renderer` lazy-importado (fora do bundle inicial).

**Storage**: N/A — sem banco, cookies, localStorage ou cache durável; apenas estado React em memória. `Cache-Control: no-store` na rota `POST /api/stories`.

**Testes**: Vitest (unit/integration) + contrato (valida contra `story-generation.openapi.yaml`) + Playwright (E2E, a11y, visual, performance) + Storybook test-runner (a11y por story). Determinísticos, com fixtures/providers fakes — nunca chamada a IA live.

**Target Platform**: Web (browser) — Next.js full-stack single app; pt-BR padrão + en.

**Project Type**: Web application (Next.js App Router), componente full-stack.

**Performance Goals**: geração ≤120s end-to-end (teto único para todas as contagens; granularidade por contagem é decidida em implementação **apenas se a medição real exigir** — não pré-dimensionada); bundle inicial ≤250 KiB gzip (lazy import PDF); LCP ≤2.5s p75; navegação de cena ≤100ms p75.

**Constraints**: permite apenas `sceneCount` inteiro 3–5; **FR-008 é genérico** — timing por contagem é adiado até medição real, sem escala especulativa; `Cache-Control: no-store`; nenhum identificador direto em payloads/logs/provedores; AA contrast/keyboard/reduced-motion; a11y por leitura de tela. **Controle de cenas**: grupo de campos (radio group) com `role="radiogroup"`, três opções visíveis (3/4/5) e navegação nativa por teclas de seta (decisão clarificada em 2026-08-12).

**Scale/Scope**: geração de 3/4/5 cenas por história; faixa estrita 3–5 (acima disso fora de escopo).

## Constitution Check

*GATE: aprovado antes da Phase 0. Re-checado após a Phase 1.*

- **Code Quality (PASS)**: TS strict sem `any`; lint/format via scripts existentes; módulos pequenos; sem dead code. O ponto de extensão (`sceneCountSchema`/constantes) continua centralizado em `schemas.ts` — única fonte de verdade.
- **Testing Standards (PASS)**: test-first; testes determinísticos com fixtures/fakes; cada componente novo/alterado com `.stories.tsx` (default/edge/error) + a11y; atualização dos testes de contrato quando o contrato muda; nunca chamada a IA live.
- **User Experience (PASS)**: controle acessível e localizado; a11y AA; foco visível/keyboard; `prefers-reduced-motion`; `aria-live`/`aria-busy` nas transições; terminologia consistente ("Cena X de Y" refletindo a contagem real).
- **Performance (PASS)**: nunca conjunto parcial é tratado como sucesso; lazy import do PDF; budgets CI mantidos verdes (gestão de tempo por contagem adiada a medição real — FR-008).
- **Privacy/Anon (PASS)**: novo campo é apenas a contagem inteira anônima; nenhum identificador adicional em payloads/logs/provedores; `Cache-Control: no-store` preservado (FR-007, SC-003).

**Gates**: sem violações. Todas as mudanças preservam os invariantes do produto; a única nova superfície é um campo numérico anônimo e seu reflexo em UI/UX.

## Project Structure

### Documentation (this feature)

```text
specs/002-generate-more-scenes/
├── plan.md              # Este arquivo (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
# Opção: Aplicação web única (Next.js App Router) — estende a estrutura de 001
src/
├── features/
│   ├── story-request/
│   │   ├── client/
│   │   │   └── story-preferences-schema.ts      # sceneCount: 3–5, valores e validação cliente
│   │   ├── components/
│   │   │   ├── story-request-form.tsx           # controle de cenas (radio group 3/4/5, padrão 3)
│   │   │   └── story-request-form.stories.tsx   # estados default/edge/error + a11y
│   │   └── locales/
│   │       ├── pt-BR.json                       # rótulos do controle (label + opções)
│   │       └── en.json
│   ├── story-generation/
│   │   └── server/
│   │       ├── schemas.ts                       # sceneCountSchema (MIN/MAX/DEFAULT), source of truth
│   │       ├── story-generation-provider.ts     # ProviderStoryInput + sceneCount (0..max p/ tipo)
│   │       ├── safety-pipeline.ts               # expectedCount no candidate
│   │       ├── generate-story.ts                # validação por sceneCount; nunca conjunto parcial
│   │       ├── generation-runtime.ts
│   │       ├── openrouter-story-generation-provider.ts  # prompt parametrizado por sceneCount
│   │       ├── image-optimizer.ts
│   │       └── fixed-dev-provider.ts            # fake determinístico com contagem variável
│   ├── story-reader/
│   │   ├── client/
│   │   │   └── story-response.ts                # valida 3–5 cenas (min/max)
│   │   └── components/
│   │       ├── story-reader.tsx                 # usa scenes.length (já dinâmico), valida >3
│   │       ├── scene-view.tsx
│   │       └── ...
│   └── story-export/
│       └── client/
│           ├── build-story-pdf.tsx              # inclui todas as cenas na ordem (sem truncar)
│           └── export-story-button.tsx
├── app/
│   └── api/stories/
│       └── route.ts                             # aceita + re-valida sceneCount (contrato)
└── components/ui/
    ├── select.tsx                                # primitiva existente (outros controles do form)
    └── radio.tsx                                 # NOVA primitiva de radio group p/ o controle de cenas (role="radiogroup")

tests/
├── unit/                                        # schemas, provider, safety, generate, fixtures
├── contract/                                    # story-generation.openapi + stories-route
├── integration/                                 # provider-pipeline (contagens variáveis)
└── e2e/                                         # fluxos pt-BR + EN
```

**Structure Decision**: Aplicação web única (Next.js App Router), reutilizando a estrutura por feature de `001`. Nenhuma nova pasta de raiz — o `sceneCount` atravessa o mesmo caminho já existente (cliente schema → route → provider → safety → orquestrador → resposta). O reader/exportação são atualizados apenas para validar/garantir a contagem real (sem truncar).

## Phase 0: Outlines & Research (research.md)

Sem "NEEDS CLARIFICATION" pendentes — stack e escopo definidos no spec (faixa 3–5, padrão 3, validação em duas camadas, retrocompatibilidade). A pesquisa consolida as decisões técnicas:

- **Contagem variável e arquitetura**: confirmar o caminho de `sceneCount` (cliente → contrato → provider → safety → orquestrador → resposta) e o uso das constantes `MIN/MAX/DEFAULT_SCENE_COUNT` como fonte única de verdade, substituindo o `N_SCENES` fixo como ponto de extensão já documentado. Solução de 001 preservada sem nova abstração.
- **Custo de tempo da contagem (FR-008, sem escala especulativa)**: registrar que o custo de 4–5 cenas é `desconhecido` para este produto; definir que a implementação verifica se 4–5 cenas cabem no teto ≤120s e **não adiciona lógica de escala de timeout/retry por contagem antes de medição**; janelas de retry permanecem as existentes, com a invariante de nunca sucesso parcial.
- **Reader/exportação dinâmicos**: confirmar que `story-reader.tsx` e `build-story-pdf.tsx` iteram sobre `story.scenes` (já dinâmico via `scenes.length`), e catalogar os pontos que assumem "3" (ex. terminologia/testes) que precisam refletir a contagem real.
- **Estratégia de validação**: esquema `sceneCountSchema` (int 3–5, default 3), validação cliente (erro rápido localizado) + servidor (contrato, 400/422), correção de contratos e testes-fake por contagem.

## Phase 1: Design & Contracts (data-model.md, contracts/, quickstart.md)

- **data-model.md**: entidade `Scene Count / Duração` (inteiro anônimo 3–5, padrão 3, validado em duas camadas) e sua relação com `Story`/`Scene`/`Illustration`; estados do formulário e do reader com contagem variável; regras de validação herdadas do `FR-001..010`.
- **contracts/**: atualizar `story-generation.openapi.yaml` — campo `sceneCount` (integer 3–5, default 3, optional) na requisição `generateStory`; resposta mantém modelo sequencial por `ordinal` com `minItems`/`maxItems` 3–5; manter `Cache-Control: no-store`. Atualizar `tests/contract/` correspondente.
- **quickstart.md**: validação end-to-end de histórico de 3, 4 e 5 cenas (PT-BR e EN) sobre o fluxo estabelecido — seleção, geração, leitura "Cena X de Y", e exportação sem truncamento — usando provider fake determinístico; budgets e a11y.
