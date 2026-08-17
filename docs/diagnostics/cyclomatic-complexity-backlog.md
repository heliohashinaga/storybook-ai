# Cyclomatic Complexity — Backlog de redução

**Relacionado**: gate de complexidade criado na branch `014-ci-cyclomatic-complexity`
(regra ESLint `complexity: ["error", { max: 16 }]`, commit `69b9215`).

O gate atual é um **guard-rail** em 16 (máximo global atual). Para evoluí-lo a um limiar
saudável (`<=10`) é preciso **reduzir as funções abaixo**, que hoje ultrapassam 10.

## Dados (medidos via ESLint, base inteira — 100 funções, max=16)

| Complexidade | Função                 | Arquivo                                                           | Prioridade              |
| ------------ | ---------------------- | ----------------------------------------------------------------- | ----------------------- |
| **16**       | `resolveDeps`          | `story-generation/server/openrouter-story-generation-provider.ts` | Alta                    |
| **15**       | `ipv4IsPrivate`        | `story-generation/server/provider-core/url-safety.ts`             | **Crítica** (segurança) |
| 13           | `Progress`             | `components/ui/progress.tsx`                                      | Média                   |
| 13           | `resolveDeps`          | `story-generation/server/opencode-story-generation-provider.ts`   | Alta                    |
| 13           | `resolveDeps`          | `story-read-aloud/server/openrouter-tts-provider.ts`              | Média                   |
| 12           | `deepMerge`            | `i18n/config.ts`                                                  | Média                   |
| 11           | `Select`               | `components/ui/select.tsx`                                        | Média                   |
| 11           | `isSafeImageUrl`       | `story-generation/server/provider-core/url-safety.ts`             | **Crítica** (segurança) |
| 11           | `postImages`           | `story-generation/server/provider-core/image-client.ts`           | Alta                    |
| 11           | `moderateOneCandidate` | (safety pipeline)                                                 | Alta                    |
| 11           | `moderateCandidate`    | (safety pipeline)                                                 | Alta                    |

> Nota: contagem com limiar 10 resulta em **11 funções** a refatorar (a medição em texto
> mais permissiva reportou 16; o JSON parseado sobre a base inteira é o ground truth).

## Escopo sugerido (spec/feature de redução)

- **Priorizar segurança** (cobertura ≥90% em CI): `ipv4IsPrivate` (15) e `isSafeImageUrl` (11)
  em `url-safety.ts`, e `postImages` (11) em `image-client.ts`.
- **Adapters/providers**: os três `resolveDeps` (16/13/13) — extrair helper de leitura env
  por campo (mesmo padrão em openrouter/opencode/tts).
- **UI/i18n**: `Progress` (13), `Select` (11), `deepMerge` (12).
- Estratégia: **não** misturar com o refactor de orquestração do spec 013 (branch `013`);
  registrar como **feature/spec própria** e abaixar o limiar do ESLint para 10 **somente
  depois** que todas as funções ≤ 10.

## Ação recomendada

Criar um novo spec (ex.: `015-reduce-cyclomatic-complexity`) com uma task por arquivo,
refatorar seguindo test-first, e então mudar o limiar `max: 16` → `max: 10` no
`eslint.config.mjs`. Manter o gate em 16 até lá para não quebrar o CI.
