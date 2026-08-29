# Tasks: Mensagem de acesso negado no login

**Input**: design docs de `/specs/020-login-access-denied/`

**Prerequisites**: plan.md (required), spec.md, research.md (R-01), data-model.md,
contracts/localization-override.md

**Tests**: incluídos (obrigatórios — Constitution II: test-first; SC-002 demanda assert de
privacidade).

**Organization**: grupos por user story (independência de implementação/teste).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos diferentes, sem dependência)
- **[Story]**: US1 | US2 | US3
- Caminhos exatos em cada descrição.

## Repo layout relevante

Web app (Single): `src/` na raiz; testes **co-localizados** (`src/**/*.test.ts(x)`,
`vitest.config.ts` inclui `src/**` e `tests/**`). Storybook em `*.stories.tsx`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar pré-requisitos e ancorar o ponto de override do Clerk.

- [ ] T001 Verificar que **nenhuma dependência nova** é necessária (`@clerk/nextjs` ^7.8.1,
      `@clerk/localizations` ^4.15.6 já presentes no `package.json`) e que as strings
      `login.accessDenied`/`login.signInError` existem em `src/features/auth/locales/pt-BR.json`
      e `src/features/auth/locales/en.json` (reaproveitadas, sem duplicar).
- [ ] T002 [P] Confirmar que a chave **`signUp.restrictedAccess`** (title/subtitle/actionLink)
      existe aninhada em `signUp` em `node_modules/@clerk/localizations/dist/pt-BR.mjs` e
      `en-US.mjs` (validado em research R-01); documentar o shape verificado em
      `contracts/localization-override.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Builder puro de override + seu teste hermético — **bloqueia** as user stories.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

### Tests (test-first — escrever ANTES, devem FALHAR)

- [ ] T003 Escrever teste unitário (falhando) em `src/features/auth/client/clerk-localization.test.ts`:
      dado `locale='pt-BR'` e `locale='en'`, `buildClerkLocalization(locale, accessDenied)` deve
      (a) sobrescrever **`signUp.restrictedAccess.title`** com a cópia `accessDenied` do app;
      (b) **não** alterar outras chaves de erro (ex.: `signIn`/credenciais/`unstable__errors`) —
      preserva a anti-enumeração do default genérico do Clerk;
      (c) manter `signIn.start.title/subtitle` vazios (regressão do atual); (d) preservar as demais
      chaves do `base` (comparação **profunda/par a par** com o `base` espalhado).

### Implementation

- [ ] T004 Implementar `buildClerkLocalization(locale: 'pt-BR' | 'en', accessDenied: string):
      ClerkLocalization` em `src/features/auth/client/clerk-localization.ts` — função pura,
      **spread defensivo** sobre o `base` `enUS`/`ptBR` (nunca quebra se uma chave sumir),
      sobrescrevendo **`signUp.restrictedAccess.title`** → `accessDenied`, e mantendo o blank de
      `signIn.start`. **Somente** a tela restrita é alterada; demais chaves de erro intactas.
      **Sem `any`.**

**Checkpoint**: builder testado e verde; base pronta para as user stories.

---

## Phase 3: User Story 1 - Cadastro recusado com mensagem clara (Priority: P1) 🎯 MVP

**Goal**: cadastro _invite-only_ recusado exibe `login.accessDenied` localizado no fluxo do `<SignIn>`.

**Independent Test**: `pnpm test -- --run src/features/auth` verde; manual: cadastrar e-mail
não-convidado em `/` → vê "Esta conta não pode entrar aqui." (pt-BR) / "This account can't sign in
here." (en), sem expor e-mail.

### Implementation for User Story 1

- [ ] T005 [P] [US1] Refatorar `clerkLocalizationFor` em `src/features/auth/components/login-screen-view.tsx`
      para delegar a `buildClerkLocalization` (importado de `../client/clerk-localization`), passando
      `useTranslations("login")("accessDenied")` como cópia; remover a lógica local duplicada de
      override (mantendo apenas o uso do builder).
- [ ] T006 [P] [US1] Atualizar `src/features/auth/components/login-screen.stories.tsx`: garantir que o
      frame de `LoginScreenView` renderiza o fallback demo (sem Clerk) sem mensagem de acesso negado,
      em pt-BR e en (guard de regressão do frame).

**Checkpoint**: US1 funcional e testável isoladamente.

---

## Phase 4: User Story 2 - Assinatura neutra/anti-enumeração (Priority: P2)

**Goal**: tentativa de login de conta sem permissão → mensagem genérica (`accessDenied`),
indistinguível de e-mail inexistente; sem vazar identificador.

**Independent Test**: `pnpm test -- --run src/features/auth` verde (assert de neutralidade e de
privacidade); manual: login com e-mail inexistente vs sem-permissão → respostas idênticas.

### Tests for User Story 2 (estender o builder)

- [ ] T007 [US2] Estender `src/features/auth/client/clerk-localization.test.ts`: assert de
      **neutralidade** (o `base` de erros de assinatura/`unstable__errors` permanece **intacto** —
      `buildClerkLocalization` não toca chaves de credenciais/desconhecidos, preservando respostas
      genéricas e indistinguíveis) e **privacidade** (a cópia `accessDenied` não contém padrão de
      e-mail/identificador — regex simples).

### Implementation for User Story 2

- [ ] T008 [US2] Confirmar/garantir que erros **não-permissionais** (credenciais erradas, rede,
      captcha) resolvem para `login.signInError`/default do Clerk — **nunca** `accessDenied`
      (verificação no `login-screen-view.tsx`; ajustar `buildClerkLocalization` somente se o teste
      T007 falhar).

**Checkpoint**: US1 e US2 funcionam independentemente (mesmo código de override, distintos asserts).

---

## Phase 5: User Story 3 - Fluxo feliz intacto (regressão) (Priority: P2)

**Goal**: login autorizado sem mensagem espúria de acesso negado; nenhuma regressão no caminho feliz.

**Independent Test**: story `LoginScreenView` (pt-BR + en) renderiza sem acesso negado; e2e
(Playwright) smoke de navegação `/` → demo sem mensagem de acesso negado.

### Implementation for User Story 3

- [ ] T009 [US3] Adicionar teste de componente no story/`*.test.tsx`: `LoginScreenView` em modo demo
      (sem Clerk) e estado default **não** contém texto de "acesso negado"/acesso restrito — prova
      de que o override não acende em estado não-permissional.
- [ ] T010 [P] [US3] Smoke e2e opcional em `tests/e2e/` (Playwright): rota `/` (deploy demo) renderiza
      painel demo sem acesso negado; demo (`/demo`) gera história fake (regressão spec 015/018).

**Checkpoint**: os três stories funcionam; MVP e incrementos validados.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: documentação, qualidade e gates.

- [ ] T011 [P] Documentação: registrar o override (mensagem localizada de acesso negado via
      `signUp.restrictedAccess.title`) no `specs/020-login-access-denied/quickstart.md` e
      `contracts/localization-override.md` (já existem — revisar coerência com a implementação e
      com a validação da chave em research R-01); sem conflito com spec 018 (não adicionar roles;
      apenas mensagem).
- [ ] T012 Rodar **gates finais** após a última edição: `pnpm lint` (0 warnings),
      `pnpm format:check` (rodar `pnpm format` nos arquivos editados), `pnpm typecheck`,
      `pnpm test -- --run src/features/auth`, e validar `pnpm test:coverage:check` (regras ≥90% de
      segurança/validation/orchestration — o builder de auth é módulo sensível). Como sanity check
      de performance (meta do plano), conferir que o bundle da rota `/` não cresceu (override reusa
      clerk-js já lazy) — ex.: `pnpm build` sem alerta de tamanho novo relevante.
- [ ] T013 [P] Pass de segurança/privacidade: revisar diff para ausência de `NEXT_PUBLIC_*` novo,
      ausência de e-mail/identificador nas cópias, e `Cache-Control: no-store` das APIs intacto
      (nenhuma rota de API tocada).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: sem dependências — começa imediato.
- **Foundational (P2)**: depende do Setup; **bloqueia** todas as user stories.
- **User Stories (P3-5)**: dependem da Foundational (builder + teste). Podem progredir em
  sequência P1→P2→P3 (mesmo override de código; difere nos asserts/manutenção).
- **Polish (P6)**: depende de todas as user stories desejadas.

### User Story Dependencies

- **US1 (P1)**: começa após Foundational; sem dependência de outras stories.
- **US2 (P2)**: começa após Foundational; estende o **mesmo** builder (T007/T008) — por isso
  sugerido **após** US1 (editam/validam a mesma função) para evitar conflito no arquivo
  `clerk-localization.test.ts` / `.ts`.
- **US3 (P2)**: independente em arquivos (components/tests/e2e); pode rodar em paralelo a US2.

### Within Each User Story

- Teste (T003/T007/T009) escrito e **falha** antes da implementação (T004/T008 e uso no US1).
- Builder antes do wiring na UI; core antes da integração/story.

### Parallel Opportunities

- Setup: T002 marcado [P] (arquivo de contrato — independente de T001).
- Foundational: T003 antecede T004 (mesma função) — **não** paralelizáveis entre si.
- US1: T005 e T006 em arquivos distintos → paralela.
- US3: T009 e T010 em arquivos distintos → paralela.
- Polish: T011 e T013 em arquivos distintos → paralela; T012 é a âncora final.

---

## Parallel Example: User Story 1

```bash
# T005 (UI wiring) e T006 (story) em paralelo — arquivos distintos:
Task: "Refatorar clerkLocalizationFor em src/features/auth/components/login-screen-view.tsx"
Task: "Atualizar src/features/auth/components/login-screen.stories.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Setup (P1) → Foundational (P2: builder + teste) → **US1 (P3)** → **STOP e VALIDAR**
   (`pnpm test -- --run src/features/auth` + manual invite-only).
2. Deploy/demo se pronto.

### Incremental Delivery

1. Setup + Foundational → base pronta.
2. +US1 (cadastro recusado mostra `accessDenied`) → testar → demo.
3. +US2 (assinatura anti-enumeração) → testar → demo.
4. +US3 (regressão do fluxo feliz / e2e) → testar → demo.

---

## Notes

- [P] = arquivos diferentes, sem dependência.
- [Story] mapeia para spec.md; US1/US2 compartilham o mesmo override de código — a separação é de
  **assert** (cadastro vs assinatura/neutralidade), para manter cada story independentemente testável.
- Testes herméticos (sem rede/Clerk); nenhuma chamada live em testes.
- Commit após cada task/grupo lógico; re-rodar gates após a última edição (AGENTS.md).