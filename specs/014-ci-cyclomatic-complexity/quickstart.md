# Quickstart & Validação: Redução da Complexidade Ciclomática

**Feature**: `014-ci-cyclomatic-complexity`

Este guia define o caminho de validação para provar que a redução de complexidade ciclomática
funciona de ponta a ponta. Como é uma **refatoração preservadora de comportamento**, a validação
não é um fluxo de usuário novo: ela consiste em provar que (a) as 19 funções alvo caíram para ≤10,
(b) o comportamento não mudou (testes existentes verdes sem alteração de expectativa), e (c) o gate
do ESLint evoluiu de 16 → 10 sem quebrar o CI.

> Detalhes de modelo de dados e contratos não são duplicados aqui — ver `data-model.md` e
> `contracts/no-contract-delta.md`. A implementação por story está em `tasks.md` (US1–US6).

## Pré-requisitos

- Node.js 22 LTS + Corepack pnpm.
- Branch `014-ci-cyclomatic-complexity` ativa e limpa (`git status`).
- `.specify/feature.json` apontando para `specs/014-ci-cyclomatic-complexity` (T003).
- Nenhuma credential real necessária: **os testes nunca chamam serviço de IA** — usam fakes/MSW.

## Estado inicial (baseline)

Antes de qualquer edição, o gate `complexity: ["error", { max: 16 }]` já está comitado
(`eslint.config.mjs`). A base inteira mede **100 funções** com max=16; há **19 violações** com
limiar 10 (17 produção/scripts + 2 testes). O backlog de dados está em
[`cyclomatic-complexity-backlog.md`](cyclomatic-complexity-backlog.md).

## Como validar a feature (cenários)

### Cenário 1 — Baseline verde antes de editar (T002)

Confirma que a árvore atual passa em lint/typecheck/testes antes da refatoração.

```bash
git status                # branch ativa e limpa
pnpm lint                 # 0 warnings, 0 errors (complexity max:16 → verde)
pnpm typecheck            # strict TS, sem `any` novo
pnpm test                 # suíte verde (fakes apenas)
pnpm test:coverage:check  # ≥80% overall; ≥90% safety/validation/orchestration
```

**Esperado**: todos os comandos saem com exit 0. Se `pnpm test` falhar por worker timeout em host
carregado, use `pnpm test:limited` (documentado no AGENTS.md).

### Cenário 2 — Redução por story, test-first (US1–US5)

Para cada função alvo (T010–T061), aplica-se o loop test-first:

1. **Teste fail-before**: escrever um teste de paridade que exercita a função na versão atual e
   confirma o comportamento atual (deve falhar apenas se a versão refatorada divergir). Rodar e
   confirmar que passa no estado atual (fixa a paridade).
2. **Refatorar**: decompor a função em sub-funções (extração de método / de ramificações) até a
   ciclomática ≤10, **sem** mudar semântica, tipos, erros, mensagens, timeout/retry, lista de
   blocos de rede ou cache de resolução.
3. **Pass-after**: repetir o mesmo teste e confirmar que continua verde após a refatoração.

```bash
pnpm test -- <arquivo-do-teste>   # fail-before confirma paridade no estado atual
# ... edit/refactor ...
pnpm test -- <arquivo-do-teste>   # pass-after confirma paridade preservada
```

**Esperado**: o mesmo `input → output` (incluindo casos de erro) antes e depois; nenhuma
expectativa de teste existente alterada.

### Cenário 3 — Confirmar que as 19 funções estão ≤10 (US6, T070)

Roda o ESLint com um limiar temporário de 10 **sem** commitá-lo ainda, para medir o progresso
(ou consulta a saída JSON do lint para contagem).

```bash
pnpm exec eslint --format json . | node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
  let n = 0;
  for (const f of data) if (f.messages.some(m => m.ruleId === "complexity")) n++;
  console.log("violações de complexity:", n);
'
```

**Esperado no final de US6**: `0` violações com limiar 10 nas 19 funções alvo.

### Cenário 4 — Evoluir o gate para 10 (US6, T071)

Somente depois de todas as funções ≤10:

```bash
# eslint.config.mjs: complexity: ["error", { max: 16 }]  →  ["error", { max: 10 }]
pnpm lint          # deve continuar 0 warnings/errors com o novo limiar
pnpm typecheck
pnpm test
pnpm build
```

**Esperado**: o CI permanece verde com `max: 10`; nenhuma função nova pode ultrapassar 10 sem
quebrar lint.

### Cenário 5 — Gates finais pós-edição (T073)

Após a **última mudança de arquivo** (um resultado anterior é STALE — AGENTS.md):

```bash
pnpm lint                # 0 warnings
pnpm format:check        # sem drift (rode pnpm format se necessário)
pnpm typecheck           # strict, sem `any` novo
pnpm test                # suíte determinística verde
pnpm test:coverage:check # gates de cobertura
pnpm build               # build de produção passa
```

**Esperado**: todos verdes em uma única execução final, na árvore exata que será commitada.

## Critérios de aceite (específicos da feature)

- As 19 funções alvo (T010–T061) estão ≤10 de ciclomática.
- Executa-se o **Evolution Gate**: `eslint.config.mjs` termina com `max: 10` e lint verde.
- Testes existentes seguem verdes **sem alteração de expectativa**; cada arquivo refatorado ganhou
  teste de paridade fail-before/pass-after.
- Nenhum contrato de API mudou (ver `contracts/no-contract-delta.md`); nenhum identificador direto
  novo; `Cache-Control: no-store` preservado.
- PR passa: hooks de lint/format/typecheck, testes, cobertura, storybook (`pnpm storybook:test`),
  e build de produção.

## Referências

- Modelo de dados (sem mudança): [`data-model.md`](data-model.md)
- Contratos (sem delta): [`contracts/no-contract-delta.md`](contracts/no-contract-delta.md)
- Backlog de medição: [`cyclomatic-complexity-backlog.md`](cyclomatic-complexity-backlog.md)
- Tasks de implementação por story: [`tasks.md`](tasks.md)
- Plano (decisões de clarificação): [`plan.md`](plan.md)
