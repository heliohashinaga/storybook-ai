# Contrato — Barreira anti-bot do /demo

This slice documents the **demo-mode** addition to the existing
`specs/001-personalized-story-generation/contracts/story-generation.openapi.yaml`. The payload
contract is unchanged; the anti-bot proof travels in a **header**, and one error code is added.

## `POST /api/stories`

### Header (nova — exigida no modo demo quando a feature está configurada)

| Header            | Tipo     | Obrigatório | Descrição                                                                 |
| ----------------- | -------- | ----------- | ------------------------------------------------------------------------- |
| `cf-turnstile-token` | `string` | demo: sim*  | Prova de uso único emitida pelo widget anti-bot (challenges.cloudflare.com). Anônima, curta. |

\* Exigido **somente** no modo **demo** e **somente** quando `TURNSTILE_SECRET_KEY` está
configurada. Modo playground (autenticado): **não** exigido. Sem configuração: feature desligada
(todos os modos como hoje).

O corpo da requisição permanece o enum fechado `ageBand|locale|theme|sceneCount` (Zod `.strict()`)
— a prova **não** amplia o corpo.

### Novo erro

| HTTP | `code`           | `retryable` | Significado                                                      |
| ---- | ---------------- | ----------- | --------------------------------------------------------------- |
| 403  | `captcha_failed` | `true`      | Provausente/inválida/expirada/replay, **ou** falha de rede do verificador (fail-closed). Gerador não invocado. |

Mensagem localizada (chave `story.error.captchaFailed`) e erro genérico (sem detalhes do side
interno da verificação). Resposta com `Cache-Control: no-store`.

> **Implementação**: aplicar estas adições na rota `/stories` do contrato canônico
> `001-personalized-story-generation/contracts/story-generation.openapi.yaml` (adicionar a
> resposta 403 + enum `captcha_failed` no `GenerationError` + documentar o header), e no enum de
> `safeErrorSchema` em `src/features/story-generation/server/schemas.ts`.