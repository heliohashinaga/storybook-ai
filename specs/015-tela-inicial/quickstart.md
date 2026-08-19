# Quickstart — Validação da Spec 015 (Tela Inicial: Login + Demo)

**Branch**: `015-tela-inicial` | **Date**: 2026-08-18

Guia de validação ponta-a-ponta. Detalhes de implementação vivem em
`tasks.md`; contratos em `contracts/auth-flow.md`; modelo em `data-model.md`.

## Pré-requisitos

```bash
pnpm install
cp .env.example .env.local
# auth (opcional para demo; obrigatório para login):
#   AUTH_SECRET=<openssl rand -base64 32>
#   AUTH_GOOGLE_ID=...        AUTH_GOOGLE_SECRET=...
#   AUTH_GITHUB_ID=...        AUTH_GITHUB_SECRET=...
#   AUTH_TRUST_HOST=true      # dev fora de Vercel
#   AUTH_ALLOWLIST_EMAILS=voce@exemplo.com,amigo@exemplo.com  # acesso restrito
# credenciais de LLM (apenas para playground real):
#   OPENROUTER_API_KEY=... OPENCODE_GO_API_KEY=... + PLANNER/WRITER/MODERATOR/ILLUSTRATOR/READER_MODEL
```

## Cenários de validação

### C1 — Demo anônima (sem auth, sem cookie)

```bash
pnpm dev   # sem credenciais de auth
```

1. Abrir `/` → a tela de login renderiza (título "Storybook AI", card "AI
   Playground" com "Continue with Google/GitHub" **desabilitados**, botão
   "Explore the Demo" habilitado).
2. Clicar em "Explore the Demo" → `/demo` (app em modo demo).
3. Gerar uma história (dados fake do catálogo spec 012 — determinístico,
   offline).
4. **Invariante**: devtools → Application → Cookies = nenhum cookie definido;
   resposta de `POST /api/stories` não contém identificador.
5. Leitura em `/reader` e narração (modo fake) funcionam.

### C2 — Login com Google (playground, LLM real)

1. Configurar credenciais OAuth no `.env.local` (C1 acima).
2. Em `/`, "Continue with Google" habilitado → clicar → fluxo Google →
   autorizar → redirect para `/form`.
3. Gerar uma história com provedores **reais** (LLM). Payload de
   `POST /api/stories` continua exatamente `ageBand|locale|theme|sceneCount` —
   **sem** qualquer campo de identidade.
4. Recarregar `/form` → sessão mantida (cookie `authjs.session-token`); logout
   disponível → volta para `/` e o cookie é removido.

### C3 — Login com GitHub (espelho de C2)

Mesmo fluxo com "Continue with GitHub"; comportamento idêntico ao C2.

### C4 — Proteção do playground

1. Sem sessão, acessar `/form` ou `/reader` diretamente → `redirect("/")`.
2. Sem sessão, `POST /api/stories` → resposta **demo** (fake), nunca LLM real
   (verificar via log/observabilidade: nenhuma chamada a provider real).

### C5 — Modo teste determinístico (e2e/visual)

```bash
STORIES_TEST_MODE=fake pnpm test:e2e        # jornadas pt-BR + EN com fakes
pnpm test                                    # unit/component/contract/pipeline
pnpm storybook:test                          # stories de login/demo + a11y
pnpm test:visual                             # sem diff nas novas telas
```

- Com `STORIES_TEST_MODE=fake`, o override de teste tem precedência sobre a
  sessão → e2e roda determinístico mesmo com credenciais no ambiente.
- E2E de login usa **OAuth simulado**: cookie de sessão injetado por JWT
  assinado com `AUTH_SECRET` de teste (nenhum contato real com Google/GitHub).

### C6 — Budgets e acessibilidade

```bash
pnpm test:performance   # rota inicial ≤250 KiB gzip, LCP p75 ≤2.5s
pnpm lint && pnpm format:check && pnpm typecheck
```

- Tela de login: teclado (Tab/Enter nos botões), foco visível, `aria-live`
  para erro de login, `prefers-reduced-motion`, um único `<h1>`.

## Resultados esperados

| Cenário | Saída esperada |
|---------|----------------|
| C1 | Demo sem cookie; dados fake; UI idêntica à referência story-blossom-room (tokens Blossom) |
| C2/C3 | Sessão criada; redirect `/form`; geração real; payload inalterado |
| C4 | Anônimo nunca aciona LLM real; rotas protegidas redirecionam |
| C5 | Todas as suítes verdes, sem flakiness, sem rede real |
| C6 | Budgets e gates verdes |
