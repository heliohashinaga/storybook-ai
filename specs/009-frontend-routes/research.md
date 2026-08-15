# Research — Frontend Routes without Persistence

## Problema de pesquisa

É viável adotar rotas de interface (navegação por URL) em um aplicativo web
**anônimo por design** e **sem persistência**, onde histórias e preferências
existem apenas em memória React?

## Síntese

**Sim — desde que as rotas modelem somente a máquina de estados da UI** (form vs
reader), nunca o conteúdo. O anonimato e o "no persistence" não proíbem rotas;
proíbem que a rota transporte sensível. A solução padrão no ecossistema Next.js
para estados não-sensíveis de interface é combinar rotas de página (server
components) com um **client wrapper** que detém a sessão em memória e valida o
acesso a rotas que exigem sessão.

## Conclusões por assunto

### a) Rota vs estado efêmero
- Estados que **não carregam dados sensíveis** (form/reader/export) são rotáveis.
- Um **query param opcional** de seleção (ex. `?story=<i>`) é aceitável desde que seja
  só um índice de sessão e **sempre revalidado** contra a lista em memória; fora de
  faixa ⇒ ignorado. Nunca persistido.

### b) Deep-link / reload sem sessão
- Como nada persiste, um reload em `/reader` perde tudo. A prática robusta é
  **`redirect("/form")`** gracioso quando a guarda de sessão (client wrapper)
  detectar ausência de sessão na hidratação. Nada é mostrado, nada vaza.
- Isso mantém o contrato "o único estado válido pós-refresh é o formulário vazio".

### c) Remoção do event bus
- Hoje o `top-nav` usa `requestHome`/`onHomeRequested` porque `router.push("/")`
  é *no-op* no path já montado. Com uma rota distinta `/form`, `router.push("/form")`
  é uma navegação real, e o event bus pode ser **removido**.

### d) Botão "voltar" do navegador
- Rotas filhas (`/form`↔`/reader`) dão histórico semântico ao History API:
  `voltar` retorna do leitor ao formulário. Em SPA de rota única, `voltar` sai do site.

### e) Acessibilidade ao navegar
- Transições entre telas exigem **gestão de foco** no novo viewport, `aria-current`
  no top-nav ativo, e `aria-live`/`aria-busy` para estados assíncronos (submitting,
  load do leitor). Isto já é bar imposto pelo AGENTS.md; rotas não relaxam a barra.

### f) Performance
- Rotas novas não devem inchar o bundle inicial. Leitor/export continuam **lazy**;
  `@react-pdf/renderer` permanece `lazy-import` só no export. Budget de rota inicial
  ≤250 KiB gzip.

## Contraintes dominantes (não-negociáveis)

1. **Nunca** `story`/`age`/`ageBand`/`locale` derivado/UUID na URL, path, query,
   hash ou params.
2. `POST /api/stories` continua o único entry point de servidor.
3. Banbar rota que exija sessão, sem sessão ⇒ `redirect("/form")`.
4. `server-only` e barreira servidor ↔ cliente preservados.

## Riscos principais
- Vazar conteúdo na URL → viola privacidade (mitigação: invariantes em testes).
- Reload em `/reader` → tela morta (mitigação: redirect gracioso).
- Regressão de a11y/bundle → mitigação: gestão de foco + lazy-load + budgets.

## Decisões adiadas (não são alvo)
- Persistência real entre reloads (viola o anonimato) — **não** alvo.
- Rota `/export` dedicada — opcional, possivelmente uma spec 010.
