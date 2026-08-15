# Checklist de Requisitos — Spec 009 Frontend Routes

Aceite de cada requisito desta spec. Marque conforme for satisfeito.

## Funcional
- [ ] Rota `/` redireciona para `/form`.
- [ ] Rota `/form` renderiza o formulário de nova história (estado `drafting`).
- [ ] Rota `/reader` renderiza o leitor da história ativa (estado `story`).
- [ ] Rota `/export` renderiza a exportação in-memory/lazy (`@react-pdf/renderer`
      lazy; fora do bundle inicial).
- [ ] Multihistória: seleção da conta ativa só via `StorySessionContext` (UI
      interna); rota `/reader` **não** aceita `?story=` nesta entrega (adiado,
      spec §11).
- [ ] `top-nav` navega por `router.push("/form")`; event bus
      (`requestHome`/`onHomeRequested` + `home-request-event.ts`) removido.
- [ ] **Fonte única = rota:** modo tela (`form`|`reader`) derivado do path via
      `usePathname()`; `StoryRequestApp` **não** recebe prop `mode`;
      `draftingNew`/`status` derivam do path e nunca o duplicam (spec §6.2).

## Privacidade / Anonimato (não-negociável)
- [ ] Nenhuma história, idade exata, `ageBand`, `locale` derivado, UUID ou
      identificador em **path, query, hash ou params**.
- [ ] `POST /api/stories` permanece o único entry point de servidor.
- [ ] `server-only` e barreira servidor ↔ cliente preservados.
- [ ] Sem persistência em cookies/localStorage/indexDB/cache; sessão = memória
      React.
- [ ] Invariante verificável em teste: `request.url` **e logs** observáveis (por
      fake provider) não contêm dados sensíveis.

## Sessão / Deep-link
- [ ] `/reader` (ou `/export`) sem sessão ⇒ `redirect("/form")`.
- [ ] Reload em rota que exige sessão resolve graciosamente para `/form` (sem
      tela morta, sem erro exposto).

## Acessibilidade
- [ ] Focus management ao navegar entre telas.
- [ ] `aria-current` no item do top-nav da rota ativa.
- [ ] `aria-live`/`aria-busy` para estados assíncronos (submitting, load do
      leitor).
- [ ] `prefers-reduced-motion` respeitado.
- [ ] Scroll restoration aceitável (posição de topo ao trocar de tela ou sem
      regressão observável).

## Performance
- [ ] Rota inicial ≤250 KiB gzip.
- [ ] Leitor/export lazy; `@react-pdf/renderer` `lazy-import` apenas no export
      (não no bundle inicial).

## Qualidade
- [ ] `pnpm lint` 0 warnings (pós-último edit).
- [ ] `pnpm format:check` limpo (rode `pnpm format` em arquivos novos/editados).
- [ ] `pnpm typecheck` green (pós-último edit).
- [ ] Cobertura ≥80% geral; ≥90% safety/validation/orchestration.
- [ ] E2E pt-BR + EN verdes (fake provider).
- [ ] Storybook default/loading/error/edge + a11y verdes.
- [ ] `pnpm build` passa.

## Fora de escopo (não implementar)
- [ ] NÃO: persistência de história entre reloads (viola o anonimato).
- [ ] NÃO: URLs canônicas com ids externos.
- [ ] NÃO: mudanças em `POST /api/stories`, `story-generation/*` ou OpenAPI.
- [ ] NÃO: rota própria para a tela de progresso de geração (`/steps`) — é
      estado efêmero renderizado dentro de `/form` durante `submitting`.
