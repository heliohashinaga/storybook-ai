# Quickstart — Spec 009 Frontend Routes

Guia rápido para implementar e rodar a Spec 009. Cobre os comandos reais e os
invariantes que **não** podem ser quebrados.

## Pré-requisitos
- Repo raiz: `storybook-ai`.
- `pnpm install` já executado (instala hook `lint`/`format:check`/`typecheck`).

## O que está em jogo (leia antes de codar)
- Rotas `/form`, `/reader` (**estado de tela**, nunca conteúdo).
- Nenhuma história/idade/identificador **jamais** em URL/path/query/params/logs.
- `POST /api/stories` continua o único entry point de servidor.
- Sessão = memória React (`StorySessionContext`); reload perde tudo; rotas que
  exigem sessão sem ela ⇒ `redirect("/form")`.

## Passo a passo

1. **Estrutura de rotas**
   - `src/app/page.tsx` → `redirect("/form")`.
   - `src/app/form/page.tsx`, `src/app/reader/page.tsx` (server-components).
   - (opcional) `src/app/export/page.tsx`.

2. **Estado → rota**
   - `StorySessionContext` expõe `hasSession()`, `storyCount`, `activeIndex`.
   - `StoryRequestApp` deriva tela (`form`|`reader`) da rota.

3. **Navegação real**
   - `top-nav` usa `router.push("/form")`; remover event bus
     (`requestHome`/`onHomeRequested` + `home-request-event.ts`).

4. **Session gate**
   - Guarda client p/ `redirect("/form")` quando faltar sessão (reload/deep-link).

5. **Testes** (veja tasks T311–T315).

## Quality gates (realizar DOBRO no último edit)
```bash
pnpm lint
pnpm format          # formata arquivos novos/editados
pnpm format:check
pnpm typecheck
pnpm test            # unit + integração + pipeline (fakes apenas)
pnpm test:e2e        # pt-BR + EN, fake provider
pnpm storybook:test  # stories default/loading/error/edge + a11y
pnpm build           # precisa passar
```
- Ordem sugerida ao final: rode `pnpm format`, depois `lint`/`format:check`/
  `typecheck`, depois `test`/`test:e2e`/`storybook:test`/`build`.
- Se o host for fraco e o Vitest der timeout de worker, use `pnpm test:limited`.

## Verificação de invariante de privacidade (manual rápida)
```bash
# Em testes +E2E, asseverar que request.url NÃO contém story/age/id.
# Pós-refresh de /reader (sem sessão) → redirect("/form").
```

## Também verificar
- Budgets: rota inicial ≤250 KiB gzip (`@react-pdf/renderer` lazy no export).
- A11y: foco no novo viewport, `aria-current` no top-nav, `aria-live`/`aria-busy`.
