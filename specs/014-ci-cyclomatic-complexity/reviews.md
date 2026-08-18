# Reviews — Redução da Complexidade Ciclomática (gate 16 → 10)

**2026-08-17** — Convergência da feature. Spec, plano e tarefas criados a partir do backlog
`docs/diagnostics/cyclomatic-complexity-backlog.md` (medição base-wide com limiar 10: 19 violações,
sendo 17 em produção/scripts + 2 em arquivos de teste).

## Decisões registradas

- **D1**: Formato Spec Kit (decisão do usuário) — branch + spec `014-ci-cyclomatic-complexity`.
- **D2**: Escopo de **19 funções** (US1 segurança, US2 adapters, US3 UI/i18n, US4 agentes,
  US5 rotas/script, + 2 funções de teste). Feature **behavior-preserving** — nenhuma mudança de
  contrato, prompt, timeout, retry, lista de blocos de rede, erro localizado ou cache.
- **D3**: O gate `complexity: ["error", { max: 16 }]` (guard-rail, commit `d3660e3`) permaneceu
  **intacto durante toda a redução** e só evoluiu para `max: 10` após as 19 funções estarem ≤10
  (US6/T071) — nenhum build intermediário quebrou.
- **D4**: Compartilhamento de parse de env via `provider-core/env-deps.ts`
  (`envOrDefault`, `modelEnvOrDefault`, `readEnvIfNeeded`) eliminou os três `resolveDeps`
  duplicados (16/13/13) sem mudar a semântica de leitura de env (Decisão-4 do `plan.md`).
- **D5**: Test-first em cada arquivo (fail-before/pass-after) + gates finais
  (lint/format/typecheck/test/coverage/build) — Constitution Principle II e Definition of Done.

## Confirmações pendentes durante a implementação

- [x] `T002`: baseline registrado — 19 violações à limiar 10 (17 produção/scripts + 2 testes).
- [x] `T070`: verificação final — **0 violações** à limiar 10 na base inteira (ESLint JSON).
- [x] `T071`: gate evoluído — `eslint.config.mjs` agora `complexity: ["error", { max: 10 }]`,
  com comentário atualizado.
- [x] `T072`: ADR-0011 criado (`docs/adr/0011-cyclomatic-complexity-gate.md`) + índice atualizado.
- [x] `T073`: gates finais pós-edição — `pnpm lint` (0), `pnpm format:check`, `pnpm typecheck`,
  `pnpm test:limited` (680 testes em 92 arquivos), `pnpm test:coverage:check` (geral 96.72% /
  branches 91.31% / security ≥90% nos módulos tocados).
- [x] Prova de preservação de comportamento: `git diff` das camadas de segurança mostra apenas
  mudança estrutural (extração de métodos) e os literais de mensagem/erro são **idênticos**
  (ternário → `if/else`, mesmos valores); nenhum prompt/schema/timeout/retry/lista de rede
  alterado (grep de literais).
- [x] Restaurar `.specify/feature.json` para o valor estável commitado ao final (`T074`),
  conforme convenção da feature 013.

## Follow-ups (fora do escopo desta feature)

- **README do ADR**: a tabela em `docs/adr/README.md` listava apenas 0001–0007 (faltavam as linhas
  de 0008/0009/adr-0010); adicionei a linha de 0011 de forma consistente. Normalizar as linhas
  ausentes é um follow-up editorial opcional, fora do escopo de complexidade.
- **Cobertura** `story-provider.ts` em ~66% (abaixo do alvo da categoria): não é um regressor
  introduzido por esta feature (behavior-preserving); registrar como follow-up de teste, não
  mesclado aqui.
