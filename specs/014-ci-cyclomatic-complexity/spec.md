# 014 — Reduzir a complexidade ciclomática do código

| | |
|---|---|
| **Feature branch** | `014-ci-cyclomatic-complexity` |
| **Criado** | 2026-08-17 |
| **Status** | Draft |
| **Input** | `012-fake-content-catalog` |

## Summary

Reduzir a **complexidade ciclomática** das funções que hoje ultrapassam um limiar saudável,
para evoluir o guard-rail de qualidade adicionado nesta mesma branch de `max: 16` para
`max: 10` **sem quebrar o CI**. O gate atual (`complexity: ["error", { max: 16 }]` no
`eslint.config.mjs`) já foi adicionado como fundamento (commit `d3660e3`); esta feature é a
**redução propriamente dita**, com uma refatoração **preservadora de comportamento** por
arquivo — seguindo **test-first** (Constitution Principle II) e priorizando as funções de
**segurança** (cobertura ≥90% em CI) e os adapters de provider.

## Problem Statement

O gate ESLint em `16` (guard-rail já commitado) tolera funções com complexidade muito alta.
Medindo a base inteira com o limiar desejado de `10`, **17 funções em produção/scripts + 2 em
arquivos de teste** ultrapassam — incluindo duas de **segurança crítica** (`ipv4IsPrivate` com
15 e `isSafeImageUrl` com 11, ambas em `provider-core/url-safety.ts`), três `resolveDeps`
duplicados nos adapters de provider, funções de agente (`planStory` 11, `writeStory` 13,
`moderateStory` 11), as rotas `POST` de `api/stories` (12) e `api/narrate` (11), `parseFlags`
(11 em `scripts/generate-fake-content.ts`) e dois arquivos de teste. O backlog de diagnóstico
listava apenas 11; a medição real no lint revelou as 8 adicionais.

Funções com alta complexidade são um risco de manutenção e de segurança: mais caminhos de
retorno/erro aumentam a chance de uma ramificação não testada, de um caso não coberto
(por exemplo, um endereço IP loopback ou RFC1918 que escapa de `ipv4IsPrivate`) e de
divergência silenciosa entre os adapters. Baixar o limiar para `10` **antes** de reduzir quebraria
o CI; por isso a ordem é: reduzir → só então afrouxar o gate.

## Clarifications

### Session 2026-08-17

- Q: Esta feature deve misturar-se com a redução de duplicação de orquestração do spec 013?
  A: **Não** — o `013-refactor-provider-orchestration` já foi convergido (factory única) e é
  independente. A redução de complexidade é uma feature própria (esta `014`), como recomendado no
  backlog de diagnóstico.
- Q: O limiar do ESLint deve ser abaixado já?
  A: **Não.** O gate fica em `16` durante toda a redução. O limiar só muda para `10` no fim
  (última task, pós-redução), quando **todas** as funções da feature estiverem ≤10 — para não
  quebrar o CI no meio do caminho.
- Q: A refatoração das funções de segurança (`ipv4IsPrivate`, `isSafeImageUrl`, `postImages`)
  muda o comportamento de segurança?
  A: **Não** — é refatoração **preservadora de comportamento**. Nenhuma semântica, lista de
  blocos de rede, mensagem de erro ou cache de resolução muda; apenas a estrutura interna (extrair
  helper/ramificação para diminuir a complexidade medida, mantendo a cobertura de testes de
  segurança). Mudança de comportamento nesse módulo seria uma violação de DoD.
- Q: O escopo medido com o limiar em 10 mostra **17 funções em produção/scripts + 2 em testes**, enquanto o backlog documentava **11** — qual escopo a feature cobre?
  A: **Escopo real (Option B)** — todas as **17+2**. O backlog estava incompleto: faltavam
  `planStory` (11), `writeStory` (13), `moderateStory` (11), as rotas `POST` de `stories` (12) e
  `narrate` (11), `parseFlags` (11 em `scripts/generate-fake-content.ts`) e os 2 arquivos de teste
  (`provider-fixtures.ts` arrow 16 e o `deepMerge` local de `i18n-localized-catalog.test.ts` 12).
  Como o gate ESLint roda sobre o repositório inteiro (`pnpm lint` inclui `tests/`), o
  `max: 10` só fica verde se **todas** as 19 violações forem tratadas. Spec, plan, tasks e SC
  foram atualizados para o escopo real.

## Success Criteria

- **SC-001** Todas as **19 violações** (17 funções em produção/scripts + 2 em arquivos de teste)
  ficam com complexidade **≤ 10** (medição via ESLint sobre a base inteira — que inclui
  `tests/`), sem reduzir a cobertura de testes existente.
- **SC-002** As funções de **segurança crítica** (`ipv4IsPrivate`, `isSafeImageUrl`,
  `postImages`) mantêm **cobertura ≥90%** e o conjunto de segurança (`safety/validation/
  orchestration`) continua verde após a refatoração, sem perda de casos de rede.
- **SC-003** **Behavior-preserving**: nenhuma mudança de semântica, modelo, prompt, timeout,
  retry, lista de blocos de rede ou tratamento de erro. Os testes existentes das funções
  refatoradas continuam verdes **sem alteração de expectativa** (prova por teste novo
  fail-before/pass-after por arquivo, test-first).
- **SC-004** Gate evolui para `complexity: ["error", { max: 10 }]` no `eslint.config.mjs`
  **somente ao final**, e `pnpm lint` permanece **0 warnings** (sem exceções `eslint-disable`).
- **SC-005** Todos os gates verdes no diff final: `pnpm lint`, `pnpm format:check`,
  `pnpm typecheck` e `pnpm test`.

## Out of Scope (ainda que parecido)

- **Não** reescrever a orquestração de provider (spec 013 já convergido) nem os prompts/schemas.
- **Não** mudar comportamento de segurança, contratos OpenAPI, interface pública ou routing.
- **Não** abaixar o limiar de `16` para `10` antes do fim da redução.
- **Não** trocar o guard-rail por outro threshold por função (sem exceções no ESLint).
- **Não** tocar em funções que já estão ≤10 (a medição não altera código estável sem necessidade).

## User Stories

- **US1 — Segurança em primeiro lugar**: Como mantenedor, quero reduzir a complexidade das
  funções de segurança (`ipv4IsPrivate`/`isSafeImageUrl` em `url-safety.ts`, `postImages` em
  `image-client.ts` e `moderateOneCandidate`/`moderateCandidate` na safety-pipeline) com
  cobertura ≥90% preservada, para minimizar o risco de uma ramificação de rede ou de moderação
  não testada escapar.
- **US2 — Adapters/providers com leitura de env limpa**: Como mantenedor, quero extrair um
  helper de leitura de env por campo nos três `resolveDeps` (openrouter/opencode/tts), para
  reduzir complexidade e a duplicação do padrão de `getEnv()`/fallback.
- **US3 — UI e i18n estáveis**: Como desenvolvedor de UI, quero simplificar `Progress` (13),
  `Select` (11) e `deepMerge` (12) **sem** alterar a aparência, o comportamento de acessibilidade
  nem as mensagens traduzidas.
- **US4 — Agentes com decisões mais simples**: Como mantenedor, quero reduzir a complexidade de
  `planStory` (11), `writeStory` (13) e `moderateStory` (11) nos agentes de planejamento, escrita
  e moderação, preservando prompts, esquemas e comportamento de geração.
- **US5 — Rotas de API e script enxutos**: Como mantenedor, quero reduzir `POST` de
  `api/stories` (12) e `api/narrate` (11) e `parseFlags` (11 no script) sem alterar contratos,
  validação, `Cache-Control` ou mensagens de erro.
- **US6 — Gate saudável**: Como mantenedor, quero evoluir o guard-rail ESLint para `max: 10`
  com `pnpm lint` em 0 warnings no fim (incluindo `tests/`), garantindo que novas funções não
  reintroduzam complexidade alta.

## Tasks (resumo — detalhe e IDs completos em `tasks.md`)

- **Phase 1 (Setup)** — `T001`–`T003`: baseline verde, branch ativa, `feature.json` alinhado.
- **Phase 2 (Segurança — US1)** — `T010`–`T014`: `ipv4IsPrivate`, `isSafeImageUrl`, `postImages`
  e as duas funções da safety-pipeline (`moderateOneCandidate`, `moderateCandidate`) test-first
  (fail-before/pass-after), cobertura ≥90% preservada.
- **Phase 3 (Adapters — US2)** — `T020`–`T022`: os três `resolveDeps` via helper de env.
- **Phase 4 (UI/i18n — US3)** — `T030`–`T032`: `Progress`, `Select`, `deepMerge`.
- **Phase 5 (Agentes — US4)** — `T040`–`T042`: `planStory`, `writeStory`, `moderateStory`.
- **Phase 6 (Rotas + script — US5)** — `T050`–`T052`: `POST` de `stories`, `POST` de `narrate`,
  `parseFlags`.
- **Phase 7 (Testes — cobertura do lint de `tests/`)** — `T060`–`T061`: arrow em
  `provider-fixtures.ts` e `deepMerge` local de `i18n-localized-catalog.test.ts`.
- **Phase 8 (Gate — US6 & Verificação)** — `T070`–`T074`: abaixar limiar para 10, gates
  completos, ADR/review, restauração do `feature.json`.

> Os IDs em `tasks.md` usam numeração esparsa **por faixa de fase** (Phase 1: T00x; Phase 2:
> T01x; Phase 3: T02x; Phase 4: T03x; Phase 5: T04x; Phase 6: T05x; Phase 7: T06x; Phase 8:
> T07x) para permitir inserção sem renumerar. Consulte `tasks.md` (fonte canônica) para a lista
> definitiva de IDs e a correspondência exata por função.

## ADR

- (pendente — ver plan.md; ADR-0011 a criar na convergência)

## Applied Patches

- `eslint.config.mjs` — guard-rail `complexity: ["error", { max: 16 }]` + comentário (commit `d3660e3`).
- Nenhuma redução aplicada até a primeira convergência.
