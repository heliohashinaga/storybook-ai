# Frontend Routes (009) — Roadmap de Implementação

> **Status:** Draft. Sequência sugerida para implementar a Spec 009 com um
> único escritor por cwd/worktree. Test-first, invariantes de privacidade
> sempre verificados.

## Fase 0 — Fundação das rotas (T300–T303)
- `src/app/page.tsx` → `redirect("/form")`.
- `src/app/form/page.tsx`, `src/app/reader/page.tsx` (server-components).
- (opcional) `src/app/export/page.tsx`.

## Fase 1 — Estado → rota (T304–T306)
- `StorySessionContext` expõe `hasSession()`, `storyCount`, `activeIndex`.
- `StoryRequestApp` deriva tela da rota; mapa estado→rota (spec §6.2).
- `router.push`/`replace` para transições.

## Fase 2 — Navegação real (T307–T308)
- `top-nav` usa `router.push("/form")`; remover event bus.
- Focus management + `aria-current`.

## Fase 3 — Session gate + `?story=`
- Guarda client p/ `redirect("/form")` quando faltar sessão.
- (opcional) `?story=<i>` revalidado.

## Fase 4 — Endurecimento
- Testes unit/integração/E2E + Storybook + budgets + `lint`/`format:check`/
  `typecheck` pós-último edit.

---

**Gates de saída** (detalhados em `checklists/requirements.md` e `quickstart.md`):
`pnpm lint`, `format:check`, `typecheck`, `test`, `test:e2e`, `storybook:test`,
`build` — todos verdes no último edit.
