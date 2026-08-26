# Feature Specification: Adotar o design system e o frontend do protótipo

**Feature Branch**: `007-adopt-design-system`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "quero usar o design system e o frontend do repo protótipo no frontend do repo storybook-ai"

**Scope summary**: `protótipo` é o protótipo visual (mockup React/Tailwind) deste mesmo produto anônimo de histórias infantis. Este item transfere a **identidade visual** e o **tratamento de front-end** do protótipo (paleta quente creme/coral/terracota, tipografia Baloo 2 + Nunito, cards arredondados com sombras suaves, telas de formulário/geração/leitor) para o app de produção `storybook-ai`. Há dois eixos de trabalho:**(1)** refatoração visual/UX sobre os fluxos existentes — sistema de design (tokens), primitivas compartilhadas e componentes de `src/features/*`, mantendo a estrutura por features, a i18n por catálogos e o anonimato/ acessibilidade/ validações preservados; e **(2)** expansão do conjunto de **temas narrativos de 3 para 6** (Coragem, Amizade, Bondade, Curiosidade, Perseverança e Empatia), alinhando o front-end ao protótipo e exigindo correspondente suporte de back-end (schema), prompts de geração e cobertura de segurança para os 3 novos temas. **Nenhum** identificador é introduzido; todas as regras de privacidade e invariantes permanecem.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Experiência visual acolhedora no formulário (Priority: P1)

Um responsável abre o app em pt-BR de cara e vê uma tela de formulário redecorada segundo o protótipo: cabeçalho com a marca (`BookOpenText` + nome + tagline), seleção de tema como cards grandes com emoji e descrição, campo de idade claro, seletor de duração (cenas) e botão primário grande "Criar história". Tudo com a paleta quente e a tipografia do protótipo, mantendo contraste AA e foco visível.

**Why this priority**: é a primeira impressão e o ponto de entrada de todo o fluxo; o resto do app herda os tokens e primitivas a partir daqui. Sem isso não há "reestilo" coerente.

**Independent Test**: Abrir o formulário em pt-BR e confirmar visualmente e por controle de regressão que ele usa a paleta/tipografia/card do protótipo, que a seleção de tema/idade/cenas continua funcional e que não há qualquer campo ou texto de identificador; rodar as stories de `story-request-form` e validar contraste AA e foco de teclado.

**Acceptance Scenarios**:

1. **Given** um responsável abre o app, **When** o formulário renderiza, **Then** a tela usa a identidade visual do protótipo (paleta quente, tipografia Baloo 2/Nunito, cards arredondados com sombras suaves) e exibe marca + tagline, seleção de tema em cards, idade, duração e botão primário.
2. **Given** o formulário recarregado, **When** o responsável navega só por teclado, **Then** todos os controles têm foco visível e operação completa por teclado, e todos os textos de rótulos/semântica têm contraste AA ≥ 4.5:1 contra o fundo.
3. **Given** o formulário, **When** o responsável seleciona tema, idade e cenas e submete, **Then** a solicitação enviada contém apenas idade agregada, idioma, tema e contagem de cenas anônimas — nenhum identificador direto (invariante de privacidade, verificado em teste de contrato).

---

### User Story 2 - Geração com progresso por estágios e bloqueio de envio (Priority: P1)

Após submetrer, o responsável vê a tela de geração do protótipo: ícone animado, estágios nomeados ("Escrevendo sua história…" → "Ilustrando as cenas…" → "Verificando a segurança…"), barra de progresso e aviso de que o envio está bloqueado durante a criação, com `aria-busy` e `aria-live` para leitores de tela.

**Why this priority**: junto com o formulário compõe o fluxo de criação; o feedback de progresso é parte do contrato de UX (perceived performance) da Constituição.

**Independent Test**: Submeter uma história com o provider fake e confirmar que os três estágios aparecem em sequência com progresso, que não há nenhum campo de entrada habilitado durante a geração e que `aria-busy`/`aria-live` estão presentes.

**Acceptance Scenarios**:

1. **Given** o usuário submete uma história, **When** a geração está em andamento, **Then** aparecem os estágios nomeados em sequência com barra de progresso e o texto de "envio bloqueado durante a criação", e o contêiner marca `aria-busy="true"` com `aria-live`.
2. **Given** a geração em andamento, **When** a tela é inspecionada, **Then** nenhum formulário/campo de envio está habilitado (não é possível enviar nada) e nenhum identificador é enviado ou logado.
3. **Given** o usuário tenta interagir com controles de envio durante a geração, **Then** eles estão desabilitados/ignorados sem erro visível.

---

### User Story 3 - Leitor com nova identidade, navegação, leitura em voz alta e baixar PDF (Priority: P2)

O responsável lê a história gerada na tela do leitor refeita com o estilo do protótipo: cena única com destaque visual (placeholder de ilustração), título e texto da cena, indicador de progresso por cenas, botões Anterior/Próxima, controle acessível de "ler em voz alta" e ação "Baixar como PDF" no rodapé, em layout responsivo (mobile-first) e modo escuro opcional.

**Why this priority**: é a entrega central de valor após a criação; restiliza as peças que já existem (scene view, scene progress, narration control, export button) sem mudar seu comportamento.

**Independent Test**: Gerar uma história e percorrer as cenas com Anterior/Próxima, ativar/parar a leitura em voz alta, acionar "Baixar como PDF" e alternar o modo escuro, confirmando visual e contrato mantidos nas stories de `story-reader`, `scene-progress`, `narration-control` e `export-story-button`.

**Acceptance Scenarios**:

1. **Given** uma história gerada, **When** o usuário abre o leitor, **Then** a cena renderiza com a identidade do protótipo (card arredondado, destaque de ilustração, título/texto, indicador de cena) e os botões Anterior/Próxima desabilitam corretamente nas bordas.
2. **Given** o usuário ativa "Ler em voz alta", **When** a narração toca, **Then** o controle alterna para "Parar leitura" com `aria-pressed` e confirma estado acessível; parar restaura o estado inicial.
3. **Given** o usuário aciona "Baixar como PDF", **When** a exportação roda, **Then** o PDF é gerado apenas no clique (importação atrasada), com estados de carregando/erro/sucesso localizados — e nenhuma tela quebra no modo escuro.

---

### User Story 4 - Histórias nos 6 temas do protótipo (Priority: P1)

Após o redesenho, o responsável pode escolher entre os **seis temas do protótipo** (Coragem, Amizade, Bondade, Curiosidade, Perseverança e Empatia) como cards com emoji, descrição e seleção clara — e receber uma história coerente com o tema escolhido, incluindo os três temas novos (antes não suportados pela app).

**Why this priority**: o usuário escolheu expor os 6 temas do protótipo (Q1-B). É parte do valor visível da identidade nova e exige alinhar front-end, schema, geração e segurança sem quebrar o anonimato.

**Independent Test**: Selecionar cada um dos 6 temas no formulário, gerar com o provider fake e confirmar que a história retorna com o tema escolhido (incluindo os 3 novos), que o catálogo/localização oferece nome+descrição para todos e que nenhum identificador é coletado em nenhum tema.

**Acceptance Scenarios**:

1. **Given** o formulário com a nova identidade, **When** o responsável visualiza a seleção de tema, **Then** os seis cards (emoji + nome + descrição) são exibidos e localizados, com estado selecionado claro.
2. **Given** o responsável escolhe um dos três novos temas (Curiosidade, Perseverança ou Empatia), **When** gera a história, **Then** o back-end aceita e gera uma história coerente com esse tema, sem erro de validação.
3. **Given** qualquer um dos 6 temas, **When** a história é gerada e revisada, **Then** os 3 novos passam pela mesma checagem de segurança dos existentes e a payload envia apenas o tema anônimo (sem identificador).

---

### User Story 5 - Modo escuro e consistência visual em toda a jornada (Priority: P2)

Todo o app — formulário, geração e leitor — adota a paleta quente do protótipo também no modo escuro, com alternância manual na sessão e comportamento de padrão respeitando a preferência do sistema, em contraste AA mantido.

**Why this priority**: o protótipo inclui explicitamente tela de leitor em modo escuro; a tag do topo com alternância já existe no app e só precisa ser redesenhada. Garante coesão (Constituição, princípio III).

**Independent Test**: Alternar para escuro nas três telas (formulário, geração, leitor) e rodar a verificação visual/regressão e checagem de contraste AA em cada uma.

**Acceptance Scenarios**:

1. **Given** o app em modo claro, **When** o usuário ativa o modo escuro, **Then** formulário, geração e leitor mudam para a paleta escura do protótipo mantendo contraste AA e sem persistir a escolha entre recargas.
2. **Given** a preferência do sistema aponta para escuro, **When** o app carrega sem escolha manual, **Then** segue a preferência do sistema; a escolha manual da sessão tem precedência (sem persistência).

---

### User Story 6 - Portar os padrões de front-end do protótipo para as features existentes (Priority: P2)

As peças compartilhadas do app (primitivas de UI e componentes por feature) passam a refletir os padrões do protótipo — seleção de tema em cards de emoji, controles de idade/duração na linguagem visual nova, barra do topo com marca + alternância de idioma/tema — sem duplicar código curto nem romper a estrutura por feature, a i18n por catálogos e as superfícies visíveis do app (formulário, geração, leitor, alternância de tema e botão de exportação, conforme SC‑001). As stories (default/edge/error) acompanham a nova aparência.

**Why this priority**: assenta o trabalho e garante que o app não diverge em estilo entre Storybook e produção (Constituição III; DoD).

**Independent Test**: Rodar `storybook:test` e conferir que todas as stories renderizam com a nova identidade e que o comportamento do Storybook coincide com o app; rodar os gates de lint/format/type/test.

**Acceptance Scenarios**:

1. **Given** os catálogos pt-BR/en, **When** cada tela renderiza, **Then** todos os textos visíveis vêm dos catálogos (sem strings hardcoded) e a nova identidade visual está presente em cada story (default/edge/error).
2. **Given** as primitivas de UI, **When** são usadas por mais de uma feature, **Then** refletem a linguagem do protótipo e o código é revisado para remover duplicação (ex.: tema em cards) sem desviar da estrutura `src/features/<feat>/{components,client,server,locales}`.
3. **Given** um commit com a mudança, **When** pasa pelos gates, **Then** `lint` (0 warnings), `format:check` (sem drift) e `typecheck` (sem `any` novo) passam após a última edição.

### Edge Cases

- O que acontece ao alternar para o modo escuro com uma história já carregada no leitor? (não deve haver flash/ruído nem queda de contraste; reaproveitar a tela sem regenerar).
- Como o tema visual lida com paleta nova sobre os tokens semânticos existentes — o contraste AA (≥4.5:1) é revalidado em texto normal nas novas cores?
- O que acontece se o usuário inicia "ler em voz alta" e navega para outra cena? (estado de fala deve ser resetado ou sincronizado sem erro).
- Como a regressão visual trata o churn de paleta? (aprova-se a nova identidade como nova linha de base, não como diff indesejado).
- O que ocorre ao gerar uma nova história na mesma sessão com a nova tela? (a escolha de idade/idioma/tema/cenas é reutilizada conforme comportamento atual).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O app DEVE adotar a paleta de cores quente do protótipo (creme/coral/terracota + acento vivo), em modo claro e escuro, expressa em tokens semânticos (não literais) e mantendo contraste AA ≥ 4.5:1 para texto normal.
- **FR-002**: O app DEVE adotar a tipografia do protótipo (fonte display arredondada para títulos e fonte de corpo legível para texto), via tokens.
- **FR-003**: Os componentes compartilhados DEVEM adotar os padrões geométricos do protótipo — cards grandes com cantos arredondados e sombras suaves, raios e espaçamentos por tokens — refletindo a identidade em formulário, geração e leitor; a cor nominal é coberta por FR-001 (paleta).
- **FR-004**: O formulário DEVE exibir a seleção de tema como cards com emoji/ícone, nome e frase curta de descrição, mantendo acessibilidade (aria-pressed, foco visível, navegação por teclado) e i18n por catálogos.
- **FR-005**: A tela de geração DEVE exibir estágios nomeados em sequência (escrever → ilustrar → verificar segurança), barra de progresso, aviso de envio bloqueado durante a criação e `aria-busy`/`aria-live`.
- **FR-006**: O leitor DEVE renderizar uma cena por vez com destaque de ilustração (placeholder visual), título/texto, indicador de progresso por cenas e botões Anterior/Próxima, com navegação, leitura em voz alta e "Baixar como PDF" funcionais e localizados.
- **FR-007**: O modo escuro DEVE estar disponível em todas as telas, com alternância manual na sessão e precedência do padrão sobre a preferência do sistema, sem persistência (invariante de anonimato).
- **FR-008**: O app DEVE suportar e expor os **seis temas do protótipo** (Coragem, Amizade, Bondade, Curiosidade, Perseverança, Empatia) no formulário, ampliando os três existentes e mantendo o estado selecionado claro e acessível.
- **FR-009**: O sistema DEVE aceitar e gerar histórias para os 3 novos temas (Curiosidade, Perseverança, Empatia) por meio do mesmo fluxo de geração, com prompts coerentes e cobertura de segurança equivalente aos temas existentes.
- **FR-010**: O catálogo (nome + descrição, pt-BR e en) DEVE incluir os 6 temas, e o idioma ativo deve refletir a escolha do protótipo.
- **FR-011**: Nenhum identificador direto DEVE ser introduzido em UI, payloads, logs ou catálogos — apenas idade agregada, idioma, tema e contagem de cenas anônimas (invariante inalterado).
- **FR-012**: O comportamento das ações existentes (cenas 3-5, leitura em voz alta, export PDF, alternância de história na sessão) NÃO DEVE regredir com a remoção de código morto ou duplicado.

### Key Entities *(include if feature involves data)*

- **Design tokens (tema visual)**: o conjunto de valores semânticos (cores, tipografia, raios, sombras, espaçamento) que definem a identidade visual do produto em claro e escuro; é o "contrato" que todas as primitivas consomem. Não é dado do usuário.
- **Tema de história (conteúdo)**: o tema narrativo escolhido pelo responsável (Coragem, Amizade, Bondade, Curiosidade, Perseverança e Empatia); existe apenas como categoria anônima já validada, agora com 6 valores aceitos pelo schema e pipeline.
- **Preferências de sessão (usuário)**: as escolhas de idioma, tema, duração e idade agregada mantidas apenas em memória no navegador para a sessão (nenhum dado persistido).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das superfícies visíveis (formulário, geração, leitor, alternância de tema, barra do topo com marca e botão de exportação — em modo claro e escuro) usam a identidade do protótipo, verificável por regressão visual aprovada sem diff indesejado.
- **SC-002**: Todos os textos em texto normal mantêm contraste AA (≥4.5:1) na nova paleta clara e escura, sem exceção verificada.
- **SC-003**: Toda a jornada (formulário → geração → leitor) permanece acessível por teclado e com foco visível; nenhuma story de a11y regressa.
- **SC-004**: Nenhum identificador direto aparece em payloads, logs, catálogos ou fixtures (invariante verificado por testes de contrato/privação em 100% dos cenários).
- **SC-005**: O comportamento funcional existente (cenas 3-5, leitura, PDF, alternância de histórias, modo escuro) não regride (gates de teste e Storybook passam).
- **SC-006**: A refatoração não aumenta o JS inicial além do orçamento (≤250 KiB gzip) e a importação pesada de export PDF permanece atrasada.
- **SC-007**: Os 6 temas estão disponíveis e geram histórias coerentemente; os 3 novos passam pela mesma moderação e aparecem no catálogo localizado (pt-BR/en) sem erro de validação.

## Assumptions

- O `protótipo` representa a identidade visual desejada (fonte da verdade do desenho) e o `storybook-ai` é o produto que receberá essa identidade sobre seu back-end, segurança e acessibilidade já existentes.
- O escopo é de **refatoração visual/UX** sobre os fluxos existentes: os componentes e features atuais são reestilizados/adaptados à linguagem do protótipo, **não** copiados literalmente como telas auto-contidas que duplicariam estado, i18n ou estrutura.
- A estrutura por features (`src/features/<feat>/{components,client,server,locales}`), a i18n por catálogos pt-BR/en e a API `POST /api/stories` permanecem; catálogos ganham as novas strings/tratamentos do protótipo.
- Os `story-reader`, `story-request`, `story-read-aloud` e `story-export` já existem; o trabalho adiciona o desenho e os componentes (ex.: cards de tema por emoji) de forma compartilhada, removendo código morto/duplicado.
- A paleta será definida em tokens semânticos oklch (padrão do protótipo), substituindo a base hex atual, e as cores novas serão revalidadas para AA.
- O porte de identidade mantém modo claro/escuro; a escolha de modo não é persistida (precedência do sistema na primeira carga), preservando o anonimato por design.
- **Decisão Q1-B**: o conjunto de temas é ampliado para os 6 do protótipo; isso exige estender schema, prompts de geração, catálogo e cobertura de segurança para os 3 novos temas (Curiosidade, Perseverança, Empatia).
- Os 3 novos temas seguem o mesmo contrato anônimo (apenas o nome categórico no payload) e a mesma pipeline de moderação dos existentes; nenhum campo novo de dado pessoal é introduzido.
