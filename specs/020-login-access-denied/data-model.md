# Data Model — Mensagem de acesso negado no login

A feature **não introduz entidades nem persistência**. Não há banco, cache, cookie, `localStorage`
ou qualquer armazenamento durável. O trecho relevante é a **relação de mapeamento** entre chaves de
localização do Clerk e as cópias localizadas do app — dados **efêmeros e em memória** no cliente.

## Map (não-persistido; tabela de decisão estática)

| Chave Clerk (topo de `LocalizationResource`) | Origem | Destino (cópia do app) | Quando aplica |
|----------------------------------------------|--------|-------------------------|---------------|
| `unstable__errors.not_allowed_access` | Clerk `ptBR`/`enUS` | `login.accessDenied` (pt-BR + en) | Cadastro recusado (_invite-only_) |
| `unstable__errors.organization_not_found_or_unauthorized` | Clerk default | `login.accessDenied` | Conta sem permissão na assinatura (genérico/anti-enumeração) |
| falhas não-relacionadas (credenciais, rede, captcha) | Clerk default | `login.signInError` / default Clerk | Erro transiente — **não** acesso negado |

## Validation rules (herdadas da spec)

- `accessDenied` e `signInError` NÃO contêm identificador (FR-002 / FR-003).
- `accessDenied` é **neutra** — indistinguível entre conta existente-sem-permissão e e-mail
  inexistente (US2/anti-enumeração).
- Override **estrita** só nas chaves de permissão (`not_allowed_access`,
  `organization_not_found_or_unauthorized`); jamais desenhar "acesso negado" em erro não-permissional
  (R-03).
- Mensagens presentes nos catálogos `pt-BR` e `en` (FR-005); sem string hardcoded (FR-005).

## State (transições)

Não há máquina de estados de dados. Ocorre apenas a **renderização condicional** da mensagem
localizada dentro do fluxo do `<SignIn>`/`<SignUp>` do Clerk quando o erro de permissão é emitido.