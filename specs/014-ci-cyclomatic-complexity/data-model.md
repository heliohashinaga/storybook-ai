# Data Model: Redução da Complexidade Ciclomática

**Feature**: `014-ci-cyclomatic-complexity`

## Resumo

Esta feature é uma **refatoração preservadora de comportamento**. Ela **não introduz, altera ou
remove nenhuma entidade de dados** da aplicação. Nenhum campo novo chega à API, nenhum campo muda
de tipo ou cardinalidade, e nenhuma relação é criada ou quebrada. O `POST /api/stories` e o
`POST /api/narrate` mantêm exatamente os mesmos schemas Zod `.strict()` e as mesmas respostas.

## Declaração de "no data-model change"

- **Sem novas entidades**: não há tabela, coleção, schema Zod novo, tipo de domínio novo ou estado
  persistente adicionado.
- **Sem mudança de campos**: os contratos de entrada/saída (`ageBand`, `locale`, `theme`,
  `sceneCount`; e `sceneText`/`locale` para narrate) permanecem idênticos.
- **Sem mudança de relação**: `Story` (multi-scene) e `Narration` mantêm as mesmas granularidade
  e cardinalidade atuais (3–5 scenes; 1 narração por texto).
- **Sem estado persistente**: a aplicação continua sem cookies, localStorage, indexDB ou cache de
  história; o modelo de privacidade anônima (Princípio não-negociavel do AGENTS.md) é intocado.

## Entidades internas tocadas (não são modelo de dados)

A refatoração atua sobre **funções** (unidades de lógica), não sobre dados. As entidades a seguir
aparecem como "alvos" porque são as funções cuja complexidade ciclomática será reduzida, mas o
contorno de seus dados de entrada/saída permanece o mesmo:

| Área            | Função / alvo                                   | Função atual / arquivo |
| --------------- | ----------------------------------------------- | ---------------------- |
| Segurança       | `ipv4IsPrivate` (15)                            | `provider-core/url-safety.ts` |
| Segurança       | `isSafeImageUrl` (11)                           | `provider-core/url-safety.ts` |
| Segurança       | `postImages` (11)                               | `provider-core/image-client.ts` |
| Segurança       | `moderateOneCandidate` / `moderateCandidate`    | safety-pipeline     |
| Adapter/Provider| `resolveDeps` (16/13/13)                        | openrouter / opencode / openrouter-tts |
| UI              | `Progress` (13), `Select` (11)                  | `components/ui/*.tsx` |
| i18n            | `deepMerge` (12)                                | `i18n/config.ts` |
| Agent           | `planStory` (11), `writeStory` (13), `moderateStory` (11) | `agents/*.ts` |
| Rotas           | `POST /api/stories` (12), `POST /api/narrate` (11) | routes |
| Scripts         | `parseFlags` (11)                               | `scripts/generate-fake-content.ts` |
| Testes          | `generateStory` (16), `deepMerge` (12)          | fixtures / unit test |

**Regra de convergência**: para cada linha acima, antes/depois da extração de sub-funções, as
entradas e saídas (tipos, valores de erro, mensagens localizadas, códigos HTTP, `Cache-Control:
no-store`) devem ser **bit-a-bit idênticas**, comprovadas por teste de paridade fail-before /
pass-after (US1–US5).

## Validação / regras preservadas (não alteradas)

- Schemas de entrada permanecem `Zod .strict()` com os mesmos enums e limites (ex.: `sceneText`
  max 2000, `locale` `pt-BR | en`, `theme` nos 6 valores, `sceneCount` 3–5).
- Nenhum identificador direto (nome, id, token, UUID) entra na rota/query/body.
- As respostas de geração permanecem `Cache-Control: no-store`.

## Transições de estado

- **N/A na camada de dados**: não há máquina de estados persistente nem transição de entity
  alterada.
- Na camada de pipeline, o fluxo `story → safety → illustrations` mantém os mesmos estados e
  regras (moderação → regeneração única → erro genérico localizado na falha). A única mudança é a
  **estrutura interna** (em quantas funções o cálculo é dividido), nunca a semântica.

## Conclusão para validação

Como não há modelo de dados novo, a validação desta feature não passa por esquemas/migrações. Ela
passa pelos gates de qualidade: `pnpm lint` (com o limiar evoluído para 10 na US6), `pnpm
typecheck`, `pnpm test` e `pnpm test:coverage` — ver `quickstart.md`. As checagens de paridade de
contrato/privacidade (nenhum campo novo na API, nenhum identificador direto) seguem cobertas pelos
testes de contrato existentes que devem continuar verdes **sem alteração de expectativa**.
