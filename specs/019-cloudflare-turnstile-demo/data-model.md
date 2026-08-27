# Data Model — Proteção anti-bot do /demo

A feature **não introduz persistência**. Única entidade é **efêmera** e transitória; não há banco,
cache, cookie, `localStorage` nem qualquer armazenamento durável.

## Entities

### 1. Prova anti-bot (Turnstile token) — EFÊMERA, não persistida

| Campo      | Tipo       | Regras / validação                                                          |
| ---------- | ---------- | --------------------------------------------------------------------------- |
| `token`    | `string`   | Emitido pelo widget no cliente; **single-use**, TTL curto (~300s); viaja no header `cf-turnstile-token`. |
| `valid`    | `boolean`  | Resultado do `siteverify` server-side (`success`). Nunca confiado só no cliente. |
| `remoteIp` | `string?`  | Opcional, enviado ao `siteverify` para contexto; não armazenado.            |

**Transições**: `emitida (cliente)` → `verificada (server)` → `consumida` (single-use). Um token já
consumido/replay é rejeitado. Um token pode ser **`invalid`** (recusado) ou **`unverified`** (falha
de rede → fail-closed recusa a requisição).

**Relações**: uma prova é **estritamente por requisição demo** de geração — nunca associada a
história, ao parâmetro fechado `ageBand|locale|theme|sceneCount` de forma persistente, nem a
qualqueridentidade.

## Invariant (não entidades)

- `userId`/criança: **não modelado** — a demo segue anônima; a prova não carrega identidade.
- O estado do app (`StorySession`) e as histórias permanecem só em memória (inalterado).