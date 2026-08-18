# Plano de Implementação: Redução da Complexidade Ciclomática

**Branch**: `014-ci-cyclomatic-complexity` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Especificação de recurso de `/specs/014-ci-cyclomatic-complexity/spec.md`

## Summary

Refatoração **preservadora de comportamento** das **19 violações** de complexidade ciclomática
(17 funções em produção/scripts + 2 em arquivos de teste) que hoje ultrapassam o limiar saudável
(≤10), para evoluir o guard-rail ESLint de `max: 16` para `max: 10` **sem quebrar o CI**. O
guard-rail em 16 já foi adicionado nesta branch (commit `d3660e3`); esta feature é a redução
propriamente dita, priorizando **segurança** (cobertura ≥90% em CI), depois adapters de provider,
UI/i18n, agentes, rotas, script e finalizando com os arquivos de teste.

Seis user stories de qualidade:

1. **US1 (P1)** — reduzir as **5 funções de segurança**: `ipv4IsPrivate` (15) e
   `isSafeImageUrl` (11) em `provider-core/url-safety.ts`, `postImages` (15) em
   `provider-core/image-client.ts`, e `moderateOneCandidate` (12) / `moderateCandidate` (12)
   na safety-pipeline — com cobertura ≥90% **preservada** e nenhuma mudança de semântica de rede.
2. **US2 (P2)** — extrair um **helper de leitura de env por campo** para os três `resolveDeps`
   (16 em `openrouter`, 13 em `opencode`, 13 em `openrouter-tts`), reduzindo complexidade e a
   duplicação do padrão `getEnv()`/fallback.
3. **US3 (P3)** — simplificar `Progress` (13), `Select` (11) e `deepMerge` (12) **sem** alterar
   aparência, acessibilidade ou mensagens traduzidas.
4. **US4 (P3)** — reduzir a complexidade dos agentes `planStory` (11), `writeStory` (13) e
   `moderateStory` (11), preservando prompts, esquemas e comportamento de geração.
5. **US5 (P3)** — enxugar as rotas `POST` de `api/stories` (12) e `api/narrate` (11) e o
   `parseFlags` (11) do script, sem alterar contratos, validação ou `Cache-Control`.
6. **US6 (P4)** — evoluir o guard-rail ESLint para `max: 10` **somente ao final**, com `pnpm
   lint` em 0 warnings **incluindo `tests/`** (os 2 arquivos de teste também precisam ≤10).

## Decisões de clarificação

- **Decisão-1**: Formato do trabalho é **Spec Kit**; fluxo `specify → plan → tasks → implement`,
  com commits por unidade lógica e gates finais pós-edição.
- **Decisão-2**: Esta feature é **independente** do spec 013 (já convergido) — nenhuma mistura
  com a orquestração de provider.
- **Decisão-3**: O limiar do ESLint fica em **16 durante toda a redução** e só muda para **10 na
  última task**, quando todas as **19 violações** (17 produção/scripts + 2 testes) estiverem ≤10
  — para não quebrar o CI no meio.
- **Decisão-4**: Refatoração **preservadora de comportamento** — sem mudança de semântica,
  modelo, prompt, timeout, retry, lista de blocos de rede, mensagem de erro ou cache de
  resolução. Testes existentes verdes **sem alteração de expectativa**; cada arquivo ganha um
  teste novo fail-before/pass-after (test-first, Constitution Principle II) provando a paridade.

## Technical Context

**Language/Version**: TypeScript estrito (Next.js 16 / React 19 / App Router), `pnpm` workspace.

**Primary Dependencies**: `eslint` (regra `complexity`), `zod`, `server-only`. Vitest para os
testes de paridade.

**Storage**: N/A — não há persistência.

**Testing**: Vitest (unit). Testes existentes de segurança/URL-safety/adapters são o baseline a
manter verde **sem modificar expectativas**; testes novos fail-before/pass-after por arquivo.
`pnpm test:coverage:check` (≥90% segurança/validation/orchestration) é gate obrigatório.

## Design

### Alvo por categoria (19 violações, medição real do ESLint com limiar 10)

| Cat | Função | Comp. | Arquivo | Estratégia |
| --- | ------ | ----- | ------- | ---------- |
| Segurança | `ipv4IsPrivate` | 15 | `provider-core/url-safety.ts` | Extrair helper de bloco/ramificação por faixa; manter base-ip/prefixo lógicos intactos |
| Segurança | `isSafeImageUrl` | 11 | `provider-core/url-safety.ts` | Extrair guardas de protocolo/host/bloco em helpers nomeados |
| Segurança | `postImages` | 15 | `provider-core/image-client.ts` | Extrair etapa de parse/erro/resposta em helpers |
| Segurança | `moderateOneCandidate` | 12 | `features/story-generation/server/safety-pipeline.ts` | Extrair caminhos de decisão de moderação |
| Segurança | `moderateCandidate` | 12 | `features/story-generation/server/safety-pipeline.ts` | Idem, decompor decisão em helpers |
| Provider | `resolveDeps` (openrouter) | 16 | `openrouter-story-generation-provider.ts` | Helper de leitura de env por campo |
| Provider | `resolveDeps` (opencode) | 13 | `opencode-story-generation-provider.ts` | Reutilizar mesmo helper |
| Provider | `resolveDeps` (tts) | 13 | `openrouter-tts-provider.ts` | Reutilizar mesmo helper |
| UI | `Progress` | 13 | `components/ui/progress.tsx` | Decompor ramificação de estado/animação |
| UI | `Select` | 11 | `components/ui/select.tsx` | Decompor lógica de abertura/seleção |
| i18n | `deepMerge` | 12 | `src/i18n/config.ts` | Extrair fusão por tipo (primitivo/array/objeto) |
| Agente | `planStory` | 11 | `agents/planner.ts` | Decompor etapas de planejamento em helpers |
| Agente | `writeStory` | 13 | `agents/writer.ts` | Decompor geração em etapas nomeadas |
| Agente | `moderateStory` | 11 | `agents/moderator.ts` | Decompor fluxo de moderação |
| Rota | `POST` | 12 | `app/api/stories/route.ts` | Extrair validação/resposta em helpers |
| Rota | `POST` | 11 | `app/api/narrate/route.ts` | Idem, preservando contrato/`Cache-Control` |
| Script | `parseFlags` | 11 | `scripts/generate-fake-content.ts` | Extrair parsing/validação de flags |
| Teste | arrow (fake) | 16 | `tests/fixtures/story-generation/provider-fixtures.ts` | Decompor a geração do catálogo fake |
| Teste | `deepMerge` (local) | 12 | `tests/unit/i18n-localized-catalog.test.ts` | Simplificar o merge local do teste |

> **Nota**: `postImages`/`moderate*` medem **15/12** (não 11 como no backlog). O backlog listava
> apenas 11; a medição real do lint revelou 19 no total (17 produção/scripts + 2 testes).

### Preservação de comportamento (proof)

- Cada arquivo refatorado mantém os testes existentes **verdes sem mudança de expectativa** e
  ganha um teste novo fail-before/pass-after que fixa o output complexo (por exemplo, o conjunto
  completo de endereços que `ipv4IsPrivate` deve bloquear/rejeitar).
- Nenhuma alteração em prompts, modelos, timeouts, retries, `defaultHeaders`, mensagens de erro,
  cache ou lista de blocos de rede. Mudança de comportamento nesses módulos viola o DoD.

## Phases

- **Phase 1 — Setup**: baseline verde registrado; `feature.json` apontando para `014`.
- **Phase 2 — Segurança (US1)**: `ipv4IsPrivate`, `isSafeImageUrl`, `postImages`,
  `moderateOneCandidate`, `moderateCandidate` — test-first, cobertura ≥90% preservada.
- **Phase 3 — Adapters (US2)**: os três `resolveDeps` via helper de env.
- **Phase 4 — UI/i18n (US3)**: `Progress`, `Select`, `deepMerge`.
- **Phase 5 — Agentes (US4)**: `planStory`, `writeStory`, `moderateStory`.
- **Phase 6 — Rotas + script (US5)**: `POST` de `stories`, `POST` de `narrate`, `parseFlags`.
- **Phase 7 — Testes (cobertura do lint de `tests/`)**: arrow em `provider-fixtures.ts` e
  `deepMerge` local de `i18n-localized-catalog.test.ts`.
- **Phase 8 — Gate (US6) + Verificação**: abaixar limiar para `10`, gates completos pós-edição,
  ADR/review, restauração do `feature.json`.

## ADR

- (pendente — ADR-0011 a criar na convergência, documentando a estratégia de redução e o novo limiar)

## Applied Patches

- `eslint.config.mjs` — guard-rail `complexity: ["error", { max: 16 }]` (commit `d3660e3`).
- Nenhuma redução aplicada até a primeira convergência.
