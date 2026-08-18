# ADR 0011 — Gate de complexidade ciclomática (limiar 16 → 10)

- Status: Accepted
- Decisores: manutenção do `storybook-ai`
- Data: 2026-08-17
- Contextos relacionados: spec `014-ci-cyclomatic-complexity`; documento
  `docs/diagnostics/cyclomatic-complexity-backlog.md`; ADR 0008 (extração de `provider-core`).

> O ADR é **Accepted** e registra a evolução do guard-rail de complexidade ciclomática do ESLint
> de `max: 16` para `max: 10`, **após** a redução das 19 violações (17 em produção/scripts + 2 em
> arquivos de teste) — preservando comportamento em todas as funções refatoradas.

## Contexto

O `eslint.config.mjs` mantinha `complexity: ["error", { max: 16 }]` como um **guard-rail**: o
limiar era o máximo global atual (16) e o comentário deixava explícito que ele **não deveria ser
baixado** até que as funções acima de 10 fossem decompostas. O backlog em
`docs/diagnostics/cyclomatic-complexity-backlog.md` media 19 funções que ultrapassavam 10 em uma
medição base-wide com limiar 10.

Essas funções concentravam-se em camadas sensíveis:

- **Segurança (Crítica):** `ipv4IsPrivate`, `isSafeImageUrl` (`url-safety.ts`), `postImages`
  (`image-client.ts`), `moderateCandidate`/`moderateOneCandidate` (safety pipeline).
- **Adapters:** três `resolveDeps` (16/13/13) com padrão idêntico de parse de env.
- **UI/i18n:** `Progress` (13), `Select` (11), `deepMerge` (12).
- **Agentes:** `planStory` (11), `writeStory` (13), `moderateStory` (11).
- **Rotas/script:** `POST /api/stories` (12), `POST /api/narrate` (11), `parseFlags` (11).
- **Testes:** `generateStory` (16) em `provider-fixtures.ts`, `deepMerge` (12) em teste de i18n.

Cada função foi reduzida para ≤10 com refatoração **preservadora de comportamento**: extração de
métodos/helpers (sem mudança de semântica, enums, mensagens, timeouts, retries, listas de blocos
de rede, erros, cache ou prompts), validada por test-first (fail-before/pass-after) e pela suíte
verde.

## Decisão

1. **Evoluir o limiar de complexidade de `max: 16` para `max: 10`** no `eslint.config.mjs`,
   substituindo o comentário de guard-rail por uma explicação do novo limiar saudável.
2. **Reduzir primeiro, apertar o gate depois.** O gate só foi movido após as 19 funções estarem
   ≤10, de modo que nenhum build intermediário ficasse quebrado.
3. **Compartilhar o helper de env (`provider-core/env-deps.ts`)** para eliminar os três
   `resolveDeps` duplicados (Decisão 4 da spec 014), validando via `envOrDefault`/`modelEnvOrDefault`
   que leem apenas de `getEnv()` no server (privacidade e segurança intactas).

## Consequências

- **Positivas:** o gate agora é enforced (qualquer função nova >10 falha o lint); a duplicação
  tripla de parse de env foi removida; a complexidade das camadas de segurança adapters/agentes
  foi reduzida sem mudar comportamento.
- **Negativas:** a decomposição aumenta ligeiramente a contagem de funções pequenas; exige
  disciplina para não reintroduzir `if` em cadeia longa. Nenhuma mudança de API, contrato, prompt,
  mensagem localizada, timeout, retry ou lista de blocos de rede foi feita.
- **Risco residual:** nenhum — a suíte completa (680 testes) e a verificação de cobertura
  continuam verdes, e o grep de mensagens/segurança não mostra mudança de literais.

## Alternativas consideradas

- **Manter `max: 16`**: rejeitado — não tornava o limiar saudável (10) enforced, permitindo
  regressão futura.
- **Baixar o gate antes de refatorar**: rejeitado — quebraria o build inteiro e misturaria
  "corrigir gate" com "refatorar", dificultando revisão.
- **Reescrever a lógica (melhorar design) em vez de decompor**: rejeitado — fora do escopo;
  a spec 014 é redução de complexidade com comportamento idêntico.
