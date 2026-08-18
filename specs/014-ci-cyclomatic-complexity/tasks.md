---
description: "Lista de tarefas para implementação do recurso"
---

# Tasks: Redução da Complexidade Ciclomática

**Input**: Documentos de design de `/specs/014-ci-cyclomatic-complexity/`

**Prerequisites**: plan.md (obrigatório), spec.md (obrigatório; user stories US1-US6)

**Tests**: Testes existentes de segurança/adapters/UI são o baseline a manter verde **sem
alterar expectativas**; cada arquivo refatorado ganha um teste novo fail-before/pass-after
escrito ANTES e confirmado a FALHAR (test-first, Constitution Principle II). `pnpm
test:coverage:check` (≥90% segurança/validation/orchestration) é gate obrigatório.

**Organization**: Tarefas agrupadas por user story (US1-US6), com a Phase 2 (Segurança)
bloqueando a evolução do gate em US6. Feature **preservadora de comportamento** — nenhuma
mudança de semântica, contrato, prompt, timeout, retry, lista de blocos de rede, mensagem de
erro ou cache.

> **Numeração esparsa por fase (intencional):** cada Phase reserva uma faixa de IDs
> (Phase 1: T00x; Phase 2: T01x; Phase 3: T02x; Phase 4: T03x; Phase 5: T04x; Phase 6: T05x;
> Phase 7: T06x; Phase 8: T07x). O gap é proposital para permitir inserção sem renumerar.
> Consulte esta lista definitiva (e não o resumo do `spec.md`) como fonte canônica de IDs.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar o contexto da redução e proteger o baseline.

- [X] T001 Confirmar que a branch `014-ci-cyclomatic-complexity` está ativa e limpa (git status
  limpo; guard-rail e backlog commitados), a partir do base post-rebase sobre `origin/main`.
- [X] T002 Rodar o baseline de qualidade na árvore atual (antes de qualquer edição): `pnpm lint`,
  `pnpm format:check`, `pnpm typecheck`, `pnpm test` e `pnpm test:coverage:check` — registrar o
  resultado e listar as **19 violações** (17 funções em produção/scripts + 2 em arquivos de
  teste) com suas complexidades atuais (medição via ESLint com limiar 10) como referência para
  comparar após a redução (SC-003).
- [X] T003 Verificar que `.specify/feature.json` aponta para `specs/014-ci-cyclomatic-complexity`
  (atualizar se necessário; registrar o valor anterior para restauração ao final).

**Checkpoint**: Árvore verde no baseline; branch 014 ativa; as 19 violações alvo documentadas.

---

## Phase 2: Segurança (US1)

**Purpose**: Reduzir a complexidade das **5 funções de segurança** com cobertura ≥90%
**preservada** e sem nenhuma mudança de semântica de rede/moderação.

**⚠️ CRITICAL**: Nenhuma dessas funções pode ter comportamento alterado. Cada uma exige um teste
novo fail-before/pass-after que fixe o output complexo (por exemplo, o conjunto completo de
endereços que `ipv4IsPrivate` deve bloquear).

- [X] T010 (US1) `ipv4IsPrivate` (15) em `provider-core/url-safety.ts`: escrever teste
  fail-before que cubra todas as faixas (loopback, RFC1918, link-local, multicast, reservado,
  class E, IPv6 embutido). Reduzir a complexidade extraindo helpers de ramificação por bloco,
  preservando base-ip/prefixo lógicos. Confirmar ≤10 e cobertura ≥90%. Confirmar que o teste
  passou-após e que os testes existentes de URL-safety seguem verdes sem alteração.
- [X] T011 (US1) `isSafeImageUrl` (11) em `provider-core/url-safety.ts`: teste fail-before que
  cubra protocolos (http/https/data), host, redirect `Location` e blocos de rede. Extrair guardas
  nomeadas de protocolo/host/bloco. Confirmar ≤10, cobertura ≥90% e testes existentes verdes.
- [X] T012 (US1) `postImages` (15) em `provider-core/image-client.ts`: teste fail-before que fixe
  parse de resposta/erro/timeout. Extrair etapas de parse/erro em helpers. Confirmar ≤10,
  cobertura ≥90% e sem mudança de tempo de request nem mensagens de erro.
- [X] T013 (US1) `moderateOneCandidate` (12) em `features/story-generation/server/safety-pipeline.ts`: teste fail-before que fixe os
  caminhos de decisão de moderação (safe/unsafe/erro). Decompor decisão em helpers. Confirmar ≤10
  e que a semântica de moderação/regeneração permanece intacta.
- [X] T014 (US1) `moderateCandidate` (12) em `features/story-generation/server/safety-pipeline.ts`: idêntico ao T013, decompor os
  caminhos de decisão. Confirmar ≤10 e comportamento de moderação preservado.

**Checkpoint**: As 5 funções de segurança ≤10, cobertas e behavior-preserving; cobertura global
de segurança ainda ≥90%.

---

## Phase 3: Adapters/Providers (US2)

**Purpose**: Extrair um **helper de leitura de env por campo** para os três `resolveDeps`,
reduzindo complexidade e a duplicação do padrão `getEnv()`/fallback.

- [X] T020 (US2) `resolveDeps` (16) em `openrouter-story-generation-provider.ts`: extrair helper
  de leitura de env por campo (`readEnvField`/equivalent) no mesmo padrão dos dois providers e do
  tts. Teste fail-before/pass-after que fixe fallbacks e erros de env. Confirmar ≤10 e nenhuma
  mudança de env keys, defaults ou validação.
- [X] T021 (US2) `resolveDeps` (13) em `opencode-story-generation-provider.ts`: reutilizar o mesmo
  helper, mantendo as env keys específicas do opencode (sem `defaultHeaders`). Confirmar ≤10 e
  paridade de comportamento.
- [X] T022 (US2) `resolveDeps` (13) em `story-read-aloud/server/openrouter-tts-provider.ts`:
  reutilizar o mesmo helper com as env keys de TTS. Confirmar ≤10 e paridade. Se houver drift de
  env keys entre os três, NÃO mesclar artificialmente — registrar no `reviews.md` e conservar.

**Checkpoint**: Os três `resolveDeps` ≤10, com leitura de env por campo sem duplicação.

---

## Phase 4: UI/i18n (US3)

**Purpose**: Simplificar componentes de UI e utilitário de i18n **sem** alterar aparência,
acessibilidade (AA, foco, `prefers-reduced-motion`) nem mensagens traduzidas.

- [X] T030 (US3) `Progress` (13) em `components/ui/progress.tsx`: decompor a ramificação de
  estado/animação em helpers. Confirmar ≤10 e cobertura de stories/a11y (default/edge/error)
  continua passando; Storybook `storybook:test` verde.
- [X] T031 (US3) `Select` (11) em `components/ui/select.tsx`: decompor a lógica de
  abertura/seleção/teclado em helpers. Confirmar ≤10 e navegação por teclado/foco intacta
  (a11y). `storybook:test` verde.
- [X] T032 (US3) `deepMerge` (12) em `src/i18n/config.ts`: extrair a fusão por tipo (primitivo/array/
  objeto) em helpers. Teste fail-before/pass-after que fixe fusão profunda de catálogos pt-BR/en.
  Confirmar ≤10 e nenhuma mensagem traduzida alterada.

**Checkpoint**: `Progress`, `Select`, `deepMerge` ≤10, sem regressão visual/a11y/i18n.

---

## Phase 5: Agentes (US4)

**Purpose**: Reduzir a complexidade dos agentes `planStory`, `writeStory` e `moderateStory`
**sem** alterar prompts, esquemas, modelos nem comportamento de geração.

- [X] T040 (US4) `planStory` (11) em `agents/planner.ts`: decompor as etapas de planejamento em
  helpers nomeados. Teste fail-before/pass-after que fixe o plano gerado em modo fake. Confirmar
  ≤10 e prompts/saída preservados.
- [X] T041 (US4) `writeStory` (13) em `agents/writer.ts`: decompor a geração em etapas
  (montagem de prompt, chamada, parse, pós-processamento) em helpers. Confirmar ≤10 e saída de
  geração preservada.
- [X] T042 (US4) `moderateStory` (11) em `agents/moderator.ts`: decompor o fluxo de moderação em
  helpers. Confirmar ≤10 e a semântica de moderação/regeneração (safe/unsafe) preservada.

**Checkpoint**: Agentes ≤10, behavior-preserving; nenhum prompt ou schema alterado.

---

## Phase 6: Rotas + script (US5)

**Purpose**: Enxugar as rotas `POST` e o parser de flags do script **sem** alterar contrato,
validação, `Cache-Control` ou mensagens de erro.

- [X] T050 (US5) `POST` (12) em `app/api/stories/route.ts`: extrair validação/resposta em helpers
  (mantendo Zod `.strict()` e `Cache-Control: no-store`). Teste fail-before/pass-after de contrato.
  Confirmar ≤10.
- [X] T051 (US5) `POST` (11) em `app/api/narrate/route.ts`: extrair validação/resposta em
  helpers. Confirmar ≤10 e contrato/`Cache-Control` preservados.
- [X] T052 (US5) `parseFlags` (11) em `scripts/generate-fake-content.ts`: extrair parsing/validação
  de flags em helpers. Confirmar ≤10 (script fora do bundle; apenas lint/type).

**Checkpoint**: Rotas e script ≤10, sem mudança de contrato/validação/`Cache-Control`.

---

## Phase 7: Testes (cobertura do lint de `tests/`)

**Purpose**: Como `pnpm lint` cobre `tests/`, os 2 arquivos de teste também precisam ≤10 para o
`max: 10` ficar verde. Refatoração local aos arquivos de teste — sem tocar em fakes usados
como baseline de outros testes sem necessidade.

- [X] T060 arrow (16) em `tests/fixtures/story-generation/provider-fixtures.ts`: decompor a geração
  do catálogo fake em helpers para ≤10. Confirmar que testes que consomem o fixture seguem verdes.
- [X] T061 `deepMerge` (12) local em `tests/unit/i18n-localized-catalog.test.ts`: simplificar o
  merge local do teste para ≤10 sem alterar as asserções do teste.

**Checkpoint**: `tests/` também verde sob `max: 10`; nenhum teste teve asserção alterada.

---

## Phase 8: Gate (US6) & Verificação

**Purpose**: Evoluir o limiar do ESLint para `10` **somente agora** e provar a redução completa.

- [X] T070 (US6) Confirmar que **todas as 19 violações** estão ≤10 (medição via ESLint sobre a
  base inteira, incluindo `tests/`) antes de tocar no gate.
- [X] T071 (US6) Alterar `eslint.config.mjs`: `complexity: ["error", { max: 16 }]` →
  `complexity: ["error", { max: 10 }]` (e atualizar o comentário explicativo). Rodar `pnpm lint`
  — deve ficar em **0 warnings** sem exceções `eslint-disable`.
- [X] T072 Registrar ADR-0011 (estratégia de redução + novo limiar) e documentar a convergência
  em `reviews.md`.
- [X] T073 **Gates finais pós-edição** (após a ÚLTIMA mudança de arquivo — um resultado anterior
  é STALE): `pnpm lint` (0 warnings), `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:coverage:check`. Confirmar que nenhuma mensagem/prompt/segurança foi alterada
  (grep de diffs em `url-safety`, `image-client`, safety-pipeline).
- [X] T074 Restaurar/apontar `.specify/feature.json` correto e conferir o diff final; confirmar
  que `014` é o spec ativo da branch.
