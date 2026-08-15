# Checklist de A11y & UX — Spec 009 Frontend Routes (reuses tokens/storybook)

Roteamento é principalmente UX. Esta checklist garante que migrar para rotas não
introduz regressões de acessibilidade ou usabilidade.

> **Fonte única de rastreio de a11y/UX:** os itens abaixo são a fonte de verdade
> para a barra de acessibilidade/usabilidade desta entrega. O §9 (DoD) da spec.md
> os resume sináticamente e **não** os duplica como checkbox — marque `[X]` aqui
> apenas, evitando fonte dupla/`drift`.

## Navegação & Foco
- [ ] Ao navegar `/form` → `/reader` e volta, o **foco** move-se para o novo
      viewport (título ou container) de forma idempotente.
- [ ] `aria-current` marca o item do `top-nav` da rota ativa (`/form` vs
      `/reader`).
- [ ] Gestos de navegação do navegador (`voltar`/`forward`) funcionam: `voltar`
      do leitor retorna ao formulário.
- [ ] `router.replace` usado onde só "re-hidratar" o mesmo destino é o esperado
      (evita voltar duplo no topo do fluxo), `push` para abrir nova tela.

## Estados Assíncronos
- [ ] Durante `submitting` o formulário mantém `aria-busy` e algum indicador não
      visual (ex. `aria-live`).
- [ ] Load do leitor (após navegação antes de hidratar sessão) mostra um estado
      de carregamento acessível (`aria-busy`), não um flash de erro.
- [ ] Redirect gracioso (`redirect("/form")` em rota sem sessão) não dispara
      leitura de voz, vídeo ou foco em elemento invisível.

## Conteúdo & Idioma
- [ ] Todo texto de página/tela novo (títulos, estados, erros) via catálogos
      next-intl `pt-BR` + `en` — nenhum hardcoded.
- [ ] A rota não altera a `locale` ativa (permanece no `LocaleProvider`, acima
      das páginas).

## Movimento & Visual
- [ ] `prefers-reduced-motion` respeitado em qualquer transição adicionada.
- [ ] Nenhuma cor/hex hardcoded; apenas tokens semânticos do design-system.
- [ ] Transições entre telas não causam flicks de layout (scroll top controlado).

## Storybook
- [ ] Cada página nova tem `.stories.tsx` cobrindo default / loading / error /
      edge.
- [ ] Comportamento do Storybook corresponde ao app (navegação por `router`
      apenas onde faz sentido; páginas puras não mockam `router` sem razão).
- [ ] A11y check (`storybook:test`) verde nas stories novas.

## Regressões Usabilidade
- [ ] `top-nav` ainda permite voltar ao formulário (agora via `router.push`).
- [ ] Multihistória segue selecionável no leitor (US3) sem `href` sensível.
- [ ] Campos do formulário retêm valores corretos em mudanças de tela
      (rascunho em memória, formato limpo ao voltar).
