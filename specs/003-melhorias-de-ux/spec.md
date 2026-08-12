# Feature Specification: Melhorias de UX

**Feature Branch**: `003-melhorias-de-ux`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "melhorias de ux" — melhorar a experiência de uso do gerador de histórias infantis (anonymous by design), tornando o primeiro contato mais claro, o leitor mais imersivo e o feedback de ações mais evidente, mantendo todos os invariantes de anonimato, acessibilidade e performance do produto existente.

**Scope clarification**: o produto é anônimo por design — não se captura nome ou identificador direto. As melhorias de UX NÃO adicionam cadastro, coleta de dados ou persistência; apenas refinam a apresentação, o feedback e a interação dentro do fluxo já existente (form → geração → leitura → exportação).

## Clarifications

### Session 2026-08-20
- Q: O modo escuro entra nesta mesma entrega de "melhorias de ux"? → A: Sim, incluir o modo escuro nesta entrega (Option A).

### Session 2026-08-12
- Q: Onde a leitura em voz alta deve ser aplicada — apenas nas cenas do leitor ou também nos elementos do formulário? → A: Apenas nas cenas da história no `story-reader` (escopo atual do spec).
- Q: O indicador de progresso deve acompanhar o total variável de cenas (3–5) ou apenas o caso fixo de 3? → A: Acompanhar o total variável (3–5); o indicador reflete o total real da história.
- Q: O controle de leitura em voz alta deve oferecer pausar/retomar, ou apenas iniciar/parar? → A: Apenas iniciar/parar (um único controle; o estado `paused` do Web Speech permanece interno, sem botão de pausa dedicado).
- Q: O modo escuro deve permitir uma escolha manual (mesmo que só na sessão) ou apenas seguir o sistema? → A: Seguir o sistema **e** oferecer um alternador manual transitório na sessão (não persistido).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Escolher um tema de forma visual e clara (Priority: P1)

Um pai (ou responsável) seleciona o tema da história por uma escolha **visual** com nome e descrição no idioma ativo, em vez de uma lista genérica. A seleção deixa claro o significado de "Coragem", "Amizade" e "Bondade" e reforça a confiança e o prazer do primeiro contato.

**Why this priority**: a escolha de tema é a primeira decisão significativa do usuário — melhorar sua apresentação tem o maior impacto na experiência inicial e no "delight" do adulto que gera a história.

**Independent Test**: Abrir o formulário no idioma pt-BR e confirmar que cada tema é apresentado como uma opção visual com um rótulo e uma breve descrição localizados; mudar para English e confirmar que os rótulos/descrições seguem o idioma ativo.

**Acceptance Scenarios**:

1. **Given** um pai no formulário, **When** visualiza as opções de tema, **Then** cada tema (Coragem, Amizade, Bondade em pt-BR) aparece como uma escolha visual com nome e descrição clara, sem código de identificação visível.
2. **Given** o mesmo pai troca o idioma para English, **When** observa as opções, **Then** os nomes e descrições dos temas aparecem em inglês (Courage, Friendship, Kindness).
3. **Given** um tema selecionado, **When** o pai gera a história, **Then** o tema marcado é o mesmo que chega ao geração (ageBand/locale/theme anônimos).

### User Story 2 - Ouvir a história em voz alta (Priority: P1)

Uma criança (com o pai) pode **ouvir** a cena atual lida em voz alta no idioma da história, com um comando claro de iniciar/parar e feedback visual que indica quando a leitura está em andamento. A leitura se aplica **apenas às cenas da história no `story-reader`** — não cobre a leitura de rótulos/campos do formulário. O controle é um **único botão iniciar/parar**, sem botão dedicado de pausa (Clarification 2026-08-12).

**Why this priority**: é um diferencial forte para crianças pré-alfabetizadas (faixa 2-4) e amplia a acessibilidade do leitor, que já é navegável por teclado e screen reader.

**Independent Test**: Abrir uma cena, acionar a leitura em voz alta e confirmar que (a) há um controle **iniciar/parar** evidente com estado em andamento/pronto, (b) o estado é anunciado de forma acessível e (c) a ação não envia nada à rede (processamento local, em conformidade com o anonimato).

**Acceptance Scenarios**:

1. **Given** uma cena aberta no leitor, **When** o usuário aciona a leitura em voz alta, **Then** a cena é lida no idioma da história e um controle visível mostra o estado "em andamento".
2. **Given** a leitura em andamento, **When** o usuário para, **Then** a leitura cessa e o controle volta ao estado "pronto".
3. **Given** a leitura ocorrendo, **When** o usuário navega para outra cena, **Then** a leitura anterior é interrompida (sem sobreposição) e a nova cena pode começar do início.

### User Story 3 - Acompanhar o progresso dentro de uma história (Priority: P2)

Uma criança acompanha visualmente em qual das **(3 a 5, variável)** cenas está, por um indicador claro de progresso além do texto "Cena X de Y" em que **Y é o total real da história** (3–5, conforme a configuração de número de cenas já suportada pelo produto).

**Why this priority**: dá previsibilidade de quantas cenas faltam e melhora muito a navegação para o público infantil, que já tem um leitor por-cena.

**Independent Test**: Abrir uma história (3, 4 ou 5 cenas) e confirmar que um indicador visual mostra a posição atual e muda conforme a navegação, sempre refletindo o total real.

**Acceptance Scenarios**:

1. **Given** uma história de um total variável (3–5 cenas), **When** abro a primeira cena, **Then** um indicador visual mostra 1 de <total> e reflete a posição.
2. **Given** o indicador, **When** navego para a penúltima e depois a última cena, **Then** o indicador acompanha a posição e mostra a conclusão na última cena.

### User Story 4 - Feedback claro ao exportar o PDF (Priority: P2)

Ao baixar o PDF de uma história, o pai recebe **feedback claro** de que a exportação foi iniciada, e em caso de falha, uma mensagem compreensível com a opção de tentar novamente.

**Why this priority**: o download hoje é silencioso; sem feedback, o usuário não sabe se a exportação funcionou ou falhou.

**Independent Test**: Exportar uma história e confirmar que há um estado "gerando PDF…" durante o processo e, em caso de erro, uma mensagem clara com opção de nova tentativa.

**Acceptance Scenarios**:

1. **Given** uma história aberta, **When** o pai aciona "Baixar como PDF", **Then** um estado de progresso é exibido enquanto o PDF é gerado.
2. **Given** uma falha na exportação, **When** o pai observa o resultado, **Then** uma mensagem compreensível é exibida com ação de tentar novamente.

### User Story 5 - Modo escuro (Priority: P2) *(entregável nesta entrega — Clarifications sessions 2026-08-20 e 2026-08-12)*

O aplicativo oferece um modo escuro que preserva o contraste AA e o anonimato, trocando apenas a aparência (tokens) sem alterar conteúdo ou comportamento. A preferência inicial segue a configuração do sistema (claro/escuro) **e** um alternador manual permite trocar claro/escuro de forma transitória — **sem persistência** (válido apenas na sessão atual; ao recarregar, volta a seguir o sistema) (Clarification 2026-08-12).

**Why this priority**: ganho visual rápido com custo baixo dada a estrutura de tokens semânticos, mas de menor prioridade que as melhorias de primeiro contato e leitura.

**Independent Test**: Alternar entre modo claro e escuro — via o alternador manual e/ou a preferência do sistema — e confirmar que (a) o contraste AA é mantido, (b) nenhum dado novo é coletado e (c) a escolha manual é transitória (sem persistência entre recarregamentos).

**Acceptance Scenarios**:

1. **Given** o app em modo claro, **When** o modo escuro é ativado (via alternador manual ou sistema), **Then** todas as telas mantêm contraste AA sem alterar conteúdo ou coletar dados.
2. **Given** uma escolha manual de modo escuro ativa, **When** recarrego a página, **Then** a preferência volta a seguir a configuração do sistema (sem persistência de escolha manual).

## Functional Requirements *(mandatory)*

- **FR-UX-001**: O formulário DEVE apresentar cada tema (Coragem, Amizade, Bondade) como uma escolha visual com rótulo e descrição no idioma ativo, sem aceitar nome/identificador direto.
- **FR-UX-002**: A seleção de tema DEVE manter o contrato anônimo: somente `ageBand`, `locale` e `theme` são enviados.
- **FR-UX-003**: O leitor DEVE oferecer um controle de leitura em voz alta para a cena atual, com estados visíveis (pronto/em andamento) e anúncio acessível.
- **FR-UX-004**: A leitura em voz alta DEVE ocorrer localmente (sem transmissão de conteúdo) e DEVE ser interrompida ao navegar para outra cena.
- **FR-UX-005**: O leitor DEVE exibir um indicador de progresso visual da posição entre o total de cenas, além do texto de contagem.
- **FR-UX-006**: A exportação de PDF DEVE exibir um estado de progresso durante a geração e, em caso de falha, uma mensagem compreensível com ação de nova tentativa.
- **FR-UX-007**: O aplicativo DEVE suportar modo claro e escuro seguindo a preferência do sistema **e** oferecer um alternador manual transitório na sessão (sem persistência), preservando contraste AA em ambas as telas e mantendo o anonimato (sem coleta adicional).
- **FR-UX-999**: Todas as melhorias DEVEM preservar os invariantes existentes: anonimato (sem nome/idade exata/identificador), acessibilidade AA e budgets de performance já estabelecidos.

## Success Criteria *(mandatory)*

- **SC-UX-001**: 100% dos temas selecionáveis apresentam rótulo e descrição no idioma ativo, e a seleção segue produzindo histórias no tema correto.
- **SC-UX-002**: A leitura em voz alta está disponível em 100% das histórias geradas, funciona sem rede e é interrompida corretamente ao trocar de cena.
- **SC-UX-003**: O indicador de progresso de cena é visível e reflete a posição atual em 100% das histórias de múltiplas cenas, acompanhando o total real (3–5 variável).
- **SC-UX-004**: 100% das exportações de PDF mostram feedback de progresso e, em falha, uma mensagem compreensível com nova tentativa.
- **SC-UX-005**: O modo escuro segue a preferência do sistema **e oferece um alternador manual transitório (não persistido)** — ao recarregar, volta a seguir o sistema — mantendo contraste AA em 100% das telas sem coletar dados adicionais.
- **SC-UX-006**: Nenhum dos invariantes de anonimato, acessibilidade AA ou performance é regredido (verificável via suíte de testes existente).
- **SC-UX-007**: Avaliação qualitativa: usuários (pais) conseguem escolher tema, ouvir e acompanhar progresso sem instrução, com aumento percebido de clareza no primeiro contato.

## Key Entities *(mandatory)*

- **Tema selecionável (Choice)**: valor (`courage` | `friendship` | `kindness`), rótulo localizado, descrição localizada.
- **Leitor / Cena**: posição atual, total de cenas, controle de leitura em voz alta (estado).
- **Exportação PDF**: estado (ocioso | gerando | sucesso | erro), mensagem localizada, ação de nova tentativa.
- **Aparência (Modo)**: claro | escuro (se escopo incluir modo escuro).

## Assumptions *(optional)*

- As melhorias são incrementais sobre o produto existente e preservam o anonimato, a acessibilidade e a performance atuais.
- O idioma ativo continue sendo pt-BR (padrão) e English.
- A leitura em voz alta usa recursos nativos de fala do navegador/dispositivo sem transmissão de conteúdo.
- O modo escuro segue a preferência do sistema (claro/escuro) e não persiste escolha manual na sessão.
- Prioridade efetiva na entrega: tema visual (P1), leitura em voz alta (P1), modo escuro (P2), progresso de cena (P2), feedback de exportação (P2).

## Risks *(optional)*

- Leitura em voz alta pode variar conforme o suporte de fala do dispositivo/navegador.
- Qualquer mudança no leitor/form deve manter os test E2E/a11y existentes verdes.
- Modo escuro adiciona superfície de acessibilidade e deve ser validado contra contraste AA antes do merge.

## Out of Scope *(mandatory)*

- Cadastro, contas, login ou qualquer persistência.
- Coleta de nome, idade exata ou identificador direto.
- Alteração do contrato da API de geração.
- Reportes de análise ou telemetria que transmitam conteúdo de história.
- Persistência de preferência manual de modo claro/escuro entre visitas (a preferência segue o sistema).
