# Plan — Spec 009 Frontend Routes

## Technical Context

**Stack/architecture (reinfo do AGENTS.md e specs anteriores):**
- Next.js 16 (App Router) + React 19, TypeScript strict, Tailwind v4
  (design tokens), next-intl (`pt-BR`|`en`), Zod, Vitest + Playwright + Storybook
  test-runner. `@react-pdf/renderer` lazy no export.
- Anônimo por design: nenhum identificador; sessão apenas em memória React
  (`StorySessionContext`); nada em cookies/localStorage/indexDB/cache.
- Barreira servidor ↔ cliente via `server-only`; `POST /api/stories` é o único
  entry point de servidor.
- **Decisão de roteamento (ADR 0009):** rotas (`form`/`reader`/`export`) modelam
  **somente a máquina de estados da UI**; nunca transporte de conteúdo.

**Desconhecidos/NEEDS CLARIFICATION:** nenhum — ambos os pontos de escopo
(`/export` e `?story=`) foram decididos em `/speckit.clarify` (2026-08-15) e
alinhados na spec §11/§Clarifications.

## Constitution Check

Derivado de `.specify/memory/constitution.md` (v1.1.0):

- **I. Code Quality:** rotas novas seguem tokens/dead-code; modos derivados de
  `usePathname()` (fonte única); sem `any`; lint/format limpos — atendido.
- **II. Testing Standards:** test-first por tarefa (T300+ têm "test a escrever");
  tiers unit/integração/E2E + Storybook; determinístico — **atendido** (ver
  tasks.md e checklists).
- **III. UX Consistency:** a11y (foco, `aria-current`, `aria-busy`), tokens,
  stories default/edge/error, comportamento idêntico app↔Storybook — atendido.
- **IV. Performance:** rota inicial ≤250 KiB gzip; `@react-pdf/renderer` lazy;
  leitor/export lazy — atendido (budget de 250 KiB definido no AGENTS.md e spec).

**Gates:** lint (0 warnings), format:check, typecheck pós-último edit; tests;
E2E pt-BR+EN; Storybook; budgets; cobertura (≥80% geral; ≥90%
safety/validation/orchestration). **Violações não justificadas: nenhuma.

## Objetivo
Introduzir rotas de interface (`/`, `/form`, `/reader`, `/export`) que
modelem a **máquina de estados da UI**, removendo o event bus e dando "voltar"/
navegação de URL reais, **sem** jamais transportar história/idade/identificador
no URL.

## Princípios de implementação
1. Rotas = **estado de tela**, nunca conteúdo. Nenhum dado sensível em path/query/
   hash/params.
2. `POST /api/stories` é o único entry point de servidor. Rotas novas são
   server-components que montam client wrappers.
3. Sessão vive em `StorySessionContext` (memória React). Guarda de sessão no client
   ⇒ `redirect("/form")` quando faltar sessão em rota que exige.
4. `server-only` e barreira servidor↔cliente preservados.

## Etapas

### Fase 0 — Estrutura de rotas
- Criar `src/app/form/page.tsx` e `src/app/reader/page.tsx` (server-components).
  Ambos montam **o mesmo client wrapper** `<StoryRequestApp isFake={...}/>` —
  **sem prop `mode`**.
- `src/app/page.tsx` passa a `redirect("/form")`.
- **`src/app/export/page.tsx`** — rota dedicada, PDF in-memory/lazy.

### Fase 1 — Refatoração de estado → rota
- **Fonte única = rota.** `StoryRequestApp` deriva o modo (`form`|`reader`) do
  **path atual via `usePathname()`**, em vez de prop `mode` ou booleano ad-hoc.
  `draftingNew`/`status` derivam do path e nunca o duplicam.
- `StorySessionContext` expõe guarda de sessão (`hasSession`, `storyCount`,
  `activeId`, `activeIndex`).

### Fase 2 — Navegação real
- `top-nav`: substituir event bus (`requestHome`/`onHomeRequested`) por
  `router.push("/form")` real.
- Mapear transições de estado → `router.push`/`replace`.

### Fase 3 — Session gate
- Guarda client p/ `redirect("/form")` (via `router.replace`) quando rota exige
  sessão sem ela.
- Seleção multistória segue só via `StorySessionContext`; `?story=` adiado (fora
  do escopo — spec §11).

### Fase 4 — Testes e qualidade
- Unitários/integração/E2E (pt-BR + EN) para navegação e estado perdido.
- Storybook default/loading/error/edge p/ novas páginas.
- Invariante de privacidade cobre URL **e logs**; a11y cobre `aria-busy` e
  `aria-current` no roteamento.
- Budgets, a11y, `lint`/`format:check`/`typecheck` pós-último edit.

## Critérios de saída (rever spec §9)
- [ ] `/form`, `/reader` funcionais; `/`→`/form`.
- [ ] Event bus removido; `top-nav` usa `router.push`.
- [ ] `redirect("/form")` p/ `/reader` sem sessão (testado).
- [ ] Invariante de privacidade testado (nada sensível na URL).
- [ ] Quality gates + budgets + a11y verdes.

## Riscos
- Vazar conteúdo na URL (invariante em testes).
- Reload `/reader` sem sessão (redirect gracioso).
- Regressão a11y/bundle (foco + lazy-load).

## Artefatos de design (Phase 0/1)
- **research.md** — viabilidade e contraintes de rotas sem persistência (resolvido).
- **data-model.md** — modelo de rota como estado de UI; `?story=` adiado.
- **quickstart.md** — guia de validação end-to-end da feature.
- **contracts/** — **não aplica**: a feature é de frontend; `POST /api/stories`
  permanece inalterado (único contrato externo, já coberto por
  `specs/001/contracts/story-generation.openapi.yaml`).
