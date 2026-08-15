# Plan — Spec 009 Frontend Routes

## Objetivo
Introduzir rotas de interface (`/`, `/form`, `/reader`, `/export` opcional) que
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
- (Opcional) `src/app/export/page.tsx`.

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

### Fase 3 — Session gate + opcional ?story=
- Guarda client p/ `redirect("/form")` (via `router.replace`) quando rota exige
  sessão sem ela.
- (Opcional) `?story=<i>` apenas como seleção em memória, sempre revalidado;
  trigger: link gerado só quando >1 história na sessão. Com 1 história, omitido.

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
