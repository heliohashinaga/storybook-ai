# Quickstart: Validar a mensagem de acesso negado no login

**Feature**: `020-login-access-denied` | **Branch**: `feature/020-login-access-denied`

Guia de validação ponta-a-ponta. Detalhes de contrato em
[contracts/localization-override.md](contracts/localization-override.md); dados em
[data-model.md](data-model.md); especificação em [spec.md](spec.md).

## Pré-requisitos

- Repo com Clerk configurado (`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) e o
  sign-up no **modo restricted/invite-only** (painel do Clerk). Sem Clerk, o caminho demo é a
  validação mínima (ver §4).
- `pnpm install` + `pnpm build` para o ran do app.

## 1. Validação de código (hermética, sem rede)

```bash
pnpm test -- --run src/features/auth        # teste unitário do override de localização
pnpm storybook:test                          # story de LoginScreenView (pt-BR + en) + a11y
pnpm lint && pnpm format:check && pnpm typecheck
```

**Esperado**:
- `clerkLocalizationFor({ locale: 'pt-BR' })` e `({ locale: 'en' })` mapeiam
  `unstable__errors.not_allowed_access` e `organization_not_found_or_unauthorized` para
  `login.accessDenied`, com as cópias pt-BR/en corretas.
- Invariante: nenhuma cópia resultante contém e-mail/identificador.
- Story de `LoginScreenView` cobre o frame login; a11y (contraste) passa.

## 2. Validação manual (fluxo invite-only)

1. `pnpm dev` → abra `/` (login).
2. Tente se cadastrar com um e-mail **fora da permissão** (não convidado).
3. **Esperado**: cadastro recusado e o usuário vê a mensagem localizada **"Esta conta não pode
   entrar aqui."** (pt-BR) / **"This account can't sign in here."** (en) — via fmt do fluxo do Clerk,
   sem expor o e-mail.
4. Repita com um e-mail **inexistente** na assinatura de login.
5. **Esperado**: resposta **neutra/genérica**, indistinguível da do item 3 (anti-enumeração).

## 3. Regressões

- Login de um usuário **autorizado** (convidado) entra normalmente, direto ao playground — **sem**
  mensagem de acesso negado.
- Tela `/` em deploy **somente-demo** (sem chaves Clerk) mostra apenas o painel da demo anônima,
  sem mensagem de acesso negado.
- Demo (`/demo`) continua funcional e sem cookie.

## 4. Caminho demo (sem Clerk)

Sem chaves Clerk, o override de localização não é exercido (não há `<SignIn>`). Valide apenas que
`/` exibe o painel da demo e que `/demo` gera história fake — comportamento inalterado (spec 015/018).

## Critérios de aceite (SC)

- SC-001: 100% de cadastros recusados (_invite-only_) exibem `login.accessDenied` localizado.
- SC-002: nenhuma mensagem exibida contém identificador (assertado por teste).
- SC-003: 100% de logins autorizados concluem sem mensagem de acesso negado espúria.
- SC-004: demo anônima permanece 100% funcional para usuários recusados.