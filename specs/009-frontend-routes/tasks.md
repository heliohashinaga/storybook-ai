# Tasks — Spec 009 Frontend Routes

## Legenda
- **Prioridade:** P0 (crítico) / P1 (importante) / P2 (nice-to-have)
- **Tipo:** feat / refactor / test / chore / docs
- Cada tarefa segue TDD: teste que falha → o jeito certo → verde → refactor.

---

### Fase 0 — Estrutura de rotas

- **T300** feat: Criar server-component `src/app/page.tsx` que faz `redirect("/form")`.
  - Accept: `/` aterrissa em `/form`; status redirect; teste integração.
  - **Test a escrever:** integração `/` ⇒ 307/redirect `/form`.
- **T301** feat: Criar `src/app/form/page.tsx` que monta o client wrapper do
  formulário (`<StoryRequestApp isFake={...}/>` — **sem** prop `mode`).
  - Accept: GET `/form` renderiza o form; feedback de erro localizado.
  - **Test a escrever:** renderização de `/form` + query `?story=` ignorado se
    fora de faixa (com T310).
- **T302** feat: Criar `src/app/reader/page.tsx` que monta o client wrapper do
  leitor (`<StoryRequestApp isFake={...}/>` — **sem** prop `mode`).
  - Accept: GET `/reader` com sessão renderiza leitor; sem sessão ⇒ redirect.
  - **Test a escrever:** `/reader` sem sessão ⇒ redirect `/form` (com T309).
- **T303** feat (P2/opcional): `src/app/export/page.tsx` para exportação
  in-memory/lazy (`@react-pdf/renderer` lazy). Se adiada, remover do escopo.

### Fase 1 — Refatoração de estado → rota

- **T304** refactor: `StorySessionContext` passa a expor guarda de sessão
  (`hasSession()`, `storyCount`, `activeId`, `activeIndex`) sem serializar nada.
  - **Test a escrever:** guarda exposta; nada serializado (invariante de
    anonimato na leitura da sessão).
- **T305** refactor: `StoryRequestApp` **deriva o modo do path atual via
  `usePathname()`** (`/form` → form; `/reader` → reader); `draftingNew`/`status`
  passam a **derivar** da rota, não duplicá-la (fonte única — spec §6.1/§6.2).
  - Accept: rota é a única fonte de verdade do modo tela; **sem** prop `mode`.
  - **Test a escrever:** unit mapeia path→modo; `draftingNew`/`status` derivados.
- **T306** refactor: Garantir que transição de estado → rota seja 1:1 (mapa da
  spec §6.2) usando `router.push`/`replace`; `replace` p/ redundância e p/
  redirect de sessão perdida (T309).
  - **Test a escrever:** unit do mapa estado→rota + uso correto de
    push/replace.

### Fase 2 — Navegação real

- **T307** refactor: `top-nav` – substituir event bus (`requestHome`/
  `onHomeRequested`) por `router.push("/form")` real; remover `home-request-event`.
  - Accept: `router.push("/")` já não é *no-op*; evento removido.
  - **Test a escrever:** `top-nav` emite navegação p/ `/form` sem event bus.
- **T308** feat: Focus management ao navegar entre telas (`aria-current` no
  top-nav ativo, foco no novo viewport).
  - **Test a escrever:** integração/E2E `aria-current` na rota ativa + foco é
    movido ao viewport.

### Fase 3 — Session gate + `?story=`

- **T309** feat: Guarda client p/ `redirect("/form")` (via `router.replace`)
  quando rota que exige sessão é alcançada sem sessão (reload/deep-link).
  - **Test a escrever:** `/reader` sem sessão ⇒ redirect `/form` sem poluir
    histórico.
- **T310** feat (P2/opcional): query `?story=<i>` apenas como seleção em memória,
  sempre revalidado contra `storyCount`; fora de faixa ⇒ ignorado. Trigger: link
  só é gerado quando >1 história na sessão (spec §5).
  - **Test a escrever:** `?story=` fora de faixa ignorado; 1 história ⇒ sem link.

### Fase 4 — Testes e qualidade

- **T311** test: Unit – mapeamento estado→rota; nenhum dado sensível em params.
- **T312** test: Int – `/` e `/reader` (sem sessão) ⇒ `redirect("/form")`;
  invariante de privacidade no URL **e logs** observáveis por fake provider.
- **T313** test: E2E (pt-BR + EN) – form→reader usa `router.push`;
  `history.back()` volta ao form; deep-link `/reader` sem sessão aterrissa em
  `/form`; URL **e logs** limpos de dados; `aria-busy` em `submitting` e
  `aria-current` na rota ativa.
- **T314** chore: Storybook default/loading/error/edge p/ novas páginas + a11y
  (`aria-busy`/`aria-current` nos estados de navegação).
- **T315** chore: Rodar `lint`/`format:check`/`typecheck` após o **último edit**;
  verificar budgets (rota inicial ≤250 KiB gzip) e cobertura (≥80% geral; ≥90%
  safety/validation/orchestration).

---

## Definition of Done (resumo)
- Rotas `/form`, `/reader` funcionais; `/`→`/form`; event bus removido.
- Modo tela derivado **do path (`usePathname`)** — sem prop `mode`; rota é a
  fonte única de verdade (spec §6.2).
- `redirect("/form")` (via `router.replace`) p/ `/reader` sem sessão (testado).
- Invariante de privacidade coberto em testes (nada sensível na URL/**logs**).
- `lint` 0 warnings; `format:check` limpo; `typecheck` green (pós-último edit).
- E2E pt-BR + EN verdes; budgets + a11y (`aria-busy`/`aria-current`) + cobertura
  atingidos.
