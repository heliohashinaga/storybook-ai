# Tasks — Adotar o design system e o frontend do story-blossom-room

**Branch**: `007-adopt-blossom-design` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

> Execução test-first (Constitution 1.1.0): para todo arquivo com lógica/bundle, escrever/atualizar o
> teste antes/junto da implementação, confirmar falha pelo motivo certo, implementar até verde.
> Regra de test: nenhum teste chama AI real — `STORIES_TEST_MODE=fake` + fixtures determinísticas.

---

## Dependency Graph (ordem de conclusão das user stories)

```
Phase 2 (Fundacional: tokens + fontes + primitivas)
        │
        ▼
Phase 3 (US4: 6 temas) ──► habilita cards de tema emoji (US1)
        │
        ▼
Phase 4 (US1: formulário) ──► Phase 5 (US2: geração)
                                  │
                                  ▼
Phase 6 (US3: leitor) ──► Phase 7 (US5: modo escuro)
                                  │
                                  ▼
Phase 8 (US6: padrões compartilhados + topo) ──► Phase 9 (Polonia/revisão)
```

- **US4** e a **Phase 2** são paralelizáveis entre arquivos distintos (tokens/fontes ⊥ schemas/catálogo).
- **US1, US2, US3** consomem as primitivas restilizadas da Phase 2 (portal) e — US1 também da US4.
- **US5** depende de US1/US3 (dark da jornada completa); **US6** consolida US1 (cards de tema) + topo + Storybook==app.

---

## Phase 1 — Setup (inicialização)

- [ ] T001 Setup: confirmar `pnpm install` sem drift e que os gates de base (lint/format/type/test) passam antes de editar — `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`
- [ ] T002 Setup: revisar a lista de dependências para fratas de fonte self-hosted; adicionar apenas deps necessárias para `next/font` (Baloo 2 + Nunito) em `package.json` (nenhuma nova lib de UI)

---

## Phase 2 — Fundacional: tokens, fontes e primitivas (bloqueia US1/US2/US3/US5)

- [ ] T003 [P] Adicionar Baloo 2 + Nunito via `next/font` em `src/app/layout.tsx` (self-hosted, `display: swap`, pesos: Baloo 2 → bold/extrabold; Nunito → 400/700); registrar `--font-display` e `--font-sans`
- [ ] T004 [P] Em `src/app/globals.css`, substituir a paleta hex (roxa `#5b21b6` etc.) por tokens semânticos **oklch** quentes (creme/coral/terracota + acento vivo), preservando a taxonomia existente (`background/surface/text/text-subtle/accent/accent-hover/focus/success/warning/danger`); adicionar tokens novos (`secondary`, `muted`, `border`, `input`, `ring`, `primary`), `--radius: 1.25rem` e raios derivados, `--shadow-soft`/`--shadow-lift`, e mapear `--font-display`/`--font-sans`
- [ ] T005 [P] Em `tailwind.config.ts`, ligar os tokens oklch/font/radius/shadow ao `@theme` (bridge) para que as classes existentes (`bg-surface`, `text-text`, `rounded-lg`, etc.) reflitam os novos valores sem renomear primitivas
- [ ] T006 Definir as variantes **escuras** dos tokens (via `@media (prefers-color-scheme: dark)` + `.dark`/`.light` in-memory) em `src/app/globals.css`, garantindo AA ≥4.5:1 texto normal em claro e escuro (alimenta US5)
- [ ] T007 Teste de tokens — novo `tests/unit/design-tokens.test.ts` que valida existência dos tokens semânticos claros/escuros e a ausência de hex hardcoded em primitivas selecionadas (usando `STORIES_TEST_MODE=fake`)
- [ ] T008 [P] Restilizar `src/components/ui/button.tsx` para a linguagem do protótipo (raio maior, `shadow-lift` no primário, hover elevado) usando tokens; atualizar `src/components/ui/button.test.tsx`
- [ ] T009 [P] Restilizar `src/components/ui/progress.tsx` (barra rounded, cor da barra, transição suave) usando tokens; atualizar `src/components/ui/progress.test.tsx`
- [ ] T010 [P] Restilizar `src/components/ui/choice-card.tsx` para cards grandes com emoji/ícone, raio largo, `shadow-soft`/selecionado=`shadow-lift`, estado `aria-pressed` e foco visível; atualizar `tests/unit/choice-card.test.tsx`
- [ ] T011 [P] Restilizar `src/components/ui/select.tsx` e `src/components/ui/alert.tsx` (novas cores/bordas) preservando `variants` semânticos; atualizar `src/components/ui/select.test.tsx` e `src/components/ui/alert.test.tsx`
- [ ] T012 Conferir que as novas cores mantêm contraste AA (≥4.5:1) em texto normal — roda como subcheque da T007; ajustar novos primitivos conforme necessário

---

## Phase 3 — [US4] Histórias nos 6 temas do protótipo (P1)

`spec.md` US4 (FR-008/009/010, SC-007). Expandir `Theme` de 3 para 6 ao mesmo tempo, com único typed source.

- [ ] T013 [P] [US4] Ampliar o union em `src/features/story-request/client/story-preferences-schema.ts` (`themeValues` → + `curiosity`/`perseverance`/`empathy`)
- [ ] T014 [P] [US4] Ampliar `themeSchema` (`z.enum` → 6) em `src/features/story-generation/server/schemas.ts`
- [ ] T015 [P] [US4] Ampliar `themeCatalog` em `src/lib/story-catalog.ts` (label + description derivados de `themeValues`); adicionar `emoji` por tema para os cards
- [ ] T016 [P] [US4] Ampliar catálogos next-intl `catalog.theme.*` e `catalog.themeDescription.*` nos 3 novos temas em `src/features/story-request/locales/pt-BR.json` e `src/features/story-request/locales/en.json`
- [ ] T017 [P] [US4] Ampliar o mapeamento de intenção `purposeFor()` em `src/features/story-generation/server/agents/planner.ts` para `curiosity/perseverance/empathy`
- [ ] T018 [P] [US4] Fazer a fixture determinística cobrir os 6 temas em `src/features/story-generation/server/fixed-dev-provider.ts` (história anônima dedicada por tema para fakes/visual/e2e)
- [ ] T019 [US4] Atualizar `tests/unit/story-preferences-schema.test.ts` — aceita os 6 temas, rejeita `magic`
- [ ] T020 [US4] Atualizar `tests/unit/story-catalog.test.ts` — catálogo derivado cobre exatamente os 6 (sem drift), com label/description/emoji
- [ ] T021 [P] [US4] Atualizar `tests/unit/story-generation/agents/planner.test.ts` — `purposeFor` cobre os 6 themes
- [ ] T022 [P] [US4] Atualizar `tests/contract/story-generation.openapi.test.ts` / `tests/contract/generate-story.privacy.test.ts` — payload continua anônimo (só `ageBand/locale/theme/sceneCount`) e aceita os 3 novos temas; adicionar caso de `invalidInput` para tema fora dos 6
- [ ] T023 [P] [US4] Atualizar `tests/unit/provider-fixtures.test.ts` para os novos temas fake

**Independent test**: selecionar cada um dos 6 temas no formulário (fake) e gerar — retorna história coerente com o tema; payload apenas `ageBand/locale/theme/sceneCount`; tema fora dos 6 → 400 `invalidInput`.

---

## Phase 4 — [US1] Formulário com a nova identidade (P1)

`spec.md` US1 (FR-004, parte FR-003). Form acolhedor: cards de tema com emoji, idade, duração, CTA primário.

- [ ] T024 [P] [US4] Atualizar `tests/unit/opencode-story-generation-provider.test.ts` / `tests/unit/openrouter-story-generation-provider.test.ts` — confirmar que os adapters reais encaminham o campo `theme` para os 6 valores, alinhando a SC-007 também aos provedores reais (não só ao dev-fake)
- [ ] T025 [P] [US1] Renderizar a seleção de tema como cards grandes com emoji+descrição no formulário — `src/features/story-request/components/story-request-form.tsx` (consome `themeCatalog` da US4 e `ChoiceCard` restilizado)
- [ ] T026 [US1] Ajustar o layout/ordem do formulário (tema → idade → duração (cenas 3-5) → botão primário "Criar história" com ícone) em `src/features/story-request/components/story-request-form.tsx` usando tokens/fontes novas
- [ ] T027 [US1] Manter validações Zod de `story-preferences-schema.ts` e acessibilidade (foco visível, teclado, `aria-pressed` nos cards) no formulário reestilizado — `src/features/story-request/components/story-request-form.tsx`
- [ ] T028 [US1] Atualizar `tests/unit/story-request-form.test.tsx` — renderiza envio com nova identidade/emoji e mantém flags de privacidade (payload sem identificador)
- [ ] T029 [P] [US1] Atualizar stories em `.stories.tsx` do formulário (default/loading/error/edge) ao novo visual — `src/features/story-request/components/story-request-form.stories.tsx`
- [ ] T030 [US1] Atualizar spec E2E do formulário (pt-BR + EN, fake) e linha de base visual em `playwright.config.ts`/`tests/e2e/**`

**Independent test**: abrir o formulário (pt-BR) e confirmar visual novo, tema em cards com emoji, validação e envio anônimo; foco teclado AA.

---

## Phase 5 — [US2] Geração com progresso por estágios (P1)

`spec.md` US2 (FR-005). Estágios nomeados + barra + bloqueio de envio + `aria-busy`/`aria-live`.

- [ ] T031 [P] [US2] Reestilizar os estágios nomeados ("Escrevendo sua história…" → "Ilustrando as cenas…" → "Verificando a segurança…") + barra de progresso ao estilo protótipo em `src/features/story-request/components/story-generation-progress.tsx` (usa `Progress` restilizado)
- [ ] T032 [US2] Garantir aviso de "envio bloqueado durante a criação" e desabilitação dos controles de envio em `src/features/story-request/components/story-request-app.tsx`; manter `aria-busy="true"`/`aria-live`
- [ ] T033 [US2] Localizar as novas strings de estágios via catálogos next-intl (`pt-BR.json`/`en.json`)
- [ ] T034 [US2] Atualizar `tests/unit/story-generation-progress.test.tsx` — estágios em sequência, progresso e labels acessíveis
- [ ] T035 [US2] Atualizar `tests/unit/story-request-app.test.tsx` — blocagem de envio durante geração, sem enviar identificador

**Independent test**: submeter com provider fake — estágios aparecem em sequência com barra, `aria-busy`/`aria-live` presentes, nenhum controle de envio habilitado, nada inseguro logado.

---

## Phase 6 — [US3] Leitor com nova identidade (P2)

`spec.md` US3 (FR-006). Cena destacada, progresso por cenas, Anterior/Próxima, leitura em voz alta, PDF no rodapé.

- [ ] T036 [P] [US3] Reestilizar a leitura de cena única (título, texto, destaque de ilustração/placeholder) e o indicador de progresso por cenas em `src/features/story-reader/components/` (scene-view + scene-progress)
- [ ] T037 [P] [US3] Reestilizar os botões Anterior/Próxima (com desabilitar correto nas bordas) em `src/features/story-reader/components/`
- [ ] T038 [P] [US3] Reestilizar o controle de leitura em voz alta (play/stop, `aria-pressed`) em `src/features/story-read-aloud/components/narration-control.tsx`
- [ ] T039 [P] [US3] Reestilizar a ação "Baixar como PDF" no rodapé em `src/features/story-export/components/export-story-button.tsx`, mantendo o **lazy-import** (`@react-pdf/renderer`) intacto
- [ ] T040 [US3] Atualizar `tests/unit/story-reader.test.tsx` e `tests/unit/use-read-aloud.test.tsx` — navegação, estado play/stop acessível, cenas
- [ ] T041 [US3] Atualizar `tests/unit/export-story-button.test.tsx` — PDF só no clique, com lazy-import e estados localizados
- [ ] T042 [US3] Atualizar stories do leitor (`.stories.tsx`) e linha de base visual/E2E do leitor

**Independent test**: percorrer cenas com Anterior/Próxima (bordas desabilitam), ativar/parar leitura com `aria-pressed`, baixar PDF via lazy, tudo na nova identidade.

---

## Phase 7 — [US5] Modo escuro e consistência em toda a jornada (P2)

`spec.md` US5 (FR-007). Dark em formulário, geração e leitor + alternância manual sem persistência.

- [ ] T043 [P] [US5] Reestilizar a alternância de tema visual (claro/escuro) em `src/features/theme/components/theme-toggle.tsx`, mantendo precedência do sistema na primeira carga e **sem persistência**
- [ ] T044 [P] [US5] Assegurar que formulário, geração e leitor herdam a paleta escura dos tokens (Phase 2) sem flash/regeneração; ajustar componentes específicos se necessário
- [ ] T045 [US5] Atualizar `tests/unit/use-color-scheme.test.tsx` — escolha manual na sessão precede o sistema, nada persistido

**Independent test**: alternar para escuro nas 3 telas — muda a paleta escura do protótipo mantendo AA; a escolha não persiste entre recargas.

---

## Phase 8 — [US6] Padrões compartilhados + topo (P2)

`spec.md` US6 (polonia de padrões; FR-003/010). Topo com marca + idioma/tema, sem duplicação, Storybook==app.

- [ ] T046 [P] [US6] Adicionar barra do topo com marca (`BookOpenText` + nome + tagline) + alternância de idioma em `src/app/layout.tsx` / shell da página, na linguagem do protótipo
- [ ] T047 [P] [US6] Consolidar o seletor de tema em cards (emoji) como padrão reutilizável e remover duplicação entre formulário e stories (guard no `ChoiceCard`/`themeCatalog`)
- [ ] T048 [US6] Revisar que todas as strings visíveis vêm dos catálogos next-intl (nenhum hardcoded) e que nenhum código morto/duplicado permanece — checagem em `src/features/*` e `src/components/ui/*`
- [ ] T049 [US6] Atualizar stories (default/edge/error) + checagem de que o **Storybook == app** (behavior e visual) — `pnpm storybook:test` verde após a centralização
- [ ] T050 [US6] Atualizar `tests/integration/anonymous-session.test.tsx` / `tests/integration/privacy-boundary.test.tsx` — a jornada completa nova não introduz identificador

**Independent test**: as 6 telas/stories cobrem default/edge/error com a nova identidade; nenhum hardcoded em pt-BR/en; Storybook coincide com o app.

---

## Phase 9 — Polonia & cross-cutting (review final)

- [ ] T051 **Review**: revisar `contracts/design-tokens-and-themes.md` e `contracts/design-system.md` — atualizar o trecho `story-generation.openapi.yaml` do enum `theme` (3→6) se ainda não atualizado na US4; confirmar que os valores/tokens do design-system.md foram registrados em `globals.css`/`tailwind.config.ts`
- [ ] T052 **Gates**: `pnpm lint` (0 warnings), `pnpm format:check` (sem drift), `pnpm typecheck` (sem `any` novo) e `pnpm format` em qualquer arquivo novo/editado — **após a última edição**
- [ ] T053 **Test**: `pnpm test` (unit/contrato/pipeline) e `pnpm test:coverage:check` (≥80% total; ≥90% safety/validation/orchestration)
- [ ] T054 **Storybook/a11y**: `pnpm storybook:test` (default/loading/error/edge + a11y AA) — comportamento coincide com o app
- [ ] T055 **E2E/visual/perf**: `pnpm test:e2e` (pt-BR + EN, fake), `pnpm test:visual` (base aprovada da nova paleta), `pnpm test:performance` (≤250 KiB JS inicial; export PDF lazy; navegação ≤100 ms p75)
- [ ] T056 **DoD**: 6 temas no catálogo (SC-007), nenhum identificador em payload/log/catálogo/fixtures (SC-004), tokens com AA (SC-002), identidade em 100% das telas (SC-001), gates verdes (SC-005/SC-006)
- [ ] T057 Commit: `:lipstick: feat(story-generation): adopt story-blossom-room design system + 6 themes` (gitmoji + Conventional Commits)

---

## Implementação estratégica

**MVP (US1 primeiro)**: entregar tokens+fontes+primitivas (Phase 2) e formulário novo (US1) com 6 temas (US4, incluindo T024 dos provedores reais) já no primeiro incremento — cobre US1 (P1) + US4 (P1) = formulário + tema expandido. Em seguida US2 (geração) fecha o fluxo de criação completo.

**Entrega incremental (pares test-first)**: cada fase é um incremento independente e testável:
- Fase 2 + US4 → Foundation visual + temas (paralelizáveis entre arquivos distintos).
- US1 → US2 → leitor (US3) → escuro (US5) → padrões (US6).

**Paralelismo**: T003-T005, T008-T011 (arquivos distintos na Phase 2); T013-T024/US4 (inclui T024, teste dos provedores reais); T036-T039/US3.

## Notas

- Nenhum teste chama AI real — fakes + fixtures da US4 (T018) suprem fakes/visual/e2e; T024 garante, também, o encaminhamento do `theme` nos adapters reais (opencode/openrouter) para SC-007.
- Mapeamento de tokens `accent`→`primary` (paleta): decisão de implementação — ver `contracts/design-system.md` §2 nota e US6 (T047/T048).
- A nova paleta é a **nova linha de base** da regressão visual (churn de cor esperado e aprovado, não como diff indesejado).
- `tasks.md` foi gerado por `/speckit.tasks`; seguir `checklists/requirements.md`, `contracts/design-tokens-and-themes.md` e `contracts/design-system.md`.
