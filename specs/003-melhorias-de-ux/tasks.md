# Tasks: Melhorias de UX

**Input**: Design documents from `/specs/003-melhorias-de-ux/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: The project constitution mandates test-first development, co-located `.stories.tsx` (default/edge/error) with a11y, and deterministic tests (fixtures/fakes — no live AI). Accordingly each user story includes test tasks.

**Organization**: Tasks are grouped by user story (US1–US5) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1..US5)
- Include exact file paths in descriptions

## Path Conventions

Single repo (`src/`, `tests/` at root), Next.js App Router, Vitest + Playwright + Storybook test-runner.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Nenhuma infraestrutura de inicialização é necessária — o app existe e está implementado (T033–T066 já entregues). Esta fase apenas confirma a base das melhorias.

- [x] T001 Confirm tokens semânticos e `story.catalog.theme*` / `themeDescription*` presentes em `src/features/story-request/locales/pt-BR.json` e `en.json` (base para cards de tema).
- [x] T002 Confirm script `storybook:test` (a11y wcag A/AA) e testes E2E/visual/perf verdes antes de iniciar (baseline).

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Primitivas compartilhadas necessárias por mais de uma user story.

- [x] T003 [P] Implementar primitiva de seleção visual reutilizável (cards por escolha com rótulo+descrição+estado acessível) em `src/components/ui/choice-card.tsx` com `.stories.tsx` (default/edge/erro) e a11y.
- [x] T004 [P] Adicionar testes unitários para a primitiva `ChoiceCard` em `tests/unit/choice-card.test.tsx` (seleção, foco, estado ativo, `aria-pressed`, teclado).

## Phase 3: US1 — Escolha visual de tema (P1)

**Goal**: os temas (Coragem/Amizade/Bondade; Courage/Friendship/Kindness) aparecem como escolha visual com rótulo+descrição no idioma ativo.

**Independent test**: renderizar o form em pt-BR e en; confirmar que cada tema surge como escolha visual com nome+descrição localizados e que a seleção envia somente `ageBand`/`locale`/`theme`.

- [x] T005 [P] [US1] Substituir o `<select>` de tema por `ChoiceCard` no `src/features/story-request/components/story-request-form.tsx`, usando `story.catalog.theme*`/`themeDescription*` (manter valor `courage|friendship|kindness`)
- [x] T006 [US1] Atualizar `tests/unit/story-request-form.test.tsx` para validar a seleção visual de tema (pt-BR e en) mantendo o contrato de payload anônimo
- [x] T007 [P] [US1] Atualizar/adicionar `.stories.tsx` do form (default/loading/edge) em `story-request-form.stories.tsx` cobrindo o tema visual

## Phase 4: US2 — Leitura em voz alta (P1)

**Goal**: leitura da cena atual em voz alta no idioma ativo, com controle visível (pronto/lendo) e cancelamento ao trocar de cena; sem rede.

**Independent test**: abrir história, acionar leitura, verificar estado visível/anunciado e que trocar de cena interrompe a fala anterior (mock de `speechSynthesis`).

- [x] T008 [P] [US2] Implementar hook/hook util de fala local em `src/features/story-reader/client/use-read-aloud.ts` (Web Speech `speechSynthesis`, vozes pt-BR/en, estados idle/speaking/paused — `paused` interno, sem botão dedicado — controlo único iniciar/parar, cancelar)
- [x] T009 [US2] Adicionar controle de leitura em voz alta no `src/features/story-reader/components/story-reader.tsx` (botão único iniciar/parar com `aria-pressed`/estado anunciado) e interrupção ao navegar de cena
- [x] T010 [P] [US2] Adicionar strings localizadas de leitura (iniciar/parar, estados, sem rótulo de pausa dedicado) em `src/features/story-request/locales/pt-BR.json` e `en.json` (namespace `story.reader`)
- [x] T011 [US2] Adicionar `.stories.tsx` (default/loading/edge) + teste unitário com mock de `speechSynthesis` em `tests/unit/story-reader.test.tsx`

## Phase 5: US3 — Indicador de progresso de cena (P2)

**Goal**: indicador visual da posição em relação ao total de cenas, ao lado de "Cena X de Y", estático (honra `prefers-reduced-motion`).

**Independent test**: abrir história de 3 cenas, navegar, verificar indicador acompanha a posição e muda de estado na última cena.

- [x] T012 [P] [US3] Implementar indicador de progresso (ex.: dots/segmentos refletindo o total real 3–5 variável) em `src/features/story-reader/components/scene-progress.tsx` com `.stories.tsx` e a11y
- [x] T013 [US3] Integrar `SceneProgress` no `src/features/story-reader/components/story-reader.tsx` (estático, sem animação)
- [x] T014 [US3] Adicionar teste unitário em `tests/unit/story-reader.test.tsx` (posição/total variável 3–5, última cena) + atualizar story do leitor

## Phase 6: US4 — Feedback de exportação de PDF (P2)

**Goal**: estado gerando → sucesso/erro na exportação, com mensagem localizada e nova tentativa em falha.

**Independent test**: acionar "Baixar como PDF", verificar estado "Gerando PDF…"; simular falha e verificar mensagem + ação de nova tentativa.

- [ ] T015 [P] [US4] Adicionar estado de exportação (idle/exporting/error) e feedback ao `src/features/story-export/components/export-story-button.tsx` (aria-live/aria-busy)
- [ ] T016 [US4] Garantir strings localizadas de exportação (gerando/erro/retry) em `src/features/story-request/locales/pt-BR.json` e `en.json`
- [ ] T017 [P] [US4] Atualizar `.stories.tsx` (default/loading/error) + teste unitário em `tests/unit/export-story-button.test.tsx` cobrindo sucesso/erro/retry

## Phase 7: US5 — Modo escuro (P2)

**Goal**: modo claro/escuro segue a preferência do sistema via tokens semânticos, preservando contraste AA e sem persistência.

**Independent test**: alternar `prefers-color-scheme`; verificar troca de tokens e contraste AA em todas as telas; nenhum dado persistido.

- [x] T018 [P] [US5] Adicionar modo escuro por tokens (`@media (prefers-color-scheme: dark)` e/ou classe `.dark` para o alternador manual) em `src/app/globals.css` para `--color-*` (background/surface/text/accent/focus/…)
- [x] T019 [US5] Validar contraste AA (≥4.5:1) de todos os tokens em ambos modos via Storybook `storybook:test` + verificar que nenhum componente usa hex/val ad-hoc
- [x] T020 [US5] Adicionar/atualizar validação de a11y (contraste) e deixar explícito que a escolha manual (alternador) é transitória na sessão — `prefers-color-scheme` não persiste escolha manual

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: regressões, cobertura, performance e evidência final.

- [ ] T021 Rodar `pnpm test:coverage` e garantir gates (≥80% global; ≥90% nos módulos safety/validation/orchestration) sem regressão
- [ ] T022 Rodar `pnpm storybook:test`, `pnpm test:e2e`, `pnpm test:visual`, `pnpm test:performance` e resolver qualquer falha/regressão das melhorias
- [ ] T023 [P] Atualizar o `README.md` e `quickstart.md` de `003-melhorias-de-ux` com as novas superfícies (cards, leitura, progresso, feedback, modo escuro)
- [ ] T024 Atualizar `tasks.md` marcando tarefas concluídas e registrar evidência final (baseline + pós-melhorias)

## Dependencies (user story order)

```
US1 (tema visual, P1) ─┐
US2 (leitura, P1) ─────┤  todas dependem de T003/T004 (ChoiceCard) e da base (T001/T002)
US3 (progresso, P2) ───┤
US4 (export, P2) ──────┤
US5 (modo escuro, P2) ─┘
```

As user stories US1–US5 são **independentes entre si** (arquivos distintos) — podem rodar em paralelo após T001–T004. Ordem de prioridade de entrega sugerida: US1 → US2 → (US3 | US4 | US5).

## Parallel execution examples

- **T003/T004** (ChoiceCard): podem rodar em paralelo (componente + teste).
- **US1 (T005–T007)** e **US2 (T008–T011)**: em paralelo, arquivos distintos.
- **US3 (T012–T014)**, **US4 (T015–T017)** e **US5 (T018–T020)**: em paralelo.

## Implementation strategy (MVP first)

- **MVP**: US1 (tema visual) entregue primeiro como incremento independente; depois US2 (leitura) como P1; seguem as P2 (US3, US4, US5).
- Cada US é um incremento testável de forma independente (ver "Independent test" por fase).
- Polish final (T021–T024) consolida regressões e evidência.
