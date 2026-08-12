# Feature Specification: Gerar mais de 3 cenas

**Feature Branch**: `002-generate-more-scenes`

**Created**: 2026-08-11

**Status**: Draft

**Input**: User description: "quero poder gerar mais de 3 cenas" — permitir que uma história seja gerada com mais de três cenas (histórias mais longas), mantendo o produto anônimo por design preservando todos os invariantes de privacidade, acessibilidade, segurança e performance existentes.

**Scope clarification**: A geração atual produz exatamente 3 cenas fixas por história (especificação de v1). Esta entrega introduz **contagem de cenas variável**: o responsável escolhe quantas cenas a história terá (3, 4 ou 5), dentro de limites validados. NÃO introduz cadastro, persistência, coleta de identificadores nem altera o anonimato — apenas torna a extensão "contagem variável de cenas" (já prevista como direção futura em `001`) uma capacidade efetiva para o usuário.

## Clarifications

### Session 2026-08-11

- Q: Should the feature assume that generating 5 scenes is slower than 3, or treat the time cost as unknown until it can be measured? → A: Ignore timing entirely for this feature; keep FR-008 generic, decide the time question later during planning.
- Q: When a parent generates a new story in the same session, should the scene-count choice made earlier be remembered, or reset to the default (3) each time? → A: Remember the in-session selection for subsequent "new story" flows (consistent with age/locale/theme reuse); 3 remains the first-run default.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Escolher quantas cenas a história terá (Priority: P1)

Um responsável escolhe, antes de gerar, quantas cenas a história terá (3, 4 ou 5), por um controle claro e acessível no formulário. A escolha é opcional: se não for alterada, o padrão continua sendo 3 cenas (comportamento atual preservado).

**Why this priority**: é a interação principal desta entrega — dar ao usuário o controle de duração da história, com o valor padrão preservando o comportamento conhecido de v1.

**Independent Test**: Abrir o formulário no idioma pt-BR e confirmar que há um controle para escolher o número de cenas com as opções 3, 4 e 5 e o valor padrão 3; selecionar 4 e confirmar que a escolha é refletida na solicitação sem que nenhum identificador direto seja coletado.

**Acceptance Scenarios**:

1. **Given** um responsável no formulário, **When** visualiza as opções de duração, **Then** ele pode escolher entre 3, 4 ou 5 cenas, com 3 pré-selecionado como padrão e rótulo localizado no idioma ativo.
2. **Given** um responsável que não altera a escolha, **When** gera a história, **Then** a história é gerada com 3 cenas (mesmo comportamento de v1).
3. **Given** um responsável seleciona 4 cenas, **When** gera a história, **Then** a história retorna com exatamente 4 cenas numeradas em sequência e a escolha é enviada ao servidor apenas como a contagem anônima (sem identificador).
4. **Given** um responsável que selecionou 4 cenas e gera uma **nova história** na mesma sessão, **When** inicia a nova história, **Then** o controle mantém a escolha anterior (4 cenas), com 3 permanecendo como padrão apenas na primeira execução da sessão.

---

### User Story 2 - Ler uma história mais longa cena a cena (Priority: P1)

Uma criança (com o pai) lê uma história de 4 ou 5 cenas cena a cena, com navegação por-cena que acompanha a quantidade escolhida, chegando a um final satisfatório. O indicador de progresso reflete a contagem real da história (não uma constante fixa de 3).

**Why this priority**: é o valor entregue ao usuário final — histórias mais longas que permanecem legíveis e navegáveis cena a cena, sem regressão de UX.

**Independent Test**: Gerar uma história de 5 cenas e confirmar que (a) o leitor exibe 5 cenas navegáveis, (b) o indicador de progresso mostra a posição sobre 5 (ex.: "Cena 3 de 5") e (c) navegar até a cena final apresenta um encerramento claro da história.

**Acceptance Scenarios**:

1. **Given** uma história de 5 cenas gerada, **When** abro a primeira cena, **Then** o leitor indica "Cena 1 de 5" e o número de cenas navegáveis é 5.
2. **Given** a navegação por-cena, **When** avanço da cena 4 para a 5, **Then** a cena 5 é exibida como a última, com um estado claro de conclusão da história.
3. **Given** uma história de 3 cenas (opção padrão), **When** abro o leitor, **Then** o comportamento permanece idêntico ao de v1 (3 cenas, "Cena X de 3").

---

### User Story 3 - Manter identidade e consistência em histórias longas (Priority: P2)

Ao gerar uma história de 4 ou 5 cenas, todas as cenas partilham o mesmo estilo artístico e a mesma personagem (anônima), e a história inteira passa pelo mesmo pipeline de segurança — texto e ilustrações de todas as cenas são verificados antes de qualificar como sucesso.

**Why this priority**: garante os invariantes de qualidade e segurança ao aumentar a quantidade de conteúdo gerado; mais cenas = mais superfície que precisa passar pelos mesmos controles.

**Independent Test**: Gerar uma história de 4 cenas e confirmar que (a) todas as 4 ilustrações seguem o mesmo estilo/consistência e (b) a história só é entregue como sucesso quando texto e ilustração de todas as 4 cenas passaram na verificação de segurança.

**Acceptance Scenarios**:

1. **Given** uma geração de 4 cenas, **When** a resposta é retornada, **Then** todas as 4 cenas trazem texto e ilustração que passaram no pipeline de segurança (nunca um conjunto parcial de cenas aprovadas).
2. **Given** uma história de 5 cenas, **When** as ilustrações são comparadas entre si, **Then** todas compartilham estilo e personagem coerentes.
3. **Given** qualquer contagem de cenas, **When** o servidor responde, **Then** a resposta inclui `Cache-Control: no-store` e nenhum identificador direto em payloads ou logs.

---

### Edge Cases

- O que acontece quando o responsável seleciona **exatamente 3** cenas? Deve produzir o mesmo comportamento de v1, sem mudança visível na história.
- Como o sistema lida com valores de contagem **inválidos** (ex.: 2, 6, ausente ou texto não numérico)? A validação no cliente dá erro rápido localizado; o servidor re-valida e retorna `400 invalid_input` (malformado) se o valor estiver fora da faixa permitida (3–5).
- Como o sistema se comporta quando o valor de contagem é **omitido** na requisição? Deve assumir o padrão de 3 cenas (retrocompatível).
- O que acontece quando uma geração de 5 cenas ultrapassa o tempo máximo aceitável de geração? O sistema deve retornar os erro de contrato correspondentes (`504`/`502`) mapeados, nunca uma história parcial como sucesso. *Qualquer parametrização de timeout por contagem é decidida em planejamento; o invariante a preservar é: nunca sucesso parcial.*
- Como a **leitura em voz alta** (se existente em outras entregas) e a navegação por cena se comportam com 4-5 cenas? A navegação/indicação de progresso devem refletir a contagem real, interrompendo leituras ao trocar de cena.
- O que acontece se o usuário tentar **exportar** uma história de 5 cenas? O documento exportado deve conter todas as cenas na ordem, sem truncar para 3.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O usuário responsável DEVE poder escolher o número de cenas para uma história entre **3, 4 ou 5**, por um controle acessível no formulário, com o valor **3 como padrão**, antes de solicitar a geração.
- **FR-002**: O sistema DEVE aceitar uma solicitação com uma contagem de cenas válida (3, 4 ou 5) e gerar exatamente essa quantidade de cenas sequenciais e numeradas.
- **FR-003**: O sistema DEVE rejeitar contagens fora da faixa permitida, no cliente com erro de validação localizado imediato e no servidor com a resposta de contrato correspondente, antes de qualquer chamada ao provedor.
- **FR-004**: O sistema DEVE tratar a contagem como opcional e retrocompatível: uma requisição sem contagem (ou com valor omisso) DEVE gerar 3 cenas (comportamento de v1).
- **FR-005**: O sistema DEVE garantir que um conjunto de cenas só seja considerado uma história bem-sucedida quando **todas** as cenas (texto e ilustração) passarem no pipeline de segurança; nenhum subconjunto parcial DEVE ser tratado como sucesso.
- **FR-006**: O sistema DEVE manter a consistência de estilo e personagem (anônima) em todas as ilustrações, independentemente da contagem de cenas (3, 4 ou 5).
- **FR-007**: O sistema DEVE preservar todos os invariantes de anonimato com contagens variáveis: nenhum identificador direto do filho em payloads, logs, telemetria ou provedores; `Cache-Control: no-store` na resposta.
- **FR-008**: (decisão de capacidade de tempo adiada para o planejamento) O sistema DEVE garantir que uma história de 3, 4 ou 5 cenas nunca retorne um conjunto parcial de cenas como sucesso, e esteja sujeita aos limites de tempo e recursos existentes do produto. *Se gerar 5 cenas é mais lento que 3 permanece uma suposição não medida; a parametrização de tempo por contagem será decidida em planejamento/implementação, não antecipada aqui.*
- **FR-009**: O leitor DEVE navegar e indicar progresso refletindo a contagem real de cenas (ex.: "Cena X de 5"), e a exportação DEVE incluir todas as cenas na ordem.
- **FR-010**: O sistema DEVE revalidar no servidor a contagem recebida antes de qualquer geração, aplicando os mesmos limites (3–5) como parte do contrato de entrada.

### Key Entities *(include if feature involves data)*

- **Story**: Narrativa gerada com contagem de cenas variável (3–5), parametrizada pela preferência de duração escolhida e alinhada à faixa etária/tema/idioma.
- **Scene Count / Duração**: Escolha do responsável pelo número de cenas (3, 4 ou 5), enviada ao servidor apenas como valor inteiro anônimo dentro da faixa permitida, validada em duas camadas (cliente e servidor).
- **Scene**: Unidade narrativa sequencial com texto e ilustração; a quantidade por história é determinada pelo Scene Count, modelada por ordinal.
- **Illustration**: Imagem de cada cena, mantendo consistência de estilo e personagem anônima em toda a história, sem importar a contagem.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um responsável consegue escolher e receber uma história com **4 ou 5 cenas** completas e legíveis dentro dos limites aceitáveis de geração do produto, sem retornar conteúdo parcial. *Não assume que histórias mais longas ultrapassam limites; a questão de tempo é verificada em planejamento/implementação.*
- **SC-002**: **100%** das histórias geradas com contagem variável têm exatamente a contagem de cenas solicitada (3, 4 ou 5), numeradas em sequência e com final claro.
- **SC-003**: **100%** das histórias com contagem variável mantêm os invariantes de anonimato e privacidade (sem identificador direto em payloads, logs ou provedores; `Cache-Control: no-store`).
- **SC-004**: **100%** das histórias de 4 ou 5 cenas são entregues como sucesso apenas quando **todas** as cenas (texto e ilustração) passaram na verificação de segurança e na checagem de consistência.
- **SC-005**: Histórias com a opção padrão (3 cenas) mantêm comportamento idêntico ao de v1, sem regressão perceptível.
- **SC-006**: O leitor e a exportação exibem e incluem corretamente todas as cenas da história (ex.: "Cena X de 5", documento sem truncamento) na primeira tentativa para 95% das histórias.

## Assumptions

- **Faixa de contagem**: A faixa suportada é **3 a 5 cenas** (alinhada à direção futura já registrada em `001`: "variable scene counts e.g. 3, 4, or 5"). Contagens acima de 5 ficam fora de escopo desta entrega.
  - **Decisão (3–4–5 confirmada sobre 3–5–7)**: o range contíguo 3–4–5 foi mantido em vez de uma progressão ímpar 3–5–7. Razões: atende bem à curva de atenção por faixa etária (2–4 → curto; 5–7 ≈ 4; 8–12 ≈ 5), oferece granularidade mais previsível (sem pular os pares 4 e 6), e evita o custo de tempo/engenharia ainda não medido de 7 ilustrações (cada cena = 1 ilustração + moderação). A reavaliação de ampliar para 6 (não 7, mantendo contiguidade) pode ser considerada após medição real de tempo de geração em planejamento/implementação.
- **Escolha do responsável (não da faixa etária)**: A contagem é escolhida pelo responsável em um controle no formulário, em vez de ser derivada automaticamente da faixa etária. (Este foi um ponto em aberto; a escolha explícita é o comportamento mais simples e direto.)
- **Valor padrão retrocompatível**: Se o responsável não alterar a escolha, o valor é 3, mantendo o comportamento atual de v1 sem quebra.
- **Reuso em sessão**: A escolha de contagem (quando alterada) é lembrada na mesma sessão para as próximas histórias (consistente com o reuso em memória de idade/idioma/tema); o padrão 3 aplica-se à primeira execução da sessão.
- **Validação em duas camadas**: A contagem é validada no cliente (erro rápido localizado) e re-validada no servidor (contrato `story-generation.openapi.yaml`) antes de qualquer chamada ao provedor, para segurança e integridade do contrato.
- **Escopo de regressão**: Não altera o anonimato, a persistência, moderação, taxa de uso, temas, faixa etária, nem idiomas — apenas a capacidade de contagem variável de cenas e o impacto decorrente em UI/UX (controle, leitor, exportação, orquestração).
- **Compatibilidade de contrato**: A contagem de cenas entra como campo novo no contrato de requisição; respostas continuam usando o modelo sequencial por ordinal já existente; o contrato e os testes de contrato são atualizados.
- **Dependência**: Preserva os invariantes de segurança e consistência já estabelecidos, incluindo a verificação de que nenhum conjunto parcial de cenas é tratado como sucesso e a parametrização dos budgets por contagem.
- **Decisão de latência (paralelização de ilustrações aceita)**: para mitigar a espera com provedores lentos, a geração de ilustrações DEVE poder rodar com **concorrência limitada** (ex. `Promise.allSettled` com `concurrency` ∈ 2–3, mantendo o retry do set inteiro e o timeout `IMAGE_TIMEOUT_MS`), em vez de puramente sequencial. Isso reduz o tempo da geração paralela de cenas sem abrir mão da invariante de “nunca conjunto parcial” (FR-005/FR-008). Se a medição real de latência mostrar rate-limit ou queda de consistência ao paralelizar, a concorrência é reduzida — a decisão de escala permanece adiada até medição, mas a abordagem de paralelização limitada é a recomendada.
- **Dependência funcional (opcional)**: Se a leitura em voz alta estiver presente em outra entrega, a navegação/interrupção deve refletir a contagem real; caso contrário, permanece fora de escopo desta entrega.
