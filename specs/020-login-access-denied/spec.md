# Feature Specification: Mensagem de acesso negado no login

**Feature Branch**: `feature/020-login-access-denied`

**Created**: 2026-08-21

**Status**: Draft

**Input**: Exibir uma mensagem localizada de **acesso negado** na tela de login quando o usuário
não tem permissão de acesso (conta/cadastro recusado no autoCadastro _invite-only_), reaproveitando
as strings `accessDenied`/`signInError` já presentes nos catálogos de i18n (pt-BR e en) e
preservando a demo anônima e a privacidade (não revelar se a conta existe, não expor identificador).

## User Scenarios & Testing

### User Story 1 - Cadastro recusado com mensagem clara de acesso negado (Priority: P1)

Uma pessoa **sem conta** tenta se cadastrar, mas o cadastro só é aceito para quem foi convidado
pelo dono. Quando o cadastro é recusado, o usuário vê uma mensagem **clara e localizada** de
acesso negado ("Esta conta não pode entrar aqui"), em vez de um erro genérico/vazio, e é
incentivado a explorar a demo anônima.

**Why this priority**: É o fluxo mais frequente de "sem permissão" — o autoCadastro aberto para
todos, mas só quem é convidado consegue entrar. Sem uma mensagem clara, a pessoa não entende por
que não conseguiu criar a conta.

**Independent Test**: Um e-mail **não convidado** tenta se cadastrar → recebe a mensagem
localizada de acesso negado e ainda acessa a demo. Esse único cenário valida o valor central da
história.

**Acceptance Scenarios**:

1. **Given** um usuário **não convidado** na tela de login, **When** ele tenta se cadastrar,
   **Then** o cadastro é recusado e ele vê uma mensagem localizada de acesso negado ("Esta conta
   não pode entrar aqui") sem expor o motivo detalhado.
2. **Given** a mensagem de acesso negado exibida, **When** o usuário busca continuar usando o
   produto, **Then** ele ainda consegue acessar a demo anônima (rota pública, sem conta).
3. **Given** a mensagem de acesso negado exibida, **When** o usuário procura a conta/e-mail
   recusado na tela, **Then** **nenhum identificador** (e-mail, nome, id) é revelado na mensagem.

---

### User Story 2 - Assinatura anti-enumeração: respostas genéricas e indistinguíveis (Priority: P2)

Uma pessoa tenta entrar com credenciais que não autorizam acesso (e-mail fora da permissão ou
inexistente). O sistema responde de forma **genérica e indistinguível** — sem revelar se a
conta/e-mail existe (anti-enumeração) e sem expor qual conta foi recusada. Em modo _invite-only_,
usuários já cadastrados (convidados) continuam conseguindo entrar; não há fluxo de "conta
revogada" — a garantia desta story é a **neutralidade** da resposta, não uma mensagem específica
(ver research R-02).

**Why this priority**: Preserva a privacidade e dificulta a descoberta de contas válidas, sem
acrescentar override na assinatura — a resposta padrão genérica do provedor (erro de credenciais)
já satisfaz a anti-enumeração.

**Independent Test**: Tentar entrar com um e-mail fora da permissão e com um e-mail inexistente →
respostas **idênticas e genéricas** (erro padrão de credenciais), sem diferenciação.

**Acceptance Scenarios**:

1. **Given** um usuário tenta entrar com credenciais que não autorizam acesso, **When** ele envia o
   login, **Then** a resposta é **genérica** (erro padrão de credenciais do provedor, não a mensagem
   de acesso negado) e não menciona o motivo nem revela se a conta existe.
2. **Given** um e-mail **inexistente** na tela de login, **When** ele tenta entrar, **Then** a
   resposta é **neutra/genérica** — indistinguível da de um e-mail existente porém sem permissão
   (anti-enumeração).

---

### User Story 3 - Fluxo de login autorizado intacto (Priority: P2)

Um usuário **autorizado** (convidado/cadastrado com permissão) continua entrando normalmente: a
adição da mensagem de acesso negado **não regride** o caminho feliz de autenticação.

**Why this priority**: Garante que, ao melhorar o feedback de negação, não se quebre o acesso dos
usuários legítimos — equivalência obrigatória com o comportamento atual.

**Independent Test**: Um usuário autorizado entra normalmente e é direcionado ao playground;
nenhum erro espúrio de "acesso negado" aparece no caminho feliz.

**Acceptance Scenarios**:

1. **Given** um usuário autorizado, **When** ele entra com credenciais válidas, **Then** ele é
   autenticado e direcionado ao playground, **sem** ver nenhuma mensagem de acesso negado.
2. **Given** a mensagem de acesso negado implementada, **When** o caminho feliz de login roda,
   **Then** não há regressão de interferência (mensagens de acesso negado só aparecem para
   negações reais).

---

### Edge Cases

- **Deploy somente-demo (sem credenciais de autenticação)**: nenhum panel de acesso negado é
  exibido — apenas o painel da demo anônima (zero cookies), como hoje.
- **Erro desconhecido/transiente na autenticação** (rede, provedor indisponível): o usuário vê a
  mensagem localizada geral de erro de login (`signInError`), **não** a mensagem de acesso negado.
- **Rate limit atingido na autenticação**: comportamento existente (429 com mensagem localizada) —
  sem nova superfície.
- **Usuário autorizado que digita a senha errada**: erro normal de credenciais, sem relação com
  acesso negado.
- **Mensagens em pt-BR e en**: a mensagem de acesso negado aparece localizada em **ambas** as
  línguas suportadas; não pode haver string hardcoded.

## Requirements

### Functional Requirements

- **FR-001**: O sistema DEVE exibir uma mensagem **localizada e clara** de acesso negado quando um
  usuário sem permissão é recusado no login/cadastro.
- **FR-002**: A mensagem de acesso negado NÃO DEVE revelar **nenhum identificador** (e-mail, nome,
  id) nem o motivo detalhado da recusa (anti-enumeração e privacidade).
- **FR-003**: A resposta NÃO DEVE diferenciar um e-mail existente-sem-permissão de um e-mail
  inexistente — FR-003 é o **teste operacional** de FR-002 (a mesma cópia neutra de acesso negado
  cobre ambos os casos).
- **FR-004**: O usuário recusado DEVE continuar podendo acessar a demo anônima (rota pública, sem
  conta, zero cookies).
- **FR-005**: As mensagens de acesso negado DEVERÃO estar disponíveis nos catálogos de i18n
  suportados (pt-BR e en), sem strings hardcoded na tela.
- **FR-006**: Em um deploy somente-demo (autenticação não configurada), NÃO DEVE ser exibida
  nenhuma mensagem de acesso negado — apenas o painel da demo anônima.
- **FR-007**: Nenhuma informação de identidade (e-mail/nome) DEVE ser enviada aos provedores de
  LLM, logada ou persistida por causa desta mensagem. **Guard/fora-de-escopo para esta feature**: a
  tela de login (`/`) não invoca provedores de LLM; mantida como verificação defensiva (pass de
  privacidade T013), não como task de implementação.

### Key Entities

Esta feature **não introduz persistência nem novas entidades**. Não há banco, cache, cookie,
`localStorage` ou armazenamento durável.

## Success Criteria

### Measurable Outcomes

- **SC-001**: **100%** das tentativas de cadastro recusado (_invite-only_) resultam em uma
  mensagem localizada de acesso negado (sem erro genérico/vazio).
- **SC-002**: **Nenhuma** mensagem de acesso negado exibida em nenhum idioma contém identificador
  (e-mail/nome/id) — verificado por teste automatizado.
- **SC-003**: **100%** dos logins autorizados concluem sem exibir mensagem de acesso negado
  espúria (fluxo feliz intacto).
- **SC-004**: O caminho de acesso à demo anônima continua **100%** funcional para usuários
  recusados (rota pública sem cookie).

## Assumptions

- O controle de permissão usa **autoCadastro _invite-only_** — modo **restricted** do Clerk
  (painel do provedor de autenticação), não allowlist paga — o gating permanece no provedor, fora
  do código (continuação de spec 018 / ADR 0013).
- A mensagem de acesso negado **genérica** (sem motivo em detalhe) é a escolha correta para
  privacidade e anti-enumeração.
- A demo anônima (`/demo`) e o playground autenticado (`/form`, `/reader`) são preservados e
  isolados como hoje (spec 018 / ADR 0013); esta feature não altera a separação de cookies.
- As strings `accessDenied`/`signInError` existentes são a base; é permitido ajustá-las
  pontualmente desde que continuem localizadas e sem identificador.