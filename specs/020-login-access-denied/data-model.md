# Data Model — Mensagem de acesso negado no login

A feature **não introduz entidades nem persistência**. Não há banco, cache, cookie, `localStorage`
ou qualquer armazenamento durável. O trecho relevante é a **relação de mapeamento** entre chaves de
localização do Clerk e as cópias localizadas do app — dados **efêmeros e em memória** no cliente.

## Map (não-persistido; tabela de decisão estática)

| Chave Clerk (dentro de `signUp`) | Origem | Destino (cópia do app) | Quando aplica |
|----------------------------------|--------|-------------------------|---------------|
| `signUp.restrictedAccess.title` | Clerk `ptBR`/`enUS` | `login.accessDenied` (pt-BR + en) | Tela terminal de sign-up restrito (_invite-only_) — usuário não convidado |
| `signUp.restrictedAccess.subtitle` (opcional) | Clerk `ptBR`/`enUS` | default localizado (genérico) — sem override no MVP | Mesma tela restrita |
| erros de assinatura (credenciais, rede) | Clerk default | `login.signInError` / default Clerk | Transiente — **nunca** acesso negado |

## Validation rules (herdadas da spec)

- `accessDenied` e `signInError` NÃO contêm identificador (FR-002 / FR-003).
- `accessDenied` é **neutra** — indistinguível entre conta existente-sem-permissão e e-mail
  inexistente (US2/anti-enumeração).
- Override **estrita**: apenas `signUp.restrictedAccess` (title e, opcionalmente, subtitle); outras
  chaves de erro (`signIn`/credenciais/`unstable__errors`) permanecem **intactas** — jamais desenhar
  "acesso negado" em erro não-permissional (R-02/R-03). Nenhum override de chave de organizações
  (o app não usa organizações — fora de escopo).
- Mensagens presentes nos catálogos `pt-BR` e `en` (FR-005); sem string hardcoded (FR-005).

## State (transições)

Não há máquina de estados de dados. Ocorre apenas a **renderização condicional** da mensagem
localizada dentro do fluxo do `<SignIn>`/`<SignUp>` do Clerk quando o erro de permissão é emitido.