# Feature Specification: Tela Inicial — Login (Google/GitHub) + Demo

**Feature Branch**: `015-tela-inicial`

**Created**: 2026-08-18

**Status**: Draft

**Input**: "Quero usar o Google e o GitHub como autenticação e quero ter um
botão demo sem autenticação, copiar a tela de login do
repos/story-blossom-room. Autenticação redireciona para a aplicação playground
com o uso de llm real; o botão demo redireciona para o uso dos dados fake."

## Contexto e Problema

Hoje `/` **não é uma tela**: `src/app/page.tsx` apenas executa
`redirect("/form")` (decisão da spec 009). Não existe autenticação, e o modo
"real vs fake" é decidido por uma variável de ambiente (`STORIES_TEST_MODE`).

O projeto **story-blossom-room** já possui uma tela de login (landing) pronta:
marca, título "Storybook AI", card "AI Playground" com botões **Continue with
Google** e **Continue with GitHub**, divisor "or" e botão **Explore the Demo**
(→ demo com histórias pré-geradas, sem conta). Esta spec traz essa tela para o
storybook-ai e a conecta a autenticação real (OAuth Google/GitHub):

- **Login (Google/GitHub)** → redireciona para o **playground** (aplicação com
  LLM real: `/form` → `/reader`).
- **Botão Demo** → redireciona para o uso de **dados fake** (catálogo
  determinístico da spec 012), sem autenticação.

### Aviso de Governança: emenda à regra de privacidade

O AGENTS.md (seção "Non-Negotiable Privacy Rules") proíbe **cookies**,
**persistência** e define o app como **anonymous by design**. Autenticação OAuth
exige um cookie de sessão e uma identidade verificada (provedor + sub).

**DECISÃO (requer ratificação humana — dono do projeto)**: introduzir um
**único cookie de sessão (httpOnly JWT, stateless)** apenas no caminho
autenticado do playground, com as seguintes salvaguardas:

1. Nenhum dado de identidade (e-mail, nome) é **persistido** no servidor, nem
   enviado aos provedores de LLM, nem registrado em logs.
2. O cookie é `httpOnly`, `SameSite=Lax`, `Secure` (prod), TTL curto.
3. O caminho **demo continua 100% anônimo e sem cookies**.
4. Nenhuma história, idade ou dado da criança é associado à sessão; a geração
   permanece anônima (payloads inalterados: `ageBand`, `locale`, `theme`,
   `sceneCount`).
5. `POST /api/stories` continua o único endpoint de geração; o modo real/fake
   passa a ser derivado da sessão no servidor (sessão → real; sem sessão → fake).

Esta emenda precisa ser registrada (AGENTS.md + ADR) e aprovada antes da
implementação — ver `plan.md` → Constitution Check.

## Clarifications

### Session 2026-08-18

- Q: Onde o usuário deve fazer logout no playground? → A: Botão "Sair" no TopNav, visível no playground (`/form`, `/reader`)
- Q: Devemos registrar eventos de autenticação em logs? → A: Logs anônimos (provedor + resultado + timestamp, sem e-mail/nome/sub)
- Q: O que um usuário já autenticado deve ver ao visitar a raiz `/`? → A: Redirecionar autenticados de `/` para `/form`
- Q: Como restringir o acesso ao playground? → A: Allowlist de e-mails via env (`AUTH_ALLOWLIST_EMAILS`), validada no callback `signIn` do Auth.js (memória apenas, nunca persistida/logada)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar no playground com Google (Priority: P1)

Um visitante chega em `/`, vê a tela de login (copiada de story-blossom-room),
clica em **Continue with Google**, autoriza no Google e é redirecionado para o
playground (geração com LLM real).

**Why this priority**: é o caminho principal de conversão para o uso real do
produto.

**Independent Test**: E2E com OAuth simulado (mock do provedor no nível de
rede): login → sessão criada → redirect para `/form` → geração com runtime real
(fake provider testável, sem LLM ao vivo).

**Acceptance Scenarios**:

1. **Given** um visitante em `/`, **When** ele clica em "Continue with Google",
   **Then** ele é enviado ao fluxo OAuth do Google e, após
   autorizar, volta autenticado ao playground (`/form`).
2. **Given** um usuário autenticado no playground, **When** ele ativa "Sair" no
   TopNav, **Then** a sessão é encerrada (cookie removido) e ele volta a `/`.
3. **Given** um usuário com sessão válida, **When** ele visita `/`,
   **Then** ele é redirecionado para `/form` (a tela de login é só para anônimos).
4. **Given** um usuário autenticado, **When** ele acessa `/form`, **Then** a
   geração usa os provedores reais (LLM) e a resposta não contém qualquer
   identificador do usuário.
5. **Given** um visitante não autenticado tentando `POST /api/stories`,
   **When** a requisição chega ao servidor, **Then** ela é tratada como modo
   demo (dados fake) — nunca LLM real sem sessão.

---

### User Story 2 - Entrar no playground com GitHub (Priority: P1)

Mesmo fluxo da US1 usando **Continue with GitHub**.

**Independent Test**: E2E com OAuth simulado para o provedor GitHub.

**Acceptance Scenarios**:

1. **Given** um visitante em `/`, **When** ele clica em "Continue with GitHub",
   **Then** ele passa pelo OAuth do GitHub e volta autenticado ao playground.
2. **Given** o playground ativo via GitHub, **When** o usuário gera uma
   história, **Then** o comportamento é idêntico ao do login por Google
   (mesmo runtime real, mesma ausência de identidade nos payloads).

---

### User Story 3 - Explorar a demo sem conta (Priority: P1)

Um visitante que não quer (ou não pode) criar conta clica em **Explore the
Demo** na tela de login e usa o aplicativo completo com **dados fake**
(catálogo determinístico da spec 012) — sem qualquer cookie de sessão.

**Why this priority**: a demo mantém o app utilizável anonimamente e é a porta
de entrada para o e2e/visual sem credenciais.

**Independent Test**: E2E: `/` → "Explore the Demo" → `/demo` → geração com
dados fake (sem sessão, sem cookie) → reader; verificação de que nenhum cookie
é definido no caminho demo.

**Acceptance Scenarios**:

1. **Given** um visitante em `/`, **When** ele clica em "Explore the Demo",
   **Then** ele aterrissa no app em modo demo (`/demo`), sem exigir conta.
2. **Given** o app em modo demo, **When** o visitante gera uma história,
   **Then** o conteúdo vem do catálogo fake (determinístico, offline) e o
   browser não recebe cookie de sessão.
3. **Given** um usuário autenticado, **When** ele acessa `/demo`,
   **Then** a demo permanece fake (o modo é derivado da rota/sessão no
   servidor; a demo nunca consome LLM real).
4. **Given** uma falha de login OAuth (ex.: usuário nega autorização),
   **When** o callback falha, **Then** o evento é logado anonimamente
   (provedor + falha + timestamp, sem identificador) e o usuário vê mensagem
   localizada em `/`.

---

### Edge Cases

- **Credenciais OAuth ausentes** (`AUTH_GOOGLE_ID`/`AUTH_GITHUB_ID` não
  configuradas): os botões correspondentes ficam desabilitados com texto
  localizado ("indisponível"); a demo permanece funcional (dev sem setup).
- **Login negado/erro OAuth**: o usuário volta para `/` com uma mensagem de
  erro localizada; nenhum estado corrompido.
- **`prefers-reduced-motion`**: decorativos (blobs/brilhos) da tela de login
  são desativados ou reduzidos.
- **Viewport pequeno (≥320 px)**: layout centralizado colapsa sem overflow
  horizontal; botões acessíveis por teclado.
- **Rate limit**: picos de login/callback são limitados pelo
  `InMemoryRateLimiter` (proteção anti-bruteforce/DoS).
- **Acesso negado (allowlist)**: usuário autenticado no provedor mas fora de
  `AUTH_ALLOWLIST_EMAILS` → login rejeitado no callback, volta a `/` com
  mensagem localizada ("Acesso restrito — envie um convite"); o e-mail é
  comparado apenas em memória e não é logado.
- **Locale pt-BR/en**: a tela de login e as mensagens de erro respeitam o
  LangToggle (next-intl); paridade de catálogos coberta por teste.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE exibir em `/` a tela de login copiada de
  story-blossom-room (`src/routes/index.tsx`): marca, título "Storybook AI",
  card "AI Playground", botões "Continue with Google" e "Continue with GitHub",
  divisor "or" e botão "Explore the Demo" (traduzidos via next-intl).
- **FR-002**: O sistema DEVE autenticar com Google e GitHub via OAuth 2.0
  (Auth.js v5 / `next-auth@beta`), com fluxo de callback em
  `/api/auth/callback/{google|github}` e sessão JWT em cookie httpOnly.
- **FR-003**: Após login bem-sucedido, o sistema DEVE redirecionar para o
  **playground** (`/form`), onde a geração usa os provedores reais de LLM.
- **FR-004**: O botão "Explore the Demo" DEVE navegar para `/demo`, que renderiza o
  **mesmo aplicativo em modo demo** (dados fake da spec 012), espelhando o
  fluxo do playground página a página (`/demo` ↔ `/form`, `/demo/reader` ↔
  `/reader`) — sem exigir autenticação e **sem definir cookies**.
- **FR-005**: O modo real/fake da geração DEVE ser decidido **no servidor**:
  sessão válida → real; sem sessão → demo (fake). `STORIES_TEST_MODE=fake`
  permanece como override explícito para testes/dev.
- **FR-006**: Nenhum identificador do usuário (e-mail, nome, sub, token) DEVE
  ser persistido, enviado aos provedores de LLM, incluído em payloads de
  história, registrado em logs ou exposto ao cliente (exceto o próprio cookie
  de sessão).
- **FR-007**: O cookie de sessão DEVE ser `httpOnly`, `SameSite=Lax`,
  `Secure` em produção, com TTL curto e escopo mínimo; o caminho demo (`/demo`)
  não DEVE receber o cookie.
- **FR-008**: `POST /api/stories` continua o único endpoint de geração e
  permanece `Cache-Control: no-store`; a sessão NÃO altera o payload
  (`ageBand`, `locale`, `theme`, `sceneCount` — schema Zod `.strict()`
  inalterado).
- **FR-009**: Endpoints de autenticação (`/api/auth/*`) DEVEM ser rate-limited
  pelo `InMemoryRateLimiter` e responder `Cache-Control: no-store`.
- **FR-010**: A tela de login e o modo demo DEVEM respeitar a barra de
  acessibilidade: contraste AA, navegação por teclado, foco visível,
  `aria-live` para erros, `prefers-reduced-motion`, um único `<h1>`.
- **FR-011**: Toda string visível (botões, erros, acessibilidade) DEVE vir dos
  catálogos next-intl (`pt-BR` + `en`); nenhuma string hardcoded.
- **FR-012**: A rota inicial DEVE manter o budget de performance (≤250 KiB gzip;
  LCP p75 ≤2.5 s): ícones SVG inline (sem dep nova de ícones), nenhum asset
  pesado no caminho crítico.
- **FR-013**: O playground DEVE oferecer um botão "Sair" (logout) no TopNav,
  visível em `/form` e `/reader`, que encerra a sessão (remove o cookie
  `authjs.session-token`) e redireciona para `/` (tela de login).
- **FR-014**: Eventos de autenticação (login/logout, sucesso/falha, provedor,
  timestamp) PODEM ser registrados em logs **apenas anonimamente** — sem
  e-mail, nome, `sub`, token ou qualquer identificador; campos de observability
  scrubbed conforme AGENTS.md.
- **FR-015**: Um usuário com sessão válida que visita `/` (raiz) DEVE ser
  redirecionado para `/form` (playground) — a tela de login só aparece para
  visitantes anônimos.
- **FR-016**: O acesso ao playground DEVE ser restrito por uma allowlist de
  e-mails configurável via env (`AUTH_ALLOWLIST_EMAILS`): o callback `signIn`
  compara o e-mail do provedor (em memória) com a lista e rejeita o login de
  quem não está nela — sem persistir, logar ou expor o e-mail; sessão mantém
  claims mínimas (`sub` + provedor).

### Key Entities

- **AuthProvider** (`google | github`) — enum do provedor OAuth.
- **Session** — JWT stateless (sem banco): claims mínimas (sub do provedor +
  expiração), transportado em cookie httpOnly. **Não** há entidade "User"
  persistida, nem banco de dados.
- **GenerationMode** (`playground | demo`) — derivado no servidor a partir da
  sessão (+ override `STORIES_TEST_MODE`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos acessos **anônimos** a `/` renderizam a tela de login;
  usuários com sessão válida são redirecionados a `/form` (FR-015), verificado
  por E2E pt-BR/en.
- **SC-002**: Login com Google e com GitHub criam sessão e redirecionam para
  `/form` em ≤1 ação de clique, verificado por E2E com OAuth simulado.
- **SC-003**: O caminho demo (`/` → `/demo`) funciona sem autenticação, com
  dados fake e **zero cookies definidos**, verificado por E2E + teste de
  invariante.
- **SC-004**: Nenhuma requisição não autenticada consegue acionar LLM real
  (servidor trata como demo), verificado por teste de contrato/integração.
- **SC-005**: Nenhum identificador (e-mail, nome, sub, token) aparece em logs,
  payloads, fakes ou resposta ao cliente; testes de invariante de privacidade
  verdes (novo teste de sessão incluído).
- **SC-006**: Rota inicial ≤250 KiB gzip e LCP p75 ≤2.5 s (budgets do CI);
  login e demo dentro do budget.
- **SC-007**: 100% das chaves i18n novas existem nos dois catálogos; stories de
  login/demo aprovados (default/edge/error) e sem regressão visual.

## Assumptions

- **Emenda ratificada**: a exceção de cookie de sessão (Governança acima) é
  aprovada pelo dono do projeto antes da implementação e registrada em
  AGENTS.md + ADR.
- **Auth.js v5 (`next-auth@beta`)**: escolha de biblioteca (research.md).
  Workaround conhecido do Next 16: `signIn` como server action falha
  (nextauthjs#13387); usamos **form POST direto** para
  `/api/auth/signin/{provider}` ou `signIn()` do cliente.
- **Sem banco de dados**: sessão JWT stateless; nenhuma persistência de usuário
  ou identidade.
- **Demo = catálogo fake da spec 012**: o modo demo reutiliza o conteúdo
  determinístico existente; nenhum LLM é consumido.
- **Sem mudanças no payload/contrato de geração**: a sessão é uma camada de
  autorização; não altera o schema `.strict()` nem o OpenAPI de geração.
- **story-blossom-room é referência de UI**: adaptamos a tela para tokens do
  Blossom (spec 007) e convenções do storybook-ai (RSC/client, next-intl).

## Fora de Escopo / Decisões Adiadas

- Cadastro/gerenciamento de conta (perfil, histórico) — não há banco, é
  adiado; a sessão é apenas uma porta para o playground.
- Múltiplas sessões/SSO além de Google/GitHub (ex. Apple, magic link) — adiado.
- Armazenamento de histórias por usuário — proibido por design (sem
  persistência).
- Mudanças no `/reader` além do gating de sessão necessário — fora de escopo.

## Referências

- `AGENTS.md` (invariantes de privacidade, budgets, barra de acessibilidade,
  regras de servidor "closed enum set").
- `specs/009-frontend-routes/spec.md` (modelo de rotas: `/`, `/form`, `/reader`;
  `/` hoje redireciona a `/form`).
- `specs/012-fake-content-catalog/` (catálogo determinístico para o modo demo).
- `specs/007-adopt-blossom-design/spec.md` (tokens, TopNav, LangToggle).
- `story-blossom-room/src/routes/index.tsx` (tela de login de referência).
- Research: Auth.js v5 + Next 16 (ver `plan.md`/`research.md`).
