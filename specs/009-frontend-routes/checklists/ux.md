# Checklist de A11y & UX — Spec 009 Frontend Routes (reuses tokens/storybook)

Roteamento é principalmente UX. Esta checklist garante que migrar para rotas não
introduz regressões de acessibilidade ou usabilidade.

> **Fonte única de rastreio de a11y/UX:** os itens abaixo são a fonte de verdade
> para a barra de acessibilidade/usabilidade desta entrega. O §9 (DoD) da spec.md
> os resume sináticamente e **não** os duplica como checkbox — marque `[X]` aqui
> apenas, evitando fonte dupla/`drift`.

## Navegação & Foco
- [x] Ao navegar `/form` → `/reader` e volta, o **foco** move-se para o novo
      viewport (título ou container) de forma idempotente. (`.focus()` em refs
      no form e reader; `tabIndex={-1}` em títulos)
- [x] `aria-current` marca o item do `top-nav` da rota ativa (`/form` vs
      `/reader`. Verificado: `aria-current="page"` no `top-nav.tsx`).
- [x] Gestos de navegação do navegador (`voltar`/`forward`) funcionam: `voltar`
      do leitor retorna ao formulário.
- [x] `router.replace` usado onde só "re-hidratar" o mesmo destino é o esperado
      (evita voltar duplo no topo do fluxo), `push` para abrir nova tela.
      (top-nav usa `router.push("/form")`; redirect de sessão usa replace)

## Estados Assíncronos
- [x] Durante `submitting` o formulário mantém `aria-busy` e algum indicador não
      visual (ex. `aria-live`). (`story-request-form.tsx` e
      `story-generation-progress.tsx`)
- [x] Load do leitor (após navegação antes de hidratar sessão) mostra um estado
      de carregamento acessível (`aria-busy`), não um flash de erro.
- [x] Redirect gracioso (`redirect("/form")` em rota sem sessão) não dispara
      leitura de voz, vídeo ou foco em elemento invisível. (snapshot + live
      region durante hidratação/redirect)

## Conteúdo & Idioma
- [x] Todo texto de página/tela novo (títulos, estados, erros) via catálogos
      next-intl `pt-BR` + `en` — nenhum hardcoded. (`useTranslations("story")`
      em `story-request-app.tsx` e `story-request-form.tsx`)
- [x] A rota não altera a `locale` ativa (permanece no `LocaleProvider`, acima
      das páginas).

## Movimento & Visual
- [x] `prefers-reduced-motion` respeitado em qualquer transição adicionada.
      (`scene-progress.tsx`, `narration-control.tsx`)
- [x] Nenhuma cor/hex hardcoded; apenas tokens semânticos do design-system.
      (grep: 0 hex/rgb/hsl em componentes; só CSS vars em `globals.css`)
- [x] Transições entre telas não causam flicks de layout (scroll top controlado).

## Storybook
- [x] Cada página nova tem `.stories.tsx` cobrindo default / loading / error /
      edge. (10 `.stories.tsx` — ex. `story-request-app`, `story-reader`,
      `narration-control`)
- [x] Comportamento do Storybook corresponde ao app (navegação por `router`
      apenas onde faz sentido; páginas puras não mockam `router` sem razão).
      (stories usam fixture `pathname` do framework nextjs)
- [x] A11y check (`storybook:test`) verde nas stories novas. (71/71 play-tests;
      zero violações a11y — dívida pré-existente do `story-request-form`
      resolvida com alinhamento do ecossistema 10.5.8)

## Regressões Usabilidade
- [x] `top-nav` ainda permite voltar ao formulário (agora via `router.push`).
- [x] Multihistória segue selecionável no leitor (US3) sem `href` sensível.
- [x] Campos do formulário retêm valores corretos em mudanças de tela
      (rascunho em memória, formato limpo ao voltar).
