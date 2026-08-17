---

description: "Task list for the deterministic fake content catalog generated with the real provider"
---

# Tasks: Catálogo fake de histórias e ilustrações gerado pelo provider real

**Input**: Design documents from `/specs/012-fake-content-catalog/`

**Prerequisites**: plan.md (required), spec.md (required for user stories). **Confirmação do
usuário** para a Fase 1 (grid 42 = 36 + 6 `generic`, captura de ilustrações, custo/risco de API) — a captura
**nunca** roda sem env real presente (`*.env.local` com `PLANNER_MODEL`/`WRITER_MODEL`/
`MODERATOR_MODEL`/`ILLUSTRATOR_MODEL` e chaves).

**Tests**: TDD obrigatório (constitution/AGENTS.md); testes novos usam **apenas fixtures
commitadas** — nenhum teste chama AI real; cobertura ≥80% total, gates de
safety/validation/orchestration intactos.

**Organization**: Tasks por user story (US1–US4) + fases 0–4 do plan. A captura é a única fase
com custo externo; as demais são determinísticas e rodam em qualquer ambiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências incompletas)
- **[Story]**: US1..US4 conforme spec.md
- Incluir caminhos exatos de arquivos

## Path Conventions

- **Single project (Next.js)**: `src/`, `tests/`, `scripts/` na raiz do repositório
- Área-alvo: `scripts/`, `tests/fixtures/story-generation/fake-content/`,
  `src/features/story-generation/server/`, `tests/unit/`

---

## Phase 0: Ferramenta de captura (sem rede) — US4

**Purpose**: Entregar o script parametrizável e validar o plano de captura **antes** de gastar API.

- [x] T001 [US4] Criar `scripts/generate-fake-content.ts` (server-only, `#!/usr/bin/env` node-run
  via `tsx`): grid default 6 temas × 2 locais × counts [3,4,5]; flags `--dry-run`, `--limit`,
  `--locales`, `--themes`, `--counts`; lê env via `getEnv()` (sem novos `NEXT_PUBLIC_*`)
- [x] T002 [US4] Em modo `--dry-run`: imprimir plano (combinações, estimativa de peso por cena
  com sharp 512×512 q70 `/ 60 KB`, total `/ 8 MB`) e validar o shape de saída do runtime real com
  Zod (sem chamar provider); exit 0 limpo
- [x] T003 [P] [US4] Adicionar `README.md` em `tests/fixtures/story-generation/fake-content/`
  (formato do fixture, como rodar dry-run/captura, budgets); `quickstart.md` no spec 012 apontando
  para o script

**Checkpoint**: `node scripts/generate-fake-content.ts --dry-run` imprime o grid e não faz rede.

---

## Phase 1: Captura com provider real (autorizada na clarificação) — US1 + US2

**Purpose**: Gerar o catálogo (uma rodada). **Requer env real + ok do usuário.** NUNCA em CI
(FR-008: falha explícita se `process.env.CI`).

- [x] T004 [US1] No script: instanciar o runtime real (`generation-runtime.ts` — planner/writer/
  moderator/illustrator com `*_MODEL` do env), paralelismo ~3, timeouts respeitados; cada
  narrativa validada pelo Moderator real — rejeição ⇒ **descarta** (não grava) + contabiliza;
  recidiva ⇒ aborta com resumo
- [x] T005 [US2] Antes de gravar: verificar **anonimato** (sem nomes próprios/identificadores/
  template markers/`unsafecontent`); re-comprimir ilustrações com sharp (512×512 WebP q70, budget
  por cena 60 KB, total 8 MB) e auditar pesos (falha se estourar)
- [x] T006 [US1][US2] Gravar fixtures `{theme}-{locale}-{sceneCount}.json` com shape do FR-002
  (story + illustrations + meta: model, capturedAt, sha256) — grid 36 + 6 `generic` (42; prompts
  neutros nas capturas genéricas)

**Checkpoint**: 42 fixtures commitadas (36 + 6 `generic`); commit dedicado
(`:sparkles: feat(story-generation): add fake content catalog fixtures`).

---

## Phase 2: Integração no runtime fake — US1 + US2 + US3

**Purpose**: Fazer o fake resolver o catálogo com fallback (contrato de saída inalterado).

- [x] T007 [P] [US1] Criar `src/features/story-generation/server/fake-content-catalog.ts`: loader
  com `fs` puro + validação Zod do shape FR-002 + cache de módulo; chave `(locale, theme,
  sceneCount)` + resolução **virtual `generic`** para temas fora do catálogo; leitura tolerante (fixture ausente/corrompida ⇒ `null` + `console.warn` server-only)
- [x] T008 [US1][US3] Em `fixed-dev-provider.ts` (`createFixedDevProvider.generateStory`): lookup
  no loader; fallback **neutro de qualidade**: tema fora do catálogo → fixture `generic` → builder
  genérico manual (substituir `?? THEME_PT.courage`/`?? THEME_EN.courage` — tema desconhecido nunca
  exibe conteúdo de outro tema)
- [x] T009 [US2][US3] Em `fixed-dev-provider.ts` (`createFixedDevIllustration`): receber
  `(locale, theme, sceneCount, sceneIndex)` e devolver a ilustração da cena do catálogo; fallback
  em cadeia: ilustração `generic` → builder genérico → `FIXED_ILLUSTRATION_DATA_URI`

**Checkpoint**: fake mode em `pnpm dev` exibe histórias/ilustrações do catálogo para o grid e o
comportamento antigo para o resto.

---

## Phase 3: Testes — US1 + US2 + US3 + US4

**Purpose**: Cobrir variedade, paridade, anonimato, fallback, budget e determinismo.

- [x] T010 [P] [US1] `tests/unit/fake-content-catalog.test.tsx`: farrapo (variedade por tema —
  títulos/corpos distintos; 3/4/5 cenas corretos; pt-BR ≠ en; determinismo — duas leituras
  idênticas)
- [x] T011 [P] [US2] Mesmo arquivo: `illustrations.length === scenes.length`; data-URI WebP
  válida; budget por cena ≤ 60 KB e total ≤ 8 MB
- [x] T012 [P] [US3] Fallsbacks: tema fora do grid ⇒ fixture `generic` (e, se ausente, builder
  genérico manual — política B); fixture ausente/corrompida ⇒ `null` (provider usa builder
  neutro/`FIXED_ILLUSTRATION_DATA_URI`) sem throw
- [x] T013 [P] [US1][US2] Anonimato: varredura das fixtures com os detectores existentes
  (template markers, `unsafecontent`, padrões de nome próprio) — zero ocorrências
- [x] T014 [US4] `--dry-run`/`--limit` testados via execução do script (spawn node) sem env de
  provider: plano impresso, nenhuma rede

**Checkpoint**: suíte completa (`pnpm test`) verde — 650+ testes, com os novos.

---

## Phase 4: Gates finais (após a ÚLTIMA edição) — Definition of Done

**Purpose**: Rodar todos os gates depois da última edição; resultados anteriores são STALE
(AGENTS.md) e não contam.

- [x] T015 [P] `pnpm lint` (0 warnings) e `pnpm typecheck` (strict, sem `any`)
- [x] T016 [P] `pnpm format:check` sem drift — `pnpm format` em/após TODOS os arquivos
  novos/editados (inclui `.md` do spec e fixtures JSON)
- [x] T017 [P] `pnpm test` verde e `pnpm build` passando
- [x] T018 Revisar diff final: rotas HTTP/contrato/backend/privacidade **intocados**; peso de
  fixtures dentro do orçamento; estado git limpo na branch `012-fake-content-catalog`

**Definition of Done**: catálogo 42 (36 + 6 `generic`) no grid com ilustração por cena; fake
  determinístico com fallback **neutro de qualidade** via `generic` (temas novos nunca exibem outro
  tema); testes de variedade/paridade/anonimato/
budget verdes; gates re-rodados após a última edição; commit com gitmoji + Conventional Commits (ex.:
`:sparkles: feat(story-generation): fake content catalog from real provider` +
`:sparkles: feat(story-generation): add fake content catalog fixtures`).