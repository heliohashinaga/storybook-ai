# Research: Redução da Complexidade Ciclomática

**Feature**: `014-ci-cyclomatic-complexity`  
**Tipo**: refatoração preservadora de comportamento (sem mudança de modelo de dados ou contratos)  
**Base**: gate ESLint `complexity: ["error", { max: 16 }]` já comitado (branch `014-ci-cyclomatic-complexity`)

Este é um trabalho de **melhoria de código (Code Quality, Principle I)** e, portanto, de natureza
diferente de uma feature orientada a dados. Não há entidades novas, nem contratos externos novos,
nem UI nova. Todos os pontos de clarificação foram resolvidos no `plan.md` (seção
"Decisões de clarificação"). Este documento consolida as decisões de design que orientam a
implementação (fases 0/1 do workflow), sem abrir novas perguntas.

## Decisão 1: O gate do ESLint permanece em 16 durante toda a redução, evoluindo só no final

**Decisão**: manter `complexity: ["error", { max: 16 }]` intacto enquanto todas as 19 violações
são reduzidas para ≤10; somente na última story (US6, task T071) o limiar muda para `max: 10`.

**Rationale**:

- Reduzir o limiar no meio quebraria o CI (qualquer função ainda >10 se tornaria erro), ferindo o
  Principle I ("no new lint warnings" / build verde) e bloqueando todos os PRs seguintes.
- O gate em 16 já serve como guard-rail: impede que funções novas cresçam além do máximo global
  atual enquanto a redução é feita de forma incremental e verificável.

**Alternatives considered**:

- Baixar o limiar para 10 logo no início: rejeitado — quebraria o build inteiro antes de qualquer
  refatoração e misturaria "corrigir gate" com "refatorar funções", dificultando revisão e
  atribuição de causa.
- Não evoluir o limiar (manter 16): rejeitado — deixaria o objetivo de ≤10 sem enforcement,
  permitindo regressão futura na complexidade.

## Decisão 2: Refatoração estritamente preservadora de comportamento, validada por test-first

**Decisão**: cada função refatorada mantém a mesma semântica (mesma entrada → mesma saída; mesmo
tratamento de erro, timeout, retry, lista de blocos de rede, mensagens de erro e estratégia de
resolução de env). Nenhuma expectativa de teste existente muda.

**Rationale**:

- A decomposição de qualquer função com complexidade alta (muitos `if`/`switch`/operadores)
  apresenta risco de alteração acidental de comportamento — especialmente nas funções críticas de
  segurança (`ipv4IsPrivate`, `isSafeImageUrl`, `postImages`).
- O Principle II exige test-first: cada arquivo ganha um teste novo fail-before/pass-after que
  fixa a paridade de comportamento entre a versão antiga e a refatorada. Redução de complexidade
  sem teste de paridade contradiz a constituição e o AGENTS.md (Definition of Done).

**Alternatives considered**:

- Refatoração "às cegas" confiando apenas no lint/typecheck: rejeitado — não prova paridade de
  comportamento, especialmente para casos de canto de segurança.
- Reescrever a lógica (refactor de design em vez de decomposição): rejeitado — fora do escopo;
  a feature é redução de complexidade com comportamento idêntico, não melhoria de semântica.

## Decisão 3: Priorizar as funções críticas de segurança primeiro (US1, P1)

**Decisão**: começar por `ipv4IsPrivate` (15), `isSafeImageUrl` (11) em `url-safety.ts`,
`postImages` (11) em `image-client.ts`, e `moderateOneCandidate`/`moderateCandidate` na
safety-pipeline (12 cada).

**Rationale**:

- O AGENTS.md e o spec `010-security-hardening` exigem cobertura ≥90% nas camadas de
  segurança/validação/orquestração; a redução de complexidade é mais arriscada exatamente nessas
  rotas, então devem ser feitas primeiro e com a maior atenção de teste.
- Priorizar risco alto primeiro reduz a janela em que o warning de complexidade (ou uma
  refatoração mal feita) possa tocar código sensível a SSRF/DNS rebinding sem revisão dedicada.

**Alternatives considered**:

- Ordem alfabética por arquivo: rejeitada — coloca risco igual nas funções de UI e segurança,
  sem valorizar o custo de falha.
- Começar pelas mais fáceis (UI, Média) para ganhar confiança: parcialmente válido, mas o custo de
  uma regressão em segurança supera a conveniência; a ordem por prioridade do spec é mantida.

## Decisão 4: Extrair helper compartilhado de leitura de env para os três `resolveDeps` (US2)

**Decisão**: extrair um helper único de leitura/parse de variável de ambiente por campo, reutilizado
pelos `resolveDeps` de `openrouter-story-generation-provider` (16), `opencode-story-generation
-provider` (13) e `openrouter-tts-provider` (13).

**Rationale**:

- Os três `resolveDeps` repartem o mesmo padrão de parse de env; um helper reduz duplicação
  (Principle I — "Duplication SHOULD be avoided").
- A abstração paga-se em clareza: um único ponto de leitura/validação de env, com comportamento
  idêntico por campo.

**Alternatives considered**:

- Refatorar cada `resolveDeps` isoladamente sem abstração compartilhada: possível, mas mantém a
  duplicação tripla de parse de env e contradiz o "abstraction pays for itself" da constituição.
- Mudar a semântica de leitura de env (ex.: tolerância a ausência de campo): rejeitado — viola
  Decisão 2 (preservação de comportamento).

## Decisão 5: Aplicar decomposição por extração de helpers/métodos, não por mudança de modelo

**Decisão**: reduzir ciclomática extraindo condicionais/passos em sub-funções pequenas e focadas
(extração de método e de blocos de ramificação), mantendo a estrutura de dados e o fluxo geral.

**Rationale**:

- É a técnica de menor risco para preservação de comportamento (mais simples de comparar via
  teste de paridade) e suficiente para levar funções de 11–16 para ≤10.
- Mantém os módulos feature-based e pequenos conforme Principle I ("small, focused modules").

**Alternatives considered**:

- Reescrever com state machines ou tabelas de decisão: overkill e aumenta a superfície de mudança
  sem necessidade para atingir ≤10.
- Reduzir operadores booleanos trocando `&&`/`||` por ternários aninhados: rejeitado — pode baixar
  a métrica do ESLint mas piora a legibilidade, contradizendo Principle I.

## Ground truth da medição

- **19 violações** (ground truth JSON sobre a base inteira com limiar 10): 17 em código de
  produção/scripts + 2 em arquivos de teste.
- O backlog textual em `cyclomatic-complexity-backlog.md` lista 11 funções de
  produção; o `plan.md` e o `tasks.md` expandem para as 19 totais (US1–US6), incluindo
  `generateStory` (16) em `tests/fixtures/story-generation/provider-fixtures.ts` e o `deepMerge`
  local em `tests/unit/i18n-localized-catalog.test.ts`.
- Todas as decisões acima estão refletidas no `plan.md` (seções Design e Phases) e no `tasks.md`
  (T010–T074).

## Resultado do assessment de NEEDS CLARIFICATION

Não há nenhum "NEEDS CLARIFICATION" remanescente: o `plan.md` já declarou Decisão-1..Decisão-4
(formato Spec Kit, independência do spec 013, evolução do limiar, preservação de comportamento).
Esta feature não possui dependências externas novas, integrações novas ou entidades de dados novas.
