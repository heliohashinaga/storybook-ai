# Feature Specification: Leitura por voz com TTS de IA (voz mais natural)

**Feature Branch**: `004-ai-natural-tts`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "quero usar um modelo de IA para a leitura do texto ser mais natural"

> **Relação com ARTEADOS existentes**: esta feature retoma o **ADR 0007** (`0007-tts-ai-openrouter-as-future-improvement.md`, status *Proposed*), que registra os custos, alternativas e gatilhos de reavaliação para o TTS de IA. Este especifica o comportamento por trás dessa evolução. Os invariantes de anonimato do projeto (AGENTS.md) permanecem não-negociáveis e são reforçados abaixo.

## Clarifications

### Session 2026-08-20

- Q: A narração de IA deve estar ativa por padrão ou requerer ativação pelo usuário na tela? → A: **Não há switch de ativação de usuário na tela.** A narração por voz de IA é controlada por **configuração/environment** via `AI_NARRATION_ENABLED`. Quando habilitada por config, o controle de leitura usa a voz de IA; quando desabilitada (default seguro), usa a voz de sistema (Web Speech) ou o fallback/desabilitado da FR-006. Preserva a postura "nada sai do dispositivo" quando a IA está desligada por config, sem adicionar um toggle de usuário na UI.
- Q: Existe `AI_NARRATION_ENABLED` e ela liga/desliga a IA para o usuário? → A: **Sim** — `AI_NARRATION_ENABLED` (env/config, server only) controla o uso da narração por IA; **não** há preferência/toggle de usuário na sessão nem na tela para isso. O default é desabilitada (`false`), caso em que o controle usa voz de sistema.
- Q: Deve haver seleção de voz de narrador? → A: **Voz de IA fixa (sem seletor).** Um único narrador de IA é usado (a voz disponível para o idioma ativo pt-BR/en); sem palito/UI de escolha de voz nesta versão. Fica fora de escopo a seleção por voz (pode vir numa evolução futura).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ler uma história com narração em voz natural gerada por IA (Priority: P1)

Ao acompanhar uma história gerada, o responsável (adulto lendo junto com a criança) poderá tocar no controle de leitura em voz alta e ouvir a cena atual narrada com uma **voz natural de IA**, perceptivelmente mais fluida e agradável que a voz sintética de sistema (Web Speech) usada hoje. O uso da voz de IA é controlado por **configuração (`AI_NARRATION_ENABLED`)** — **não** há switch de ativação de usuário na tela nem preferência de sessão; quando a config habilita a IA, aplica-se a todas as cenas, nos idiomas suportados (pt-BR e en), preservando a experiência atual de *single start/stop* (sem botão de pausa dedicado) e a interrupção ao navegar entre cenas. Usa-se uma **voz de IA fixa** (a disponível para o idioma), sem seletor.

**Why this priority**: É o pedido central da feature — a qualidade da voz é a motivação declarada. Sem a narração natural, a feature não existe; portanto é a fatia de maior valor e deve ser a primeira entregável.

**Independent Test**: Pode ser testado isoladamente abrindo uma única história (provider fake/determinístico), acionando o controle de leitura e verificando que (a) o áudio é entregue pronto para reprodução localmente, (b) a voz reconhecível é diferente/mais natural que a de sistema, e (c) o comportamento de start/stop e troca de cena continua válido — tudo com zero chamada de rede a um serviço de voz real (mock/hook que responde com áudio determinístico).

**Acceptance Scenarios**:

1. **Given** uma história já gerada com 3+ cenas **e** `AI_NARRATION_ENABLED=true` (config) **When** o responsável aciona o controle de leitura na cena atual **Then** a narração inicia via áudio de IA (voz natural), coberta por indicação de estado acessível (anuncia "lendo" e o retoma/parado via `aria-live`), sem exigir outra ação extra.
   - **Caso base (IA desativada por config)**: **Given** `AI_NARRATION_ENABLED=false` **When** o responsável aciona o controle de leitura **Then** o app usa a voz de sistema (Web Speech); o texto é legível e não há custo/uso de IA, sem qualquer switch de usuário na tela.
2. **Given** a narração da cena em andamento **When** o responsável navega para outra cena **Then** a narração é interrompida e não continua em voz em outro contexto.
3. **Given** o leitor na cena final **When** o controle de leitura é acionado e termina o texto **Then** o áudio para corretamente e o controle retorna ao estado "pronto", com anúncio acessível de fim.

---

### User Story 2 - Erro controlado quando a narração por IA ativa falha (Priority: P2)

Quando a narração por IA estiver **ativada** (`AI_NARRATION_ENABLED=true`) e o provedor de áudio falhar (ex.: fora do ar, timeout, ou erro), o responsável recebe um **erro acessível e compreensível** — a narração não inicia e não há qualquer queda silenciosa para a voz de sistema. O texto da cena permanece legível e o usuário pode tentar novamente; se a IA estiver **desativada** (`false`), o controle usa a voz de sistema (Web Speech) normalmente, sem envolver o provedor de IA.

**Why this priority**: Com IA `true`, o produto promete voz de IA; mascarar a falha com Web Speech seria enganoso e esconderia problema de provider/custo. Um erro claro é melhor que um fallback silencioso. É importante mas não é o pedido central — vem depois do caminho feliz.

**Independent Test**: É testável isoladamente forçando o provedor de áudio de IA a falhar (fake que retorna não-2xx/timeout) e verificando que (a) o controle entra em estado de erro com mensagem acessível, (b) **não** é tocado áudio de Web Speech, e (c) o texto da cena permanece legível e há nova tentativa disponível.

**Acceptance Scenarios**:

1. **Given** `AI_NARRATION_ENABLED=true` **e** o provedor de áudio de IA indisponível para a cena **When** o responsável aciona o controle de leitura **Then** o app mostra estado de erro acessível (anúncio de falha via `aria-live`), a narração não inicia, e **nenhum** áudio de Web Speech é tocado; o texto permanece legível.
2. **Given** falha persistente do provedor **When** o responsável repete **Then** o app não tenta infinitamente (limite de tentativas/backoff) e mantém o texto legível com a opção de nova tentativa; em último recurso, o controle fica em estado de erro/desabilitado com mensagem localizada.

### User Story 3 - Gerar a narração natural sob demanda, sem persistir áudio (Priority: P2)

A narração deve ser **gerada no momento em que o usuário toca em "ouvir"** (sob demanda), reproduzida localmente e **não persistida** em nenhum armazenamento durável (sem cache, sem cookies, sem localStorage, sem banco). Recarregar a página não re-apresenta áudio guardado; o áudio existe apenas na resposta em memória para a reprodução imediata.

**Why this priority**: Preserva o invariante central de anonimato "zero persistência" do projeto (AGENTS.md) e mantém a experiência anônima por design, mesmo ao introduzir um serviço externo de voz. É prioritário por ser um requisito de conformidade, não apenas estético.

**Independent Test**: Testável isoladamente gerando uma história e, após reproduzir a narração, recarregando a página: o áudio não reaparece; nenhum endpoint de voz é chamado fora do pedido explícito ("ouvir"); e uma inspeção de rede confirma que nenhum recurso de áudio é baixado antes do usuário acionar o controle.

**Acceptance Scenarios**:

1. **Given** uma história já exibida **When** o responsável ainda não tocou em "ouvir" **Then** nenhuma chamada de geração de áudio ocorre (não há pré-busca).
2. **Given** o responsável reproduziu a narração **When** recarrega a página **Then** não existe áudio armazenado; a página volta ao estado limpo (sem áudio em cache).
3. **Given** a geração sob demanda **When** o áudio é entregue **Then** nenhum cookie/localStorage/armazenamento durável é escrito em nome da narração.

---

### Edge Cases

- **Cena com texto muito curto ou muito longo**: o texto de cada cena é limitado por faixa-etária; o TTS deve lidar com entradas curtas/longas sem erro, truncamento silencioso ou entonação quebrada (caso limite de contagem de caracteres do provedor).
- **Voz indisponível no idioma da história**: se o idioma ativo (pt-BR ou en) não tiver voz no provedor, o app não deve tentar um idioma errado; **com IA ativa (`true`) exibe erro controlado acessível** (sem cair para a voz de sistema); **com IA desativada (`false`) usa a voz de sistema no mesmo idioma** ou desabilita com mensagem localizada.
- **Limites de caracteres por requisição**: cenas que ultrapassem o teto do provedor devem ser divididas/fatiadas pelo servidor (server-only) dentro dos limites de resposta, sem expor isso ao usuário.
- **Falha parcial na troca de cena**: se a narração de uma cena falha mas a cena é navegável, o app não deve travar a navegação; o usuário pode seguir e tentar ouvir de novo.
- **Múltiplas cenas rápidas**: acionar "ouvir" e trocar de cena rapidamente não deve encadear narrações acumuladas (overflow/sobreposição de áudio).
- **Repeatedamento com cena idêntica**: reproduzir a mesma cena de novo deve regenerar/entregar áudio consistente, sem erros por "já gerado antes" persistido.
- **Sem rede no navegador**: se não há conectividade para buscar o áudio servido, o app sinaliza estado de erro/indisponibilidade e usa o fallback de voz de sistema, se disponível.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir ao responsável ativar a **narração por voz de IA** (voz natural) para a cena atual de uma história, nas línguas pt-BR e en, por um controle de leitura acessível (iniciar/parar) e com anúncio `aria-live`/`aria-busy` do estado.
- **FR-002**: A narração por IA DEVE ser gerada **sob demanda** (somente quando o usuário aciona "ouvir"), ficando atrás do adapter **server-only** (nunca chamada de TTS no bundle/cliente; chave/provedor nunca expostos no cliente).
- **FR-003**: O áudio gerado por IA DEVE ser **não persistente** — nenhum cookie, localStorage, indexedDB, storage durável ou cache de áudio; a narração existe apenas em memória para a reprodução imediata da resposta (cada "ouvir" regenera ou re-serve de forma volátil).
- **FR-004**: O sistema DEVE preservar o **contrato anônimo**: a chamada de TTS recebe apenas o **texto da cena** sem qualquer identificador (sem nome, idade exata, e-mail, id de sessão); nenhum identificador direto é transmitido, logado ou armazenado em nome da narração.
- **FR-005**: A narração DEVE ser **interrompida** ao navegar para outra cena e deve parar corretamente ao terminar o texto, retornando o controle ao estado "pronto".
- **FR-006**: A narração por voz de IA DEVE estar **desativada por padrão** (`AI_NARRATION_ENABLED=false`), em que caso o controle de leitura usa a **voz de sistema (Web Speech)**, sem envolver o provedor de IA. Quando ativada (`true`), **NÃO há fallback** para a voz de sistema: se o provedor falhar, exibe-se **erro acessível e compreensível**, mantendo o texto legível; se não houver voz no idioma no provedor, o controle fica em estado de erro/desabilitado com mensagem localizada (texto sempre legível).
- **FR-007**: Com a IA ativada (`true`) e falha do provedor, o sistema DEVE tratar como **erro controlado** (sem retry infinito; limite de tentativas/backoff), apresentando uma mensagem acessível e mantendo o texto da cena legível — nunca história/áudio parcial nem queda silenciosa para Web Speech.
- **FR-008**: O sistema DEVE respeitar o **budget de performance** vigente (JS inicial ≤250 KiB gzip, LCP p75 ≤2.5s, navegação de cena ≤100ms p75, geração completa ≤120s) e **não** carregar pesos/recursos de TTS no bundle inicial.
- **FR-009**: O sistema DEVE honrar `prefers-reduced-motion` e os requisitos de acessibilidade AA (contraste/foco/teclado) para todos os novos estados do controle de leitura.

*Examples de requisitos a clarificar (ver Perguntas):*

- **FR-010**: O sistema DEVE obter a voz por IA de forma **server-only controlada por `AI_NARRATION_ENABLED`** (env, sem switch de usuário na tela ou na sessão): quando a config habilita a IA (`true`) E o provedor de fala responde, o texto anônimo da cena é enviado pela fronteira do servidor ao TTS de IA para gerar voz natural; quando `false`, o controle usa a voz de sistema; quando `true` mas o provedor falha, o sistema **NÃO** transita para Web Speech — apresenta **erro acessível** (US2). Aceita-se que o **texto da cena** trafegue da fronteira do servidor ao provedor **somente** quando a IA ativa estiver fazendo a chamada, e **jamais** um identificador. Usa-se uma **voz de IA fixa**, sem seletor.
- **FR-011**: A qualidade/naturalidade do TTS DEVE ser **configurável** via `TTS_MODEL` (perfil custo-vs-naturalidade: custo-eficiente ou premium), escolhendo o modelo por ambiente — sem knob de custo por narração (não há teto de custo por env).

### Key Entities *(include if feature involves data)*

- **Texto da cena**: conteúdo de texto da história (o único dado enviado ao TTS); usado para geração de áudio; não identificador.
- **Metadados de narração** (em memória, não persistidos): estado do controle (pronto/lendo/parando), idioma ativo e cena atual — orquestram a UX, nunca formam um registro durável.
- **Áudio da resposta (volátil)**: o áudio é um artefato transitório entregue para reprodução imediata e descartado; não é uma entidade persistida.
- **Nota (anonimato)**: o modelo de entidades não introduz qualquer identificador; a feature depende apenas do texto anônimo da cena e dos metadados de sessão em memória existentes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O responsável consegue ativar a narração por voz de IA em uma cena e ouvi-la de forma audível e completa, do início ao fim, **sem instrução adicional** (roteiro E2E determinístico + observação com participantes), em pt-BR e en.
- **SC-002**: A percepção de naturalidade da voz de IA é **avaliada como superior** à voz de sistema. O critério observável (teste A/B determinístico verificável em CI) é: o caminho de IA é selecionado quando `AI_NARRATION_ENABLED=true`, com áudio reconhecidamente distinto/mais natural que o de sistema (proxy de unidade T017). O estudo com participantes (preferência IA ≥80% dos pares) é uma **métrica pós-lançamento/observacional**, documentada no `quickstart.md`, e NÃO é gate de CI.
- **SC-003**: **Zero persistência**: nenhuma narração é armazenada — recarregar a página não re-apresenta áudio, e a inspeção de rede/storage confirma ausência de cookies/localStorage/armazenamento durável criados pela narração.
- **SC-004**: **Contrato anônimo mantido**: nenhum identificador direto aparece no payload/logs em nome da narração (verificado por testes de invariante de privacidade), e apenas o texto da cena é enviado ao TTS.
- **SC-005**: O budget de performance é mantido: JS inicial ≤250 KiB gzip (nenhum recurso/peso de TTS no bundle inicial), LCP p75 ≤2.5s, navegação de cena ≤100ms p75; narração adicional não degrada esses valores.
- **SC-006**: Comportamento de erro quando a IA ativa falha: para **todos os cenários determinísticos de indisponibilidade do provedor de TTS** (simulados em teste: erro de upstream, timeout, sem-rede, sem-voz-no-idioma), com `AI_NARRATION_ENABLED=true` a leitura não inicia e o usuário recebe **erro acessível e compreensível** — **nenhum** áudio de Web Speech é tocado como fallback e o texto da cena permanece legível; zero queda silenciosa em toda a suíte de erro (T019–T025).
- **SC-007**: Modelo de voz configurável por ambiente: `TTS_MODEL` permite escolher, sem tocar em código, entre perfil **custo-eficiente** (voz claramente mais natural que a de sistema, custo desprezível) e **premium** (voz mais natural, custo maior) — verificado por teste de contrato/env que cada capacidade resolve o modelo certo; sem teto de custo por narração (não há knob).

## Assumptions

- **Server-only boundary**: a chamada de TTS de IA acontece no servidor (adapter `server-only`, como a geração), nunca no cliente; a chave do provedor vive apenas em `.env` e não é exposta. (Consistente com ADR 0007 e AGENTS.md.)
- **Topologia (Q1-C)**: a IA é usada **quando ativada** (`AI_NARRATION_ENABLED=true`) e o provedor responde, via fronteira do servidor; se o provedor falhar, apresenta-se **erro acessível** (não há fallback para a voz de sistema). O texto da cena trafega ao provedor de IA **somente nesse caminho ativo**, e **apenas o texto** (nunca um identificador) — alinhado com a geração de história existente.
- **Configuração custo-vs-naturalidade (Q2-C)**: o perfil de TTS (custo-eficiente vs premium) é definido por configuração/ambiente via `TTS_MODEL`, permitindo trocar sem tocar em código; **não** há teto de custo/uso por narração.
- **Ativação por config, sem switch de usuário (clarificação)**: o uso da voz de IA é controlado por `AI_NARRATION_ENABLED` (env, server-only); **não** existe toggle de ativação de usuário na tela nem preferência de sessão. Default `false` ⇒ voz de sistema; `true` ⇒ IA (com erro acessível se o provedor falhar — sem fallback à Web Speech). Isso preserva a postura "nada sai do dispositivo" quando desligado por config.
- **Voz fixa, sem seletor (clarificação)**: usa-se um único narrador de IA (a voz disponível para o idioma ativo pt-BR/en); seleção de voz fica fora de escopo nesta versão (evolução futura).
- **Envio do texto da cena**: enviar o **texto anônimo da cena** ao provedor de voz pela fronteira do servidor (no caminho ativo da IA, server-only) é aceitável e **não** configura violação de anonimato — nenhum identificador é transmitido; o mesmo texto já é enviado à geração de história.
- **Geração sob demanda**: a narração é gerada no momento em que o usuário toca "ouvir"; sem pré-busca, sem storage. (Consistente com a UX atual de start/stop.)
- **Sem persistência**: áudio é transitório/volátil (em memória, para reprodução imediata); nada é gravado. Preserva a regra "no persistence" do projeto.
- **Idiomas do provedor**: assume-se que o provedor escolhido oferece voz de qualidade em **pt-BR e en** (os idiomas do app). Se não, com a IA ativa (`true`) a ausência de voz no idioma é tratada como **erro acessível** (sem fallback); com a IA desativada (`false`), usa-se a voz de sistema no mesmo idioma.
- **Custo/naturalidade (defaults do perfil configurável)**: no perfil custo-eficiente, alvo = **mais natural que sistema** (sem "human-clone"); o modelo é escolhido por `TTS_MODEL` (referência do ADR 0007: ex. Kokoro $0.62/M), sem teto de custo por narração.
- **Sem clone de voz / vozes custom**: fora de escopo; usa-se voz(es) prontas do provedor, sem upload/perfilagem.
- **Sem SSML avançado**: foco em leitura limpa/fluida; controles expressivos avançados (emoção/ritmo fino) fora de escopo na v1.
- **Fully anonymous**: a feature não coleta/invoca login; segue o acesso anônimo do app (sem usuário). Exata idade continua apenas em memória (banda derivada no cliente).
