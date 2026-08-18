# Contratos: Redução da Complexidade Ciclomática

**Feature**: `014-ci-cyclomatic-complexity`

## Declaração de "no contract delta"

Esta feature é uma refatoração preservadora de comportamento. **Nenhum contrato externo muda.**
O contrato canônico do produto é
[`story-generation.openapi.yaml`](../../001-personalized-story-generation/contracts/story-generation.openapi.yaml),
e ele permanece **inalterado** por esta feature.

## Contratos públicos preservados (fora de escopo)

- **`POST /api/stories`** — request: `{ ageBand, locale, theme, sceneCount }` (Zod `.strict()`);
  response: multi-scene `Story` (3–5 scenes) + ilustrações; `Cache-Control: no-store`. Intacto.
- **`POST /api/narrate`** — request: `{ sceneText, locale }` (max 2000); `Cache-Control:
  no-store`. Intacto.
- **Regras de privacidade** — nenhum identificador direto (nome/id/token/UUID) em path, query ou
  body; nenhum `NEXT_PUBLIC_*` novo. Intacto.
- **Erros/safety** — mensagens localizadas (`pt-BR`/`en`) e o fluxo moderar→regenerar uma vez→erro
  genérico localizado permanecem idênticos, incluindo texto e código.

## O que muda (e o que não muda no contrato)

| Aspecto               | Muda?            | Detalhe                                                            |
| --------------------- | ---------------- | ------------------------------------------------------------------ |
| Schemas de entrada    | ❌ Não           | Mesmos enums, limites e `.strict()`.                               |
| Respostas/status HTTP | ❌ Não           | Mesmos códigos e corpos.                                           |
| Erros localizados     | ❌ Não           | Mesmas chaves de catálogo `pt-BR`/`en` e mensagens.                |
| Headers               | ❌ Não           | `Cache-Control: no-store` e demais segurança preservados.          |
| Estrutura interna     | ✅ Sim (interno) | Funções de produção/scripts/testes com complexidade >10 são decompostas em sub-funções; **sem efeito observável externamente**. |

A única mudança real é **código interno**: as 19 funções (17 produção/scripts + 2 testes) são
reestruturadas para ≤10 de ciclomática e o limiar do ESLint evolui de 16 → 10 (`eslint.config.mjs`,
US6/T071). Esse limiar é uma ferramenta de CI, não um contrato de API.

## Verificação no capítulo da feature

- Testes de contrato existentes (API-contract contra o OpenAPI faked) devem permanecer **verdes
  sem alteração de expectativa**.
- Se a implementação descobrir a necessidade de mudar algum contrato (fora do escopo), isso deve
  ser tratado como escopo novo e sinalizado — não silencioso — antes do merge.
