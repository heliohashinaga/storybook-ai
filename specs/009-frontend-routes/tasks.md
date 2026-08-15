# Tasks — Spec 009 Frontend Routes

## Legenda
- **Prioridade:** P0 (crítico) / P1 (importante) / P2 (nice-to-have)
- **Tipo:** feat / refactor / test / chore / docs
- Cada tarefa segue TDD: teste que falha → o jeito certo → verde → refactor.

---

### Fase 0 — Estrutura de rotas

- **T300** feat: Criar server-component `src/app/page.tsx` que faz `redirect("/form")`.
  - Accept: `/` aterrissa em `/form`; status redirect; teste integração.
- **T301** feat: Criar `src/app/form/page.tsx` que monta o client wrapper do
  formulário (`<StoryRequestApp mode="form" .../>`).
  - Accept: GET `/form` renderiza o form; feedback de erro localizado.
- **T302** feat: Criar `src/app/reader/page.tsx` que monta o client wrapper do
  leitor (`<StoryReader .../>` ou `StoryRequestApp mode="reader" .../>`).
  - Accept: GET `/reader` com sessão renderiza leitor; sem sessão ⇒ redirect.
- **T303** feat (P2/opcional): `src/app/export/page.tsx` para exportação
  in-memory/lazy (`@react-pdf/renderer` lazy). Se adiada, remover do escopo.

### Fase 1 — Refatoração de estado → rota

- **T304** refactor: `StorySessionContext` passa a expor guarda de sessão
  (`hasSession()`, `storyCount`, `activeIndex`) sem serializar nada.
- **T305** refactor: `StoryRequestApp` deriva o modo (`form`|`reader`) da rota
  atual, eliminando booleano ad-hoc de tela.
- **T306** refactor: Garantir que transição de estado → rota seja 1:1 (mapa da
  spec §6.2) usando `router.push`/`replace`; `replace` p/ redundância.

### Fase 2 — Navegação real

- **T307** refactor: `top-nav` – substituir event bus (`requestHome`/
  `onHomeRequested`) por `router.push("/form")` real; remover `home-request-event`.
  - Accept: `router.push("/")` já não é *no-op*; evento removido.
- **T308** feat: Focus management ao navegar entre telas (`aria-current` no
  top-nav ativo, foco no novo viewport).

### Fase 3 — Session gate + `?story=`

- **T309** feat: Guarda client p/ `redirect("/form")` quando rota que exige sessão
  é alcançada sem sessão (reload/deep-link).
- **T310** feat (P2/opcional): query `?story=<i>` apenas como seleção em memória,
  sempre revalidado contra `storyCount`; fora de faixa ⇒ ignorado.

### Fase 4 — Testes e qualidade

- **T311** test: Unit – mapeamento estado→rota; nenhum dado sensível em params.
- **T312** test: Int – `/` e `/reader` (sem sessão) ⇒ `redirect("/form")`;
  invariante de privacidade no URL observável por fake provider.
- **T313** test: E2E (pt-BR + EN) – form→reader usa `router.push`;
  `history.back()` volta ao form; deep-link `/reader` sem sessão aterrissa em
  `/form`; URL limpa de dados.
- **T314** chore: Storybook default/loading/error/edge p/ novas páginas + a11y.
- **T315** chore: Rodar `lint`/`format:check`/`typecheck` após o **último edit**;
  verificar budgets (rota inicial ≤250 KiB gzip) e cobertura (≥80% geral; ≥90%
  safety/validation/orchestration).

---

## Definition of Done (resumo)
- Rotas `/form`, `/reader` funcionais; `/`→`/form`; event bus removido.
- `redirect("/form")` p/ `/reader` sem sessão (testado).
- Invariante de privacidade coberto em testes (nada sensível na URL/logs).
- `lint` 0 warnings; `format:check` limpo; `typecheck` green (pós-último edit).
- E2E pt-BR + EN verdes; budgets + a11y + cobertura atingidos.
