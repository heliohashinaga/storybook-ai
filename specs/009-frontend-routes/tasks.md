# Tasks: Spec 009 — Frontend Routes

**Input**: Design documents from `specs/009-frontend-routes/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md
**Tests**: incluídos — a spec (§8) e a constituição exigem test-first e tiers
unit/integração/E2E.

## Organization

Tasks agrupadas por **user story** para implementação/teste independentes.

## Format: `- [ ] [ID] [P?] [US?] Description + caminho`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[US]**: user story dona da tarefa
- Caminhos exatos em todas as descrições

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Estrutura de rotas — fundação para todas as stories (server-components de página)

- [ ] T300 Criar server-component `src/app/page.tsx` que faça `redirect("/form")`
- [ ] T301 Criar `src/app/form/page.tsx` montando `<StoryRequestApp isFake={...}/>` (sem prop `mode`)
- [ ] T302 Criar `src/app/reader/page.tsx` montando `<StoryRequestApp isFake={...}/>` (sem prop `mode`)
- [ ] T303 Criar `src/app/export/page.tsx` (PDF in-memory/lazy, `@react-pdf/renderer` lazy)

**Checkpoint**: rotas `/form`, `/reader`, `/export` montam o mesmo client wrapper; `/` redireciona a `/form`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Refatoração de estado → rota e navegação real. Bloqueia US3 e Polish.

**⚠️ CRITICAL**: nenhuma US de comportamento pode começar sem esta fase.

- [ ] T304 Expor guarda de sessão em `src/features/story-request/client/story-session-context.tsx` (`hasSession()`, `storyCount`, `activeId`, `activeIndex`) sem serializar
- [ ] T305 Derivar modo (`form`|`reader`) do path via `usePathname()` em `src/features/story-request/components/story-request-app.tsx`; `draftingNew`/`status` derivam da rota (fonte única)
- [ ] T306 Mapear transição estado→rota (spec §6.2) com `router.push`/`replace` (`replace` p/ redundância/session gate)
- [ ] T307 Substituir event bus em `src/features/shell/components/top-nav.tsx` por `router.push("/form")`; remover `src/lib/home-request-event.ts`
- [ ] T308 Focus management ao navegar + `aria-current` no `top-nav` ativo em `src/features/shell/components/top-nav.tsx`

**Checkpoint**: rota é a única fonte de verdade; event bus removido; navegação real funcionando.

---

## Phase 3: User Story 1 — Rotas de destino estáveis (Priority: P1) 🎯 MVP

**Goal**: Rotas `/form`, `/reader`, `/export` funcionais e navegáveis; `/` redireciona; modo derivado do path.

**Independent Test**: navegar `/`→`/form`; montar `/reader` (com sessão) e `/form`; URL muda sem transporte de conteúdo.

### Testes da US1

- [ ] T311 [P] [US1] Unit: mapeamento estado→rota (guarda de transição) em `tests/unit/` — nenhum dado sensível em params
- [ ] T312 [P] [US1] Integration: `/`→`redirect("/form")` e `/reader` sem sessão⇒`redirect("/form")`; invariante de privacidade em URL **e logs** (fake provider) em `tests/integration/`

### Implementação da US1

- [ ] T309 [US1] Guarda client p/ `redirect("/form")` (via `router.replace`) quando rota de sessão é alcançada sem sessão (reload/deep-link) em client wrapper
- [ ] T310 [US1] Remover suporte a query `?story=` (adiado) — `/reader` não aceita seleção por URL em `src/features/story-reader/`

**Checkpoint**: US1 funciona como MVP — fluxo form→reader com volta real e redirect de sessão perdida.

---

## Phase 4: User Story 2 — Testes E2E de navegação (Priority: P1)

**Goal**: Fluxo de navegação verificado de ponta a ponta (pt-BR + EN), com histórico e a11y.

**Independent Test**: `pnpm test:e2e` com fake provider.

### Testes da US2

- [ ] T313 [P] [US2] E2E: form→reader usa `router.push`; `history.back()` volta ao form; deep-link `/reader` sem sessão aterrissa em `/form`; URL **e logs** limpos; `aria-busy` em submitting e `aria-current` na rota ativa — em `tests/e2e/`

**Checkpoint**: `pnpm test:e2e` verde para pt-BR + EN (fake provider).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Storybook, budgets, quality gates e cobertura.

- [ ] T314 [P] Storybook default/loading/error/edge p/ novas páginas + a11y (`aria-busy`/`aria-current`) em `.stories.tsx` co-localizados
- [ ] T315 Rodar `pnpm lint`, `pnpm format:check`, `pnpm typecheck` após último edit; verificar budget (rota inicial ≤250 KiB gzip) e cobertura (≥80% geral; ≥90% safety/validation/orchestration)
- [ ] T316 Rodar `quickstart.md` para validação end-to-end da feature

**Checkpoint**: gates verdes, budgets respeitados, storybook cobre estados.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Ph1)**: sem dependências — inicia imediato
- **Foundational (Ph2)**: depende de Setup — **bloqueia US1/US2**
- **US1 (Ph3)**: depende de Foundational
- **US2 (Ph4)**: depende de US1 (exercita navegação) — testes independentes
- **Polish (Ph5)**: depende de US1+US2

### User Story Dependencies

- **US1**: inicia após Foundational; base para todas
- **US2**: após US1 (roda `test:e2e` sobre as rotas)
- Polish: após US1+US2

### Dentro de cada US

- Testes primeiro (TDD, fail antes) → implementação → checkpoint verde
- Testes antes da implementação correspondente

### Parallel Opportunities

- Setup T300–T303: T301/T302/T303 podem rodar em paralelo (arquivos distintos)
- Foundational T304–T308: T305, T307, T308 em paralelo
- Testes T311/T312 (US1) em paralelo

---

## Parallel Example: User Story 1

```bash
# Content tests em paralelo:
Task: "T311 [P] [US1] Unit teste mapeamento estado→rota"
Task: "T312 [P] [US1] Integration teste redirect + invariante privacidade"

# Implementação sequencial após testes verdes:
Task: "T309 [US1] Guarda client redirect"
Task: "T310 [US1] Remover ?story="
```

---

## Implementation Strategy

### MVP (US1 Only)
1. Setup (T300–T303) → 2. Foundational (T304–T308) → 3. US1 tests (T311/T312) + impl (T309/T310) → **STOP e valide** → 4. US2 E2E (T313) → 5. Polish (T314–T316)

### Incremental Delivery
- Setup + Foundational → Fundação
- US1 (MVP) → testar → validar
- US2 (E2E) → testar → validar
- Polish → gates/budgets

---

## Notes

- [P] = arquivos diferentes, sem dependência
- [US] label rastreia a story
- Cada story é independentemente completável e testável
- Testes falham antes da implementação
- Commit após cada tarefa ou grupo lógico
- Evitar: tarefas vagas, conflitos de arquivo, dependências cross-story que quebrem independência
- Invariante de privacidade (nada sensível na URL/logs) é sempre verificado nos testes
