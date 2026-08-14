# Feature Specification: Sistema multi-agente de geração de histórias

**Feature Branch**: `006-multi-agent-story-generation`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "quero que agents façam as ações das roles"

## Summary

Transformar a geração de histórias infantis de uma única chamada monolítica de provedor em um
pipeline **multi-agente coordenado e entregável**, no qual cada **agente executa de fato as ações
da sua role**: **Coordinator** (orquestra, retries e monta o resultado final), **Planner** (define
a estrutura de cenas), **Writer** (escreve a narrativa), **Moderator** (gata autoritativa de
segurança/tom/adequação etária), **Illustrator** (gera prompts de imagem em inglês e dispara a
geração de ilustrações) e **Reader** (lê em voz alta o texto da cena, gerando o áudio da narração
por voz). Isso concretiza a direção futura documentada em
`specs/001-personalized-story-generation/future-multi-agent-system.md`, sem alterar o contrato
HTTP/API, o modelo de dados `GeneratedStory`, a fronteira de privacidade nem o comportamento do
frontend.

A divisão em agentes torna cada estágio **independentemente controlável, testável e
(paralelizável onde seguro)**, mantendo **anonimato** e **segurança** como portas de primeira
classe em todas as etapas. O usuário final não percebe a mudança interna: recebe a mesma história
completa e ilustrada em um único resultado.

## Clarifications

### Session 2026-08-13

- Q: Como o áudio da leitura gerado pelo Reader chega ao leitor mantendo GeneratedStory inalterado? → A: Sob demanda — o Reader gera o áudio server-side e o leitor o busca por cena via endpoint dedicado; o payload `GeneratedStory` não embute áudio (reuso do padrão 004-ai-natural-tts).
- Q: Quantas tentativas no máximo o Coordinator deve executar para um estágio que falha por razão transitória antes de declarar falha? → A: Padrão de até 2 tentativas (1 retry) por estágio, com o máximo configurável via config (default 2).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Geração coordenada por agentes com pipeline funcional (Priority: P1)

O responsável (cuidador) solicita uma história informando apenas faixa etária, tema e idioma. Em
vez de uma única chamada de provedor, o sistema executa um pipeline coordenado: um **Planner**
define a estrutura de cenas, o **Writer** escreve a narrativa ajustada à faixa etária e tom, o
**Moderator** aprova segurança/tom/adequação, o **Illustrator** gera os prompts (em inglês) e
gatilha as ilustrações de cada cena aprovada, e o **Reader** lê em voz alta o texto de cada cena
(áudio narrativo). O **Coordinator** encadeia esses passos, aplica
política de retry limitado e monta a história final completa (narrativa + ilustrações).

**Why this priority**: É o coração da feature — sem agentes executando efetivamente suas ações não
há sistema multi-agente. Entrega o valor principal (pipeline estruturado, estágios testáveis) de
forma observável e é o primeiro passo que desbloqueia os demais.

**Independent Test**: Pode ser testado integralmente com o provedor fake determinístico: disparar
uma geração e verificar que cada role produziu sua saída (outline, narrativa, aprovação, prompts,
áudio narrativo), que a ordem foi respeitada e que o resultado final é uma história completa e válida.

**Acceptance Scenarios**:

1. **Given** um pedido válido (faixa etária, tema, idioma) e provedor fake, **When** a geração é
   disparada, **Then** o pipeline executa Planner → Writer → Moderator → Illustrator → Reader em
   sequência e retorna uma história completa (narrativa + todas as ilustrações).
2. **Given** uma geração em andamento, **When** qualquer agente falha de forma transiente, **Then**
   o **Coordinator** reexecuta com retry limitado (política bounded) e, persistindo a falha, retorna
   o erro tipado por estágio sem devolver história parcial.
3. **Given** uma geração concluída com sucesso, **When** o resultado é inspecionado, **Then** cada
   cena traz narrativa + ilustração, vozes/tom coerentes e prompts de imagem em inglês.

---

### User Story 2 - Moderator como gate autoritativo de segurança (Priority: P1)

Em qualquer estágio em que conteúdo não seguro, de tom inadequado ou fora da faixa etária seja
candidato a retorno, o **Moderator** atua como **porta autoritativa**: rejeita o candidato, o
sistema regenera **uma vez** com restrições mais fortes e, se ainda inseguro, retorna um erro
seguro genérico e localizado. Nenhum conteúdo inseguro é mostrado, logado ou retornado.

**Why this priority**: Segurança é requisito não-negociável do projeto (constitution/privacy). O
Moderator herda e formaliza o comportamento atual de "moderar → regenerar uma vez → senão erro" e o
torna responsabilidade explícita de um agente, garantindo a barreira em qualquer arquitetura.

**Independent Test**: Com o provedor fake configurado para produção de conteúdo inseguro,
verificar: (a) bloqueio no primeiro contato, (b) regeneração única com restrições mais fortes, (c)
se o segundo candidato ainda for inseguro, retorno de erro seguro localizado e (d) ausência de
conteúdo inseguro no log/resposta. Pode ser testado isoladamente do Illustrator/planner happy path.

**Acceptance Scenarios**:

1. **Given** um candidato inseguro produzido pelo Writer, **When** o Moderator o avalia, **Then**
   ele é bloqueado e o Writer regenera **uma única vez** com restrições mais fortes.
2. **Given** o candidato regenerado ainda inseguro, **When** o Moderator o avalia novamente, **Then**
   o sistema retorna um erro seguro, genérico e localizado, sem história parcial.
3. **Given** qualquer saída de agente avaliada pelo Moderator, **When** avaliada, **Then** o
   Moderator a aprova ou rejeita; nunca uma saída insegura chega ao resultado final ou aos logs.

---

### User Story 3 - Ilustrações por agente com prompts em inglês (Priority: P2)

O **Illustrator** recebe as cenas aprovadas, gera prompts de imagem **sempre em inglês** e dispara
a geração de ilustrações para cada cena. O texto narrativo/UI permanece localizado conforme
`locale` (`pt-BR` default, `en`), e os prompts de imagem em inglês não afetam o texto localizado do
leitor/alt-text.

**Why this priority**: Ilustrações são entrega visível e já existem no MVP; movê-las para um agente
dedicado completa a separação de responsabilidades. É P2 porque o valor central (pipeline
funcional + segurança) já está coberto por US1/US2, mas é indispensável para o produto sentir-se
idêntico ao atual.

**Independent Test**: Com provedor fake, verificar que cada cena aprovada obtém exatamente uma
ilustração, que todos os prompts são em inglês (independente do locale) e que nunca há uma série de
ilustrações parcial como resultado bem-sucedido (conjunto incompleto nunca vira "sucesso").

**Acceptance Scenarios**:

1. **Given** um conjunto de cenas aprovadas, **When** o Illustrator processa, **Then** cada cena
   recebe exatamente um prompt em inglês e uma ilustração.
2. **Given** locale `pt-BR` ou `en`, **When** o Illustrator gera prompts, **Then** os prompts são
   sempre em inglês, enquanto texto narrativo/UI e alt-text seguem o locale do pedido.
3. **Given** uma falha ao gerar ilustração de uma das cenas, **When** a geração termina, **Then** a
   resposta não é um sucesso parcial — a falha é tratada como erro tipado, não como história
   parcial com ilustrações faltando.

---

### User Story 3-b - Reader que lê o texto da cena em voz alta (Priority: P2)

O **Reader** recebe o texto narrativo localizado de cada cena aprovada e entrega o **áudio da
leitura em voz alta** (narração por voz). A narração é acionada pelo controle de leitura do leitor,
cobre `pt-BR` e `en` e integra-se à leitura por voz já suportada (feature `004-ai-natural-tts`),
sem exigir switch de usuário na tela.

**Why this priority**: A leitura em voz alta já é valor entregue pelo `004-ai-natural-tts`;
mover a geração do áudio narrativo para um agente dedicado completa a separação de
responsabilidades do pipeline multi-agente. É P2 porque o núcleo (pipeline funcional + segurança)
está em US1/US2, mas o Reader é parte integral da experiência multiagente de leitura.

**Independent Test**: Com provedor fake determinístico, verificar que cada cena obtém exatamente um
áudio narrativo coerente com seu texto localizado, que a saída está pronta para reprodução local e
que nunca há narração parcial como resultado bem-sucedido.

**Acceptance Scenarios**:

1. **Given** um conjunto de cenas aprovadas e localizadas, **When** o Reader processa, **Then** cada cena
   produz um áudio narrativo da leitura do texto correspondente, nos idiomas suportados (pt-BR e en).
2. **Given** a narração por voz de IA habilitada por config, **When** o usuário aciona o controle de leitura,
   **Then** o áudio é entregue e reproduzível localmente, com estado acessível (anúncio de ler/parar via `aria-live`).
3. **Given** uma falha ao gerar o áudio de uma das cenas, **When** o pipeline termina, **Then** a resposta não é
   um sucesso parcial — a falha é tratada como erro tipado, não como história parcial sem narração.

---

### User Story 4 - Orquestração com paralelização segura (Priority: P3)

O **Coordinator** orquestra o fluxo e, **onde seguro e economicamente vantajoso**, paraleliza
estágios independentes (por exemplo, Illustrator após aprovação das cenas) para respeitar o budget
de latência ≤120 s ponta-a-ponta. A ordem e as dependências corretas são mantidas: o Moderator
sempre opera sobre a saída do Writer; o Illustrator e o Reader nunca antecedem a aprovação da cena.

**Why this priority**: Garante que o sistema multi-agente não regrida no budget de performance
existente. É P3 (aperfeiçoamento) porque o pipeline serial já entrega valor completo; a
paralelização é um refinamento para caber dentro do orçamento e da experimentação de latência.

**Independent Test**: Com provedor fake instrumentado com timestamps/latência, verificar que (a) a
execução respeita as dependências (sem Write antes de Plan, sem Ilustração antes de Review) e (b)
o tempo total ponta-a-ponta fica dentro do budget definido, medindo o ganho relativo à versão
estritamente serial.

**Acceptance Scenarios**:

1. **Given** uma geração, **When** o Coordinator orquestra, **Then** nenhum estágio executa antes
   de suas dependências satisfeitas (Planner → Writer → Moderator; Illustrator após aprovação).
2. **Given** o perfil de latência do provedor fake, **When** a geração roda, **Then** o tempo
   ponta-a-ponta respeita o budget definido, sem regressão em relação à estimativa serial.

---

### Edge Cases

- **Falha transiente de um agente**: risco de ambiente/não-cobertura é absorvido pelo retry bounded
  do Coordinator (padrão até 2 tentativas / 1 retry por estágio, máximo configurável); a falha
  persistente gera erro tipado por estágio, nunca história parcial.
- **Candidato inseguro após regeneração**: o Moderator bloqueia e o sistema retorna erro seguro
  genérico e localizado (comportamento "moderar → regenerar uma vez → senão erro").
- **Ilustração parcial**: uma falha de ilustração em uma cena nunca vira um "sucesso" com conjunto
  incompleto — o conjunto parcial é tratado como erro tipado.
- **Conflito de idiomas**: prompts de imagem sempre em inglês, independente do locale; o texto
  de UI/narrativa/alt-text segue o locale do pedido (pt-BR default, en).
- **Header de uma única cena**: o pipeline precisa suportar o mínimo de cenas (3 default) e o
  máximo variável (até 5, c.f. `002-generate-more-scenes`), com ilusrações correspondentes.
- **Provedor indisponível para uma capacidade**: como o roteamento por capacidade (feature
  `005-multi-provider-generation`) pode rotear cada capacidade a provedores distintos, uma falha em
  uma capacidade é tratada no nível do agente responsável, mantendo o restante consistente.
- **Rate limiting / throttling (429)**: o pipeline utiliza o `rateLimiter` injetado no
  `generation-runtime` (rate limit por hash de IP, sem identificar o usuário). Quando um estágio
excede o limite (429), o Coordinator trata a falha como transitória com retry bounded (FR-006-b) e,
persistindo, retorna erro tipado de throttling — sem expor detalhes que identifiquem o usuário.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE expor uma pipeline multi-agente em que cada role tem um agente
  executando suas ações — **Coordinator**, **Planner**, **Writer**, **Moderator** e **Illustrator** —
  substituindo a chamada monolítica atual de geração completa.
- **FR-002**: O **Planner** DEVE produzir a estrutura de cenas (outline) derivada apenas de faixa
  etária, tema e locale; o número de cenas DEVE respeitar a faixa variável (3 default, até 5).
- **FR-003**: O **Writer** DEVE escrever a narrativa a partir do outline, ajustando vocabulário e
  tom à faixa etária (`2-4 | 5-7 | 8-9`) e ao tema.
- **FR-004**: O **Moderator** DEVE validar segurança, tom e adequação à faixa etária de cada
  candidato e atuar como **porta autoritativa**; ao rejeitar, DEVE disparar **uma única**
  regeneração com restrições mais fortes e, se ainda inseguro, retornar erro seguro genérico e
  localizado.
- **FR-005**: O **Illustrator** DEVE gerar prompts de imagem **sempre em inglês** para cada cena
  aprovada e disparar a geração de ilustrações; um conjunto parcial de ilustrações NUNCA é um
  sucesso — a falha vira erro tipado.
- **FR-005-b**: O **Reader** (expositor/narrador da leitura — também grafado *Speaker*/*Speacher*)
  DEVE ler em voz alta o texto da cena, entregando áudio narrativo localizado por cena (suporte `pt-BR`
  e `en`, alinhado ao `004-ai-natural-tts`); uma narração parcial NUNCA é sucesso — a falha vira erro tipado.
  O áudio DEVE ser entregue **sob demanda**: gerado server-side e buscado pelo leitor por cena via
  endpoint dedicado, sem embutir áudio no payload `GeneratedStory`. A busca por cena reutiliza o
  endpoint existente `POST /api/narrate` (a chamada passa o texto localizado da cena; cada cena gera
  o seu áudio por chamada) — não é criada uma nova rota dedicada.
- **FR-006**: O **Coordinator** DEVE orquestrar os estágios respeitando as dependências (Planner →
  Writer → Moderator, Illustrator e Reader após aprovação), aplicar retry limitado e montar o
  resultado final completo (narrativa + ilustrações).
- **FR-006-b**: A política de retry do Coordinator DEVE ter como padrão **até 2 tentativas (1 retry)** por
  estágio que falha de forma transitória (incluindo throttling 429), com o máximo de tentativas
  **configurável via config** (não exposto ao usuário) e dentro do orçamento de latência ponta-a-ponta.
  *(Detalha o "retry limitado" de FR-006.)*
- **FR-007**: O sistema DEVE preservar a fronteira de privacidade/anônimo: nenhum agente recebe
  nome ou identificador direto; apenas faixa etária derivada, locale e tema permitido transitam.
  (c.f. FR-010 original; aplica-se uniformemente a cada agente.)
- **FR-008**: O sistema DEVE usar apenas conteúdo seguro: todo retorno passou pelo Moderator; nada
  inseguro é mostrado, logado ou retornado.
- **FR-009**: O resultado final DEVE permanecer compatível com o contrato HTTP/API atual
  (`story-generation.openapi.yaml`) e com o modelo `GeneratedStory`, sem alterar cliente, reader,
  exportação, fixtures nem testes existentes.
- **FR-010**: O texto narrativo/UI DEVE seguir o `locale` (`pt-BR` default, `en`); prompts de
  imagem permanecem em inglês.
- **FR-011**: O sistema DEVE manter os budgets de performance existentes (geração completa ≤120 s
  ponta-a-ponta; navegação de cena ≤100 ms; bundle inicial ≤250 KiB gzip).
- **FR-012**: Todo agente DEVE ser acionável e testável em isolamento, permitindo testes unitários
  e fakes determinísticos por papel.

### Key Entities

- **Agente (Role)**: unidade responsável por uma etapa (Coordinator, Planner, Writer, Moderator,
  Illustrator, Reader); possui responsabilidade, ações de saída e política de erro. Sem entidade
  persistente — instâncias transitórias em memória.
- **Outline (Estrutura de cenas)**: saída do Planner — lista ordenada de cenas com propósito/tema;
  atributos: ordem, idioma, tema. Consumida pelo Writer.
- **Cena (Scene)**: unidade do resultado final — concatenando narrativa (localizada) e ilustração
  (derivada de prompt em inglês) e áudio narrativo (derivado do texto localizado pelo Reader);
  atributos: índice, texto narrativo, prompt de imagem, ilustração, narração em voz.
- **Status de Segurança (Safety Veredict)**: resultado do Review — aprovado/rejeitado, motivo;
  consumido pela orquestração para decidir regeneração ou erro seguro. Chave para o gate
  autoritativo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um pedido válido gera uma história completa (narrativa + todas as ilustrações,
  número correto de cenas) sem que o usuário perceba a mudança interna de arquitetura,
  em 100% dos casos de sucesso com provedor fake.
- **SC-002**: O tempo ponta-a-ponta de geração completa (até 5 cenas) respeita o budget existente
  (≤120 s), medido com provedor fake determinístico.
- **SC-003**: 100% dos candidatos inseguros são bloqueados pelo Moderator antes de qualquer retorno
  ou log; a regeneração única é disparada e, se persistir insegurança, um erro seguro e localizado
  é retornado.
- **SC-004**: 0% de resultados com conjunto de ilustrações parcial como sucesso — uma falha de
  ilustração nunca entrega uma resposta que pareça completa porém incompleta.
- **SC-005**: 100% de conformidade de privacidade: nenhum agente recebe, loga ou retorna nome ou
  identificador direto (testado automaticamente em cada estágio), inclusive o Reader, que recebe
  apenas o texto localizado da cena, nunca qualquer identificador.
- **SC-006**: O contrato HTTP/API e o modelo `GeneratedStory` permanecem inalterados — nenhum
  teste existente, fixture ou comportamento de frontend regride.
- **SC-007**: 100% dos agentes são testáveis isoladamente e os testes são determinísticos; a
  cobertura de unit/contrato do pipeline alcança os limiares definidos (≥80% geral; ≥90% nos eixos
  safety/validation/orchestration).
- **SC-008**: Texto narrativo/UI é entregue no locale correto (`pt-BR`/`en`) e todos os prompts de
  imagem são em inglês, em 100% das gerações testadas.
- **SC-009**: Em 100% das gerações testadas, cada cena obtém um áudio narrativo (leitura em voz alta)
  coerente com o texto localizado, nos idiomas suportados, e nunca há narração parcial como sucesso.
  *(SC-009 mede a produção do áudio; SC-010 mede a entrega/transporte por cena.)*
- **SC-010**: Em 100% dos casos, o áudio narrativo é entregue sob demanda por cena — o leitor busca
  o áudio de cada cena via `POST /api/narrate` (texto localizado da cena), mantendo o payload da
  resposta (`GeneratedStory`) sem áudio embutido e consistente com SC-006 e FR-005-b.

## Assumptions

- **Roles = MAS documentado (decisão A)**: "roles" refere-se às responsabilidades dos agentes de
geração de histórias concretizados aqui — **Coordinator, Planner, Writer, Moderator, Illustrator** e
**Reader** (novo) — cada um executando de fato suas ações. A interpretação foi confirmada pelo
usuário como a do `future-multi-agent-system.md`, e não roles de orquestração/crew externa.
- **Nome do agente de voz**: a role que lê o texto da cena em voz alta é chamada de **Reader** (o
"expositor/narrador" da leitura — também grafado *Speaker*/*Speacher*); "Reader" é o nome canônico,
sem implicar engine de voz específico.
- **Reader / leitura por voz**: o Reader concretiza a leitura em voz alta do texto da cena, na linha
do `004-ai-natural-tts` (voz de IA controlada por config; sem switch de usuário na tela; voz fixa
por idioma). A geração de áudio narrativo é atribuição do Reader dentro do pipeline multi-agente.
- **Entrega de áudio sob demanda**: o áudio narrativo do Reader é entregue sob demanda — gerado
server-side e buscado pelo leitor por cena via endpoint dedicado — jamais embutido no payload
`GeneratedStory`, preservando assim o contrato (SC-006) e o bundle inicial. A entrega por cena reusa o
endpoint existente `POST /api/narrate` (texto localizado da cena); detalhes restantes (cache) são
decisão de `/speckit.plan`.
- **Orquestração**: a escolha de mecanismo (funções tipadas em processo vs. framework de
  orquestração) é decisão de implementação para `/speckit.plan`, resolvida via spike; cada agente
  permanece acionável/testável isoladamente.
- **Paralelização**: apenas estágios seguros e independentes são candidatos a paralelo; a versão
  serial completa é o baseline garantido.
- **Latência**: medir antes de relaxar/paralelizar; o budget existente (≤120 s) é o contrato atual
  a preservar.
- **Contrato preservado**: `story-generation.openapi.yaml` e `GeneratedStory` não mudam; os
  agentes implementam a fronteira existente (`story-generation-provider.ts`).
- **Localização**: segue `locale` (pt-BR default, en); prompts de imagem sempre em inglês.
- **Ambiente**: em `STORIES_TEST_MODE=fake`, o provedor é determinístico e nunca chama AI real.
