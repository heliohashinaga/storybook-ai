# Feature Specification: Proteção anti-bot da rota demo (Cloudflare Turnstile)

**Feature Branch**: `feature/019-cloudflare-turnstile-demo`

**Created**: 2026-08-20

**Status**: Draft

**Input**: Descrição do usuário: "quero adicionar o Cloudflare Turnstile" e, após clarificação, "quero
proteger o demo".

## Resumo

A rota demo (`/demo`) é o único caminho público e **anônimo** (sem login, sem cookie, sempre
disponível) que dispara a geração de histórias. Como ela não tem gate de autenticação, qualquer
bot consegue inundá-la com requisições automatizadas — saturando o servidor (CPU/conexões) e
potencialmente tornando a demo indisponível. A feature adiciona uma **barreira anti-bot invisível e
não-interativa** no formulário de pedido da demo: antes de gerar, uma prova curta e de uso único
é emitida e verificada pelo servidor de forma **independente**. Sem prova válida, a geração não
acontece.

O que **não** muda (invariantes fundamentais): a demo permanece **anônima** (a prova não exige
cookie, não usa armazenamento persistente e não carrega identidade); o **playground autenticado**
(`/form`) e o **leitor da demo** (`/demo/reader`, somente leitura) não são afetados; o payload de
geração continua fechado (`ageBand|locale|theme|sceneCount`).

## Clarifications

### Decisões já tomadas em conversa

- Q: Turnstile fica no login, no `/demo` ou nos dois? → A: **proteger o `/demo`** (rota anônima
  pública sem auth). Login/sign-up e `/form` ficam intactos; o `/demo/reader` é somente leitura e
  não faz requisição de geração.
- Q: Modo do desafio? → A: **não-interativo / invisível** — o visitante humano não vê passo extra;
  a barreira age em segundo plano. A prova é **anônima, curta e de uso único**, sem cookie.
- Q: `/demo` acessível direto por URL (não precisa passar pela tela inicial)? → A: confirmado. Por
  isso a proteção fica **no próprio `/demo`**, não na tela inicial.
- Q: Se os serviços de verificação estiverem indisponíveis, o que fazer? → A: **fail-closed**
  (recusar com erro localizado e retryável) — nunca gerar sem verificação. Ver Assumptions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visitante anônimo gera uma história demo normalmente (Priority: P1)

Uma pessoa entra em `/demo`, escolhe tema/idade/cenas e clica em "Criar história". O desafio
anti-bot roda **invisível** (não-interativo), a prova é emitida automaticamente e a história é
gerada **sem passo extra visível** e **sem cookie/identidade**.

**Why this priority**: É o fluxo principal e o requisito de UX central — a proteção não pode criar
fricção para o humano nem violar o anonimato da demo.

**Independent Test**: Fluxo demo completo (tema/idade/cenas → gerar → ler) funciona de ponta a
ponta, com a barreira resolvendo em segundo plano, gerando a mesma história de hoje.

**Acceptance Scenarios**:

1. **Given** um visitante anônimo em `/demo`, **When** ele preenche o formulário e submete,
   **Then** a história é gerada com sucesso, sem interação extra visível e sem cookie/sessão.
2. **Given** um visitante anônimo, **When** ele confere o navegador, **Then** nenhum cookie,
   `localStorage` ou identificador é criado na rota demo.

### User Story 2 - Requisições automatizadas/bots são bloqueadas (Priority: P1)

Um bot que tenta inundar `/demo` sem resolver a prova anti-bot tem a requisição **recusada antes de
qualquer geração** — nenhum recurso de geração (mesmo o offline/demo) é dispendido.

**Why this priority**: É o objetivo de segurança da feature — derrubar o vetor de DoS automatizado
da única rota pública sem auth.

**Independent Test**: Requisições sem prova válida (ou com prova ausente/expirada/reutilizada) são
recusadas por `POST /api/stories` em modo demo, sem chamar o gerador (provider não invocado).

**Acceptance Scenarios**:

1. **Given** uma requisição demo sem prova, **When** chega ao servidor, **Then** é recusada e o
   gerador **não** é chamado.
2. **Given** uma prova já utilizada (replay), **When** reapresentada, **Then** é recusada.
3. **Given** uma prova expirada, **When** apresentada, **Then** é recusada.

### User Story 3 - Privacidade e superfícies intactas (Priority: P0 — invariante)

A demo continua **anônima** em identidade; o payload de geração permanece fechado
(`ageBand|locale|theme|sceneCount`); o `playground` autenticado e o `/demo/reader` não são
alterados. A única mudança registrada é o contato não-identificante com um serviço de
verificação de terceiros na rota demo.

**Why this priority**: É a identidade/não-negociável do projeto (AGENTS.md + Constitution). Nenhuma
relaxação pode ser silenciosa ou apagar o invariante de anonimato da criança.

**Independent Test**: Testes afirmam que a rota demo não emite cookie/identificador e que o payload
de `/api/stories` não aceita campo além do enum fechado; os caminhos `/form`, `/reader` e
`/demo/reader` continuam como estão.

**Acceptance Scenarios**:

1. **Given** uma requisição demo, **When** o payload contém algo além de `ageBand|locale|theme|
   sceneCount`, **Then** é rejeitado (mesmo invariante de hoje).
2. **Given** a rota demo, **When** um visitante acessa, **Then** não há cookie de sessão nem
   identificador; a prova anti-bot é **efêmera**, não persistida e não associada a história.
3. **Given** `/form` e `/demo/reader`, **When** usados, **Then** comportamento inalterado (playground
   sem desafio; reader somente leitura).

### User Story 4 - Degradação e opt-in (Priority: P2)

Quando a feature **não está configurada**, a demo se comporta exatamente como hoje (nenhuma
barreira). Quando configurada, mas o serviço de verificação está **indisponível**, o pedido é
recusado com uma mensagem **localizada e retryável** — sem gerar e sem quebrar o fluxo de forma
silenciosa.

**Why this priority**: Garante zero regressão em deploys sem a chave e uma falha clara (não
silenciosa) quando o terceiro falha.

**Independent Test**: Deploy sem configuração gera demo normalmente; deploy com configuração e
verificação indisponível retorna erro localizado retryável sem chamar o gerador.

**Acceptance Scenarios**:

1. **Given** demo sem configuração da proteção, **When** um visitante submete, **Then** a história
   é gerada como hoje (feature desligada).
2. **Given** proteção configurada, **When** o serviço de verificação está inacessível, **Then** o
   pedido é recusado com erro localizado retryável e nenhuma história é gerada.

### Edge Cases

- **Prova ausente** no pedido demo → recusa antes de gerar, com erro genérico (sem vazar detalhes
  da verificação).
- **Prova inválida/reutilizada/expirada** → recusa, gerador não invocado.
- **Serviço de verificação fora do ar** → erro localizado retryável (fail-closed), nunca geração
  sem verificação.
- **Feature desligada (sem chave/config)** → comportamento atual inalterado.
- **Widget de proteção não carrega no cliente** (rede do visitante) → submit bloqueado com
  mensagem acessível e retryável; nunca envia pedido sem prova.
- **Segunda submissão** do mesmo formulário (após falha) → novo desafio/prova é emitido; a prova
  antiga não é reutilizada.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A rota demo (`/demo`) MUST apresentar um desafio anti-bot **não-interativo/invisível**
  no pedido de história, resolvendo em segundo plano.
- **FR-002**: Cada pedido de geração da demo MUST carregar uma **prova única, curta e de uso único**
  emitida pelo desafio.
- **FR-003**: O servidor MUST verificar **de forma independente** cada prova, em `POST /api/stories`,
  **antes** de qualquer geração.
- **FR-004**: Um pedido demo sem prova válida MUST ser recusado **sem invocar o gerador** (mesmo o
  offline/demo).
- **FR-005**: Provas reutilizadas (replay) ou expiradas MUST ser recusadas.
- **FR-006**: Com a feature **desconfigurada**, a demo MUST se comportar como hoje (proteção
  desligada, sem regressão).
- **FR-007**: Com a feature configurada e o serviço de verificação **indisponível**, o pedido MUST
  ser recusado com erro **localizado e retryável** (nunca gerar sem verificação).
- **FR-008**: O playground autenticado (`/form`) MUST **não** exigir desafio (inalterado).
- **FR-009**: O `/demo/reader` MUST permanecer somente leitura e inalterado (nenhuma geração ali).
- **FR-010**: A prova/desafio MUST **não** criar cookie, usar armazenamento persistente nem
  transmitir identificador do usuário ou da criança.
- **FR-011**: O payload de geração MUST permanecer fechado (`ageBand|locale|theme|sceneCount`);
  a prova é transportada à parte (não amplia o corpo da entidade).

### Key Entities

A feature **não introduz persistência**. Única entidade efêmera:

- **Prova anti-bot (efêmera)**: token curto, anônimo, de uso único, emitido pelo desafio no cliente
  e validado no servidor. **Não** é armazenado, não é associado a história e não carrega
  identidade.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um humano gera uma história demo no **mesmo número de passos** de hoje (sem
  interação extra visível, dado o modo não-interativo).
- **SC-002**: **100%** das requisições demo sem prova válida são recusadas **antes** de qualquer
  geração (assert em teste).
- **SC-003**: A rota demo continua **sem cookie e sem identificador** (assert de privacidade em
  teste), mesmo com a proteção ativa.
- **SC-004**: Deploys sem a configuração se comportam **idênticos** ao atual (zero regressão).
- **SC-005**: Quando o serviço de verificação está indisponível, o visitante recebe um **erro
  localizado retryável** e **nenhuma** história é gerada (o gerador não é invocado).
- **SC-006**: `lint`/`format:check`/`typecheck` e cobertura exigida (≥90% no módulo de verificação)
  passam; `/form`, `/reader` e `/demo/reader` sem regressão de teste/visual.

## Assumptions

- The anti-bot applies **apenas** ao caminho anônimo da demo; o playground autenticado segue com
  auth + rate-limit por IP.
- Escolhido o modo **não-interativo (invisível)** por ser o de menor fricção e melhor privacidade
  (sem cookie, sem identidade).
- A prova é transportada **à parte** do corpo fechado da requisição, de modo a não ampliar o enum
  de entidades aceitas pelo servidor.
- A feature é **opt-in** via configuração; ausência de configuração = proteção desligada e
  comportamento atual.
- Decisão de segurança: **fail-closed** em indisponibilidade do verificador (nunca gerar sem
  verificação). (Se preferir fail-open, ajuste em clarificação — ver Open Questions.)
- A prova/desafio depende de um serviço de verificação de **terceiros**; isso é registrado como a
  relaxação documentada do "zero contato externo" da demo, **sem** relaxar o invariante de
  identidade/cookie.

## Non-Goals / Out of Scope

- Não alterar login/sign-up, `/form`, `/reader` ou `/demo/reader`.
- Não adicionar conta/identidade à demo.
- Não ampliar o payload de geração nem persistir qualquer prova/associação.
- Não redesenhar o rate-limit global (embora um cap de concorrência/justiça do bucket anônimo possa
  ser considerado complementar no `plan.md`).
- Não aplicar desafio aos modos autenticados de geração.

## Open Questions

- **Fail-closed vs fail-open** quando o verificador estiver fora do ar: assumido **fail-closed**
  (ver Assumptions). Confirmar se o dono prefere fail-open para evitar indisponibilidade total da
  demo em caso de degradação do terceiro.
- **Complementar com cap de concorrência/fairness server-side** no `POST /api/stories`: recomendado
  como segunda camada anti-saturação, independente da barreira. Confirmar inclusão (desejável).

## Dependencies / Assumptions

- Dependência externa: serviço de verificação anti-bot (Cloudflare Turnstile) — aceita para a demo.
- Requer configuração de par de chaves (pública para o cliente, secreta para o servidor). Sem ela,
  proteção desligada.
- Estrutura atual: `POST /api/stories` é o único ponto de entrada server-side para geração; a demo
  usa o runtime offline/determinístico; rate-limit por IP pseudo-anônimo vigora nas duas superfícies.
- Tests must stay hermetic: nothing may call a live verification service or use real keys.