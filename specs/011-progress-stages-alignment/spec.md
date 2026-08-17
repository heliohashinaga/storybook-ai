# Feature Specification: Estágios da tela de progresso alinhados ao pipeline multi-agente

**Feature Branch**: `011-progress-stages-alignment`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "os steps do processing não condizem com o fluxo de geração de história"

## Summary

A tela de progresso de geração (`StoryGenerationProgress`, §7.3 do spec 001) exibe os estágios em
uma ordem **divergente do pipeline real** executado pelo backend:

| UI atual (`GENERATION_STAGES`) | Pipeline real (`coordinator.ts`, spec 006) |
| ------------------------------ | ------------------------------------------ |
| 1. Escrevendo sua história… (stageWriting) | 1. **Planner** — define a estrutura de cenas |
| 2. Ilustrando as cenas… (stageIllustrating) | 2. **Writer** — escreve a narrativa |
| 3. Verificando a segurança… (stageReviewing) | 3. **Moderator** — gate autoritativo de segurança/tom/idade sobre a narrativa |
| | 4. **Illustrator** — gera as ilustrações das cenas aprovadas |

Dois desvios: (a) falta o estágio de **planejamento** (o Planner é o primeiro agente do pipeline) e
(b) a **ilustração aparece como 2º passo**, quando o Illustrator é o **último** estágio — o
Moderator roda **antes** das imagens, como gate sobre a narrativa escrita (confirmado na sessão de
clarificação abaixo e em `specs/006-multi-agent-story-generation/spec.md`, US 1–2).

Esta feature corrige a **ordem e a composição** dos estágios exibidos para espelhar o fluxo
**Planner → Writer → Moderator → Illustrator**, mantendo intactos o contrato HTTP/API, a fronteira
de privacidade, o backend e o comportamento dos estados especiais (`timeout`, `safety-retry`,
`provider-failure`). O componente já é **data-driven** (`GENERATION_STAGES` + labels i18n), então a
correção é estruturalmente barata: reordenar/recompor o array, adicionar a label de planejamento em
`pt-BR` e `en` e atualizar os testes/stories que fixam a matemática de tempo e a contagem de badges.

## Clarifications

### Session 2026-08-16

- Q: O Moderator vem depois do Writer? → A: **Sim.** O Moderator é o gate de segurança que **opera
  sobre a saída do Writer** (narrativa) e **antecede o Illustrator** (imagens só após aprovação) —
  cf. `coordinator.ts` ("Stage 3 — Moderator: safety gate on the Writer's narrative") e spec 006 US2
  ("sem Write antes de Plan, sem Ilustração antes de Review"). Logo a ordem exibida deve ser
  Writing → Reviewing → Illustrating.
- Q: A barra/timing usa telemetria real de estágios do servidor? → A: **Não.** O progresso é
  derivado de `elapsedSeconds` injetado, com fatias de tempo **equidistantes e determinísticas**;
  o backend não emite eventos de progresso. A correção mantém esse desenho (não há telemetria nova,
  e os timings continuam cosméticos e re-deriváveis).
- Q: O Reader entra na ordem exibida? → A: **Não.** O Reader gera áudio **sob demanda** via
  `POST /api/narrate` e está fora do caminho síncrono de sucesso (coordinator.ts); não compõe a tela
  de progresso da geração.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Progresso com a ordem real do pipeline (Priority: P1)

O responsável que aguarda a geração vê, em ordem, quatro etapas que espelham exatamente o fluxo
executado: **preparando a história** (Planner), **escrevendo a história** (Writer), **verificando
que está tudo seguro** (Moderator) e **ilustrando as cenas** (Illustrator) — em `pt-BR` e `en`. A etapa
corrente avança como antes (título adaptativo + badge destacado), e ao concluir a geração a barra
chega a 100%.

**Why this priority**: É o propósito da feature — eliminar a divergência perceptível entre o que a
UI promete e o que o pipeline faz. Entrega o valor principal (transparência do progresso) de forma
totalmente observável, com custo baixo e risco zero para o backend.

**Independent Test**: Renderizar `StoryGenerationProgress` (Storybook/story e teste unit) com
tempos no início de cada fatia (0 s, 8 s, 16 s, 24 s) e verificar: 4 badges, a ordem textual
Planner→Writer→Moderator→Illustrator nos dois idiomas e o `aria-valuenow`/título adaptativo corretos
por estágio.

**Acceptance Scenarios**:

1. **Given** uma geração em andamento no estágio 0, **When** a tela é inspecionada, **Then** o
   primeiro badge/título é "preparando" (Planner) e não "escrevendo".
2. **Given** uma geração no estágio 2, **When** a tela é inspecionada, **Then** o badge/título atual
   é "verificando que está tudo seguro" (Moderator) e o badge de ilustração ainda não está concluído.
3. **Given** uma geração no estágio 3 (último), **When** a tela é inspecionada, **Then** o
   badge/título atual é "ilustrando suas cenas", com os três anteriores marcados como concluídos.

---

### User Story 2 - Revisão de segurança antes da ilustração (Priority: P1)

A sequência exibida comunica corretamente que **as imagens são geradas por último**: a verificação
de segurança (Moderator) aparece como 3º passo e a ilustração como 4º e final — coerente com o gate
do backend, em que o Illustrator nunca recebe cenas não aprovadas.

**Why this priority**: É o segundo desvio corrigido e um princípio de segurança do projeto (o
Moderator é porta autoritativa; imagens só de cenas aprovadas — spec 006 US2). Exibir o contrário
ensina ao usuário um fluxo errado, o que esta story elimina.

**Independent Test**: Teste unit sobre a ordem do array `GENERATION_STAGES` e/story de estágio 2
verificando que o label de segurança precede o de ilustração, sem qualquer dependência do backend.

**Acceptance Scenarios**:

1. **Given** a definição canônica de estágios, **When** o array é lido, **Then**
   `stageReviewing` vem **antes** de `stageIllustrating` e `stagePlanning` é o primeiro elemento.
2. **Given** um teste/story renderizando o estágio 2, **When** os badges são enumerados, **Then** a
   ordem visual é planejar → escrever → verificar segurança → ilustrar.

---

### User Story 3 - Timings, a11y e determinismo preservados com 4 passos (Priority: P2)

A adição do 4º passo não quebra a matemática nem a acessibilidade do componente: os estágios
continuam com fatias iguais (`STEP_DURATION_SECONDS = 8` s; último passo inicia em 24 s), o
`progressbar` expõe `aria-valuemax = 3`, os badges continuam com `aria-current="step"`/labels
localizados e o comportamento com `elapsedSeconds` injetado permanece 100% determinístico em
testes.

**Why this priority**: Garante que a correção não regride qualidade (contraste/ARIA), os gates de
cobertura nem a filosofia data-driven (adicionar passo continua sendo "uma entrada no array + um
label"). Sem risco de deixar a UI fora das normas do projeto.

**Independent Test**: Suíte `test` (vitest) — casos de `getGenerationStage`/`barPercent` com 4
estágios, assertions de ARIA e badges — mais `storybook:test` (a11y) com as 4 stories
(Planning/Writing/Reviewing/Illustrating).

**Acceptance Scenarios**:

1. **Given** o componente com 4 estágios e `elapsedSeconds` variando, **When** os limites de fatia
   são exercitados (0/7/8/15/16/23/24/60 s), **Then** `getGenerationStage` mapeia exatamente 4
   estágios com clamp no fim (24+ → 3).
2. **Given** `done=false`, **When** a barra é medida, **Then** os percentuais são 0/25/50/75 por
   estágio e 100 apenas com `done=true` (nenhum 33/66 remanescente).
3. **Given** a tela em qualquer estágio, **When** um leitor de tela a acessa, **Then**
   `aria-valuemax=3`, `aria-valuenow` por estágio e labels localizados são anunciados sem regressão.

---

### User Story 4 - Regressão internacional de labels detectada (Priority: P2)

O catálogo i18n passa a conter a chave `stagePlanning` em `pt-BR` e `en`; o teste de contrato de
i18n cobre as quatro chaves de estágio, impedindo que uma tradução ausente silencie um badge.

**Why this priority**: O componente é data-driven por i18n; uma chave faltando vira título vazio
(ou fallback errado). Blindar isso no teste evita regressão futura no momento em que outro passo
for adicionado.

**Independent Test**: `tests/unit/i18n-config.test.ts` — assert de que `story.progress.stagePlanning`
(e as demais) são strings nos dois catálogos.

**Acceptance Scenarios**:

1. **Given** os catálogos `pt-BR` e `en`, **When** o teste de contrato i18n roda, **Then** as quatro
   chaves de estágio existem e são strings.
2. **Given** a renderização em qualquer idioma, **When** o 1º badge é inspecionado, **Then** ele
   exibe o texto localizado de planejamento (nunca a chave técnica).

### Edge Cases

- **Clamp no fim da linha do tempo**: `elapsedSeconds >= 24` (ou valores absurdos como 1000 s) deve
  permanecer no estágio final (índice 3) e nunca estourar o array/a barra.
- **Boundaries exatos das fatias**: 8 s/16 s/24 s pertencem ao estágio seguinte (intervalo
  `[i*8, (i+1)*8)`), evitando "pulo" ou "atraso" de badge.
- **`stepDurationSeconds` customizado** (fake mode com `3` s): os 4 passos totalizam 12 s; o
  `TIMEOUT_CUE_AT_SECONDS = 30` s continua maior que o início do último passo e continua dominando a
  mensagem de paciência.
- **Estados especiais** (`timeout`, `safety-retry`, `provider-failure`): mantêm mensagem própria e
  não exibem/alteram a ordem dos badges.
- **i18n incompleta**: se `stagePlanning` faltar em um catálogo, o teste de contrato falha (e o
  estágio deve ter fallback seguro para o primeiro estágio existente, como já faz
  `stageMessage`).
- **Ordem canônica**: o `ol` renderizado deve iterar `GENERATION_STAGES` (fonte única), sem
  reordenação hardcoded que possa divergir de novo.
- **Contrato/privacidade**: nenhuma mudança em payloads, rotas, catalogs além de
  `story.progress.stagePlanning`; a tela continua sem receber/renderizar conteúdo da história.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE expor `GENERATION_STAGES` na ordem do pipeline real:
  `stagePlanning` → `stageWriting` → `stageReviewing` → `stageIllustrating`.
- **FR-002**: O catálogo i18n (`story.progress`) DEVE conter `stagePlanning` em `pt-BR`
  ("Preparando sua história…") e `en` ("Planning your story…").
- **FR-003**: O `ol` de badges DEVE iterar `GENERATION_STAGES` (fonte única de verdade), com
  `aria-current="step"` e labels localizados por estágio.
- **FR-004**: O progressbar DEVE expor `aria-valuemax` derivado de `MAX_STAGE` (= 3) e
  `aria-valuenow = stage` calculado por `getGenerationStage` — sem valores fixos "2" remanescentes.
- **FR-005**: `getGenerationStage` DEVE manter o mapeamento de fatias iguais e clamped para 4
  estágios: `[0,8)`→0, `[8,16)`→1, `[16,24)`→2, `[24,∞)`→3.
- **FR-006**: `barPercent` DEVE re-derivar para `(i / 4) * 100` (0/25/50/75) e 100% somente com
  `done=true`.
- **FR-007**: `STEP_DURATION_SECONDS = 8` e `TIMEOUT_CUE_AT_SECONDS = 30` DEVEM permanecer
  inalterados (o último passo inicia em 24 s, abaixo do cue de timeout).
- **FR-008**: Os testes unitários (`getGenerationStage`, badges, barra, ARIA) e as stories
  (Planning/Writing/Reviewing/Illustrating) DEVEM ser atualizados para 4 estágios e passar nos
  gates do repositório (`test`, `storybook:test`, `lint`, `format:check`, `typecheck`).
- **FR-009**: O teste de contrato i18n DEVE validar que `stagePlanning` + as 3 chaves existentes são
  strings nos dois catálogos.
- **FR-010**: A mudança NÃO DEVE alterar contrato HTTP/API, payloads, logs, backend multi-agente,
  fronteira de privacidade nem os estados especiais de progresso.

### Key Entities

- **`GENERATION_STAGES`** (array de chaves i18n): fonte única da ordem dos estágios exibidos; a
  ordem do array define a ordem do `ol` e a progressão do título adaptativo.
- **`stepDuration` / `elapsedSeconds`** (parâmetros do componente): fatia de tempo por estágio e
  tempo decorrido injetado; juntos derivam o estágio atual (determinístico, sem wall-clock).
- **Labels `story.progress.stage*`**: textos localizados (`pt-BR`/`en`) exibidos nos badges e no
  título; cada estágio tem exatamente uma chave.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A ordem textual exibida (badges + título adaptativo) espelha exatamente
  Planner → Writer → Moderator → Illustrator nos dois idiomas — verificável por teste unitário e
  pelas 4 stories (Planning 0 s, Writing 8 s, Reviewing 16 s, Illustrating 24 s).
- **SC-002**: 100% dos casos de boundary de `getGenerationStage`/`barPercent` (0/7/8/15/16/23/24/60
  s e 0/25/50/75/+100) cobertos e verdes na suíte Vitest.
- **SC-003**: `pnpm lint` (0 warnings), `pnpm format:check` (sem drift), `pnpm typecheck` e
  `pnpm test` verdes após a última edição; `storybook:test` sem regressões de a11y (ARIA/contraste).
- **SC-004**: Zero mudanças no contrato da API (OpenAPI/rotas/payloads) e nos invariantes de
  privacidade; `specs/011-progress-stages-alignment/plan.md` e `tasks.md` criados no fluxo do Spec
  Kit antes da implementação.

## Assumptions

- A ordem canônica do pipeline é a do `coordinator.ts`/spec 006 (**Planner → Writer → Moderator →
  Illustrator**); o **Reader** fica fora da tela de progresso (áudio sob demanda via `/api/narrate`).
- O progresso exibido é **cosmético e determinístico** (fatias iguais por `elapsedSeconds`
  injetado); não há telemetria de estágios do servidor nem mudança nesse desenho nesta feature.
- Ilustração é o estágio final: o Illustrator gera imagens **após** a aprovação do Moderator (ADR
  0005), logo "Ilustrando" é o 4º passo, não o 2º.
- Escopo limitado a exibição/i18n/testes/stories/docs; nenhuma mudança no backend multi-agente,
  nos timings reais de geração ou em outros catálogos i18n além de `story.progress`.
- A barra/badges continuam data-driven: adicionar estágio futuro continua sendo "uma entrada no
  array + uma chave i18n" (a matéria desta feature é a prova dessa propriedade com 4 passos).