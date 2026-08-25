# Feature Specification: Playground com login por usuário e senha + autoCadastro (Clerk)

**Feature Branch**: `018-clerk-session-playground`

**Created**: 2026-08-19

**Status**: Draft

**Input**: Descrição do usuário: "quero manter Google + usuário/senha, cadastro self-service (só
se permitido) e reset de senha sozinho. Aceito dependência externa para autenticação."

## Resumo

Hoje o acesso ao playground (`/form`, `/reader` — geração com LLM real) é gateado por login
OAuth (Google/GitHub) com autorização por allowlist de e-mails em variável de ambiente. O dono
quer evoluir isso para um modelo de **contas de usuário**: continuar com login via Google, **adicionar
login por usuário/senha**, permitir que a pessoa **crie a própria conta** (mas **somente se
autorizada** — só o dono e familiares), e **recuperar a senha sozinha** quando esquecer.

O que **não** muda (invariantes fundamentais): o **anonimato da criança** e a superfície de
privacidade. A conta é a identidade do **adulto** que faz o gate de acesso ao LLM real; a história
gerada permanece anônima (apenas faixa etária + idioma + tema + nº de cenas), nunca associada a
usuário, nunca persistida.

## Contexto / Estado atual

- Acesso ao playground via `requireSession()`/`isAuthenticated()` (Auth.js v5, JWT stateless).
- Allowlist de e-mail em env (`AUTH_ALLOWLIST_EMAILS`).
- Rota demo `/` e `/demo` permanecem anônimas (zero cookie).
- ADR 0012 regia essa exceção mínima "no cookies".

O requisito novo (autoCadastro + reset de senha) força **usuários persistentes** e **entrega de
e-mail** — incompatível com "credencial em env" e com o desenho stateless atual.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Login por usuário e senha (Priority: P1)

O dono/familiar abre o app no `/(playground)` e faz login com **e-mail/usuario e senha** em vez de
(ou além de) Google.

**Why this priority**: É o objetivo principal da mudança — alternativa de acesso independente de
provedor OAuth.

**Independent Test**: Logar com credenciais de usuário/senha válidas e acessar `/form`; logar com
senha errada e ver erro localizado sem vazar detalhes.

**Acceptance Scenarios**:

1. **Given** uma conta válida (email/senha), **When** o usuário informa as credenciais corretas,
   **Then** ele é autenticado e redirecionado para o playground (`/form`).
2. **Given** credenciais inválidas, **When** o usuário tenta logar, **Then** é exibido um erro
   localizado genérico ("credenciais inválidas") e **nenhuma** informação identifica o motivo
   (anti-enumeração).
3. **Given** um usuário já autenticado, **When** ele acessa `/`, **Then** é redirecionado para o
   playground em vez de ver a tela de login.

### User Story 2 - AutoCadastro, mas só se permitido (Priority: P1)

Uma pessoa **sem conta** pode criar a própria conta (escolhendo usuário/senha), **porém** o
cadastro só é aceito se a pessoa for **autorizada** (convidada pelo dono). Ninguém se cadastra sem
permissão.

**Why this priority**: Habilita o autoCadastro self-service exigido, mantendo o controle de "só eu
e família".

**Independent Test**: Um e-mail convidado consegue criar conta; um e-mail **não** convidado não
consegue e recebe feedback localizado de acesso negado.

**Acceptance Scenarios**:

1. **Given** um e-mail convidado pelo dono, **When** a pessoa tenta se cadastrar, **Then** a conta
   é criada com sucesso (autenticada e direcionada ao playground).
2. **Given** um e-mail **não** convidado, **When** a pessoa tenta se cadastrar, **Then** o cadastro
   é recusado com feedback localizado ("acesso restrito"), sem expor o motivo em detalhe.
3. **Given** cadastro em modo autoCadastro, **When** o usuário escolhe senha, **Then** a senha é
   aceita apenas se atender à política de senha configurada (comprimento mínimo), com validação
   localizada.

### User Story 3 - Reset de senha self-service (Priority: P1)

Um usuário que esqueceu a senha consegue **recuperá-la sozinho**, via e-mail, e voltar a logar com
a nova senha.

**Why this priority**: Recuperação de acesso sem depender do dono, fechando o ciclo de contas
self-service.

**Independent Test**: Solicitar "esqueci minha senha", receber e-mail, definir nova senha e logar.

**Acceptance Scenarios**:

1. **Given** um usuário logado/deslogado com conta e e-mail real, **When** ele solicita
   recuperação de senha, **Then** recebe um e-mail com link/fluxo para definir nova senha.
2. **Given** o fluxo de reset, **When** o usuário define a nova senha, **Then** loga com a nova
   senha (e a anterior deixa de funcionar).
3. **Given** um e-mail inexistente, **When** o usuário solicita reset, **Then** a resposta é
   neutra/genérica (sem revelar se a conta existe — anti-enumeração).

### User Story 4 - Manter login Google e demo anônima intactos (Priority: P1)

O login via **Google** continua funcionando, e a rota **demo** (`/demo`) permanece 100% anônima
(sem cookie, sem conta) com o mesmo comportamento.

**Why this priority**: Não regredir o que já existe; preservar o anonimato da demo e a identidade
do projeto.

**Independent Test**: Login Google funciona; acessar `/demo` não cria/envia nenhum cookie de sessão
nem exige conta.

**Acceptance Scenarios**:

1. **Given** uma conta Google válida, **When** o usuário faz login via Google, **Then** é
   autenticado e direcionado ao playground.
2. **Given** a rota demo (`/demo`), **When** o usuário acessa sem conta, **Then** a demo funciona
   com dados fake, **sem** cookie de sessão e **sem** LLM real.
3. **Given** um anônimo (sem sessão), **When** ele tenta acessar `/form` ou `/reader` diretamente,
   **Then** é redirecionado para a tela de login (nenhum acesso ao playground sem autenticação).

### User Story 5 - Privacidade da criança preservada (Priority: P0 — invariante)

Mesmo com contas de usuário adultas, o **anonimato da criança** é mantido: a geração continua
recebendo **somente** `ageBand|locale|theme|sceneCount`; nenhum identificador de criança em UI,
API, logs, analytics ou payload de provider; nenhuma história associada a usuário.

**Why this priority**: É a identidade/fundamento do projeto e regra não-negociável do AGENTS.md.

**Independent Test**: Testes unitários/contrato afirmam que o payload de `POST /api/stories` não
aceita nem transporta identificador de criança, e que nenhuma história é gravada/associada.

**Acceptance Scenarios**:

1. **Given** requisição a `/api/stories`, **When** o payload contém algo além de
   `ageBand|locale|theme|sceneCount`, **Then** é rejeitado (Zod `.strict()`) — mesmos invariantes
   de hoje.
2. **Given** a resposta do servidor, **When** há um erro/sucesso, **Then** nada de identificador
   da criança é logado, persistido ou exposto ao cliente.
3. **Given** o fluxo completo, **When** um usuário logado gera uma história, **Then** a história
   não é associada/pertencente à conta (é anônima).

## Requirements Summary

- Mantém login **Google**; remove login **GitHub** (não é mais requisito — a conta
  passa a ser via Google **ou** usuário/senha).
- Adiciona login por usuário/senha.
- AutoCadastro self-service, **apenas** para usuários autorizados (convidados).
- Reset de senha self-service (via e-mail).
- Demo e acesso anônimo permanecem sem cookie e sem conta.
- Playground só acessível autenticado (nenhum bypass).
- Invariante: anonimato da criança e payload fechado preservados.
- Erros de auth genéricos/localizados (anti-enumeração).

## Key Entities (resumo)

- **Usuário (Adulto/Conta)**: identidade do cuidador/pai que faz o gate (gerenciada externamente
  pelo provedor de auth; o app não persiste dados de usuário).
- **Sessão**: cookie de autenticação gerenciado pelo provedor de auth.
- **Pedido de história**: permanece **anônimo** e sem associação a usuário.
- **Criança**: continua **sem entidade** — nunca modelada, nomeada ou persistida.

## Non-Goals / Out of Scope

- Não construir sistema de contas próprio com banco.
- Não gravar associações usuário→história.
- Não adicionar campos de identidade da criança.
- Não relaxar a demo para exigir login.
- Não adicionar autorização por papéis/roles além do gate do playground.
- Não manter/estender o login por GitHub (removido nesta feature).

## Open Questions

- **Provedor de auth**: decidido como gerenciado (Clerk) — ver ADR 0013/plan.
- **Política de senha**: definir comprimento mínimo/enforque (default razoável, ex. ≥8).
- **Domínio customizado de e-mail do Clerk**: opcional; precisa comprar domínio + verificação DNS.

## Dependencies / Assumptions

- Assumido: contas/identidade do adulto fora do repositório (dependência externa aceita).
- Assumido: entrega de e-mail (reset/verificação) feita pelo provedor de auth.
- Assumido: modo "Invite-only" disponível no plano free do provedor de auth (validado na research).
- Assumido: `/demo` e `/` continuam sem `ClerkProvider` (sem cookie no caminho anônimo).

## Success Criteria (observable outcomes)

- [ ] Um familiar, sem intervenção do dono, consegue criar conta (convidado) e resetar senha.
- [ ] Um e-mail não convidado **não** consegue se cadastrar.
- [ ] Login funciona por Google **e** por usuário/senha.
- [ ] `/demo` continua anônimo e sem cookie; utente sem sessão não acessa o playground.
- [ ] Invariante de anonimato da criança continua coberto por testes.
- [ ] Todos os quality gates (lint/format/typecheck/build) passam sem regressão.
