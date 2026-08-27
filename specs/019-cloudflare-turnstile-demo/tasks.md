---

description: "Feature implementation tasks — Proteção anti-bot do /demo (Cloudflare Turnstile)"
---

# Tasks: Demo anti-bot (Cloudflare Turnstile)

**Input**: Design documents from `specs/019-cloudflare-turnstile-demo/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/demo-anti-bot.md

**Tests**: Incluídos (obrigatórios por AGENTS.md/Constitution II — test-first; escrever e ver falhar antes da implementação).

**Organization**: Tasks grouped by user story; cada história é independente e testável.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelo (arquivos diferentes, sem dependências)
- **[Story]**: história (US1…US4); Setup/Foundational/Polish sem label
- Caminhos exatos de arquivos

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: infra compartilhada (config, CSP, superfície de erro) antes de qualquer história.

- [ ] T001 Adicionar chaves Turnstile **opcionais** ao schema `.strict()` em `src/lib/env.ts`
      (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY`, ambas opcionais) e à lista
      `KNOWN_KEYS`; registrar no `.env.example` (bloco comentado opcional).
- [ ] T002 [P] Relaxar CSP em `next.config.ts` (rotulado "EXPLICIT RELAXATION"): adicionar
      `https://challenges.cloudflare.com` a `script-src`, `frame-src`, `connect-src` (e
      `style-src`/`img-src` se o widget exigir).
- [ ] T003 [P] Adicionar o erro `captcha_failed` (403, `retryable: true`): enum + const em
      `src/lib/http-errors.ts`; membro em `safeErrorSchema` (`src/features/story-generation/
      server/schemas.ts`); mapear 403 no `errorForStatus` de `src/features/story-reader/client/
      story-response.ts`; chaves `error.captchaFailed` em `src/features/story-request/locales/
      {en,pt-BR}.json`; resposta 403 + enum no contrato `specs/001-personalized-story-generation/
      contracts/story-generation.openapi.yaml` e em `specs/019-.../contracts/demo-anti-bot.md`.

**Checkpoint**: config/CSP/erro prontos; chaves ausentes ⇒ feature desligada (boot ok).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: os dois blocos centrais que as histórias consomem (verificador server + widget client).

- [ ] T004 Criar `src/features/story-generation/server/turnstile-verify.ts` (`server-only`):
      `verifyTurnstileToken({ token, secretKey })` chamando
      `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` (form-urlencoded,
      `secret`,`response`,`remoteip`); segue disciplina de rede SSRF/redirect do AGENTS; falhas de
      rede ⇒ `false`/erro tipado (**fail-closed**); sem secret ⇒ desligado. Violação de
      cobertura ≥90% não permitida (módulo de segurança/validação).
- [ ] T005 Criar `src/features/story-request/components/turnstile.tsx` (`'use client'`): injeta
      `https://challenges.cloudflare.com/turnstile/v0/api.js` (lazy), renderiza o desafio
      **non-interactive**, expõe o token single-use e estado de erro quando o `window.turnstile`
      não resolve; `reset()` após uso/falha; `aria`/retry acessível. No-op quando a site key não
      está configurada (feature off).

**Checkpoint**: verificador e widget compilam; implementação das histórias pode começar.

---

## Phase 3: User Story 1 - Visitante anônimo gera história demo normalmente (P1) 🎯 MVP

**Goal**: o `/demo` continua gerando para humanos, agora com o desafio **invisível** resolvendo em
segundo plano e a prova anexada ao POST — sem fricção, sem cookie.

**Independent Test**: fluxo demo completo (tema/idade/cenas → gerar → ler) funciona; o submit
envia o header `cf-turnstile-token`; sem widget resolvido o submit é **bloqueado** com erro
localizado retryável.

### Tests for US1 (escrever primeiro; devem FALHAR)

- [ ] T006 [P] [US1] Teste do widget `tests/unit/turnstile.test.tsx` (mock `window.turnstile`):
      script injetado; token recebido via callback; widget não carrega ⇒ estado de erro; reset
      após uso.
- [ ] T007 [P] [US1] Estender `tests/unit/story-request-form.test.tsx`: com site key configurada,
      enviar o token no `fetch` (header `cf-turnstile-token`); sem token disponível ⇒ submit
      bloqueado (onSubmit não chamado) e `aria-busy`/erro acessível; sem site key ⇒ comportamento
      atual.

### Implementation for US1

- [ ] T008 [US1] Renderizar `Turnstile` dentro do `src/features/story-request/components/
      story-request-form.tsx` e, no submit, obter o token (aguardar/exec) e anexá-lo ao header
      `cf-turnstile-token` do `POST /api/stories` em `story-request-app.tsx`; bloquear submit e
      resetar widget se o token não estiver disponível.

**Checkpoint**: humano gera história demo sem fricção; submit só com prova.

---

## Phase 4: User Story 2 - Requisições automatizadas/bots são bloqueadas (P1)

**Goal**: `POST /api/stories` em **modo demo** exige prova válida; sem ela, 403 e o gerador
(offline) **não** é invocado; replay/expirado rejeitado.

**Independent Test**: requisição demo sem token ou token inválido/expirado/replay ⇒ 403
`captcha_failed` e provider nunca chamado; token válido ⇒ 200.

### Tests for US2 (escrever primeiro; devem FALHAR)

- [ ] T009 [P] [US2] Unit `tests/unit/turnstile-verify.test.ts` (mock global `fetch`): sucesso;
      `success:false`; falha de rede ⇒ rejeita (fail-closed); sem secret ⇒ desligado.
- [ ] T010 [P] [US2] Contrato rota `tests/contract/stories-route.turnstile.test.ts` (handler com
      `enforceTurnstile: true` + seam `turnstile` fake): sem header ⇒ 403 e provider **não**
      invocado; token inválido ⇒ 403; token válido ⇒ 200; `enforceTurnstile: false` ⇒ 200 sem
      token (playground).

### Implementation for US2

- [ ] T011 [US2] Em `src/app/api/stories/route.ts`, adicionar seam `turnstile` +
      `enforceTurnstile` a `StoriesRouteDeps`; antes de gerar, ler header `cf-turnstile-token`,
      verificar (via `turnstile-verify`) e, se inválido/ausente ⇒ `403 captcha_failed`; prover os
      deps reais no `POST` exportado (exigir **somente** quando `resolveGenerationMode() ===
      "demo"` **e** secret configurado).

**Checkpoint**: bots bloqueados antes de qualquer geração.

---

## Phase 5: User Story 3 - Privacidade e superfícies intactas (P0 — invariante)

**Goal**: a demo segue anônima (sem cookie/identidade); payload fechado; `/form`, `/reader`,
`/demo/reader` inalterados; a proofata é efêmera e não associada.

**Independent Test**: asserts de invariante (payload do `POST` rejeita campo além do enum; demo
sem cookie/identidade; proba não persistida) e `/form`/`/reader`/`/demo/reader` sem regressão.

### Tests for US3

- [ ] T012 [P] [US3] Asserts de privacidade: estender `tests/contract/stories-route.test.ts` e/ou
      `tests/integration/privacy-boundary.test.tsx` — payload fechado continua rejeitando campo
      extra; `/demo` continua sem cookie/`localStorage`/identificador; token não vaza a logs/
      observability (`lib/observability.ts` scrub).
- [ ] T013 [P] [US3] Estender `tests/e2e/security-headers.spec.ts`: CSP inclui
      `challenges.cloudflare.com`; `/demo` preserva os invariantes (sem `__clerk_*`/sessão).
- [ ] T014 [P] [US3] ADR `docs/adr/0014-cloudflare-turnstile-demo.md`: documentar a **relaxação
      do "zero contato de terceiros"** da demo (non-interactive sem cookie/identidade), a exceção
      `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (como ADR 0013/Clerk), o relaxamento de CSP e que
      `/form`,`/reader`,`/demo/reader` ficam intactos.

**Checkpoint**: invariantes cobertos por testes; relaxação documentada e não silenciosa.

---

## Phase 6: User Story 4 - Degradação e opt-in (P2)

**Goal**: sem configuração ⇒ demo como hoje; com configuração e verificador indisponível ⇒ erro
localizado retryável (fail-closed), nunca gera sem verificação.

**Independent Test**: feature sem chaves ⇒ gera como hoje; verificador fora ⇒ 403 `captcha_failed`
localizado e nenhuma geração.

### Tests for US4

- [ ] T015 [US4] Estender `tests/unit/env.test.ts`: sem as chaves, `getEnv()` ok e feature off.
- [ ] T016 [P] [US4] Estender `tests/contract/stories-route.turnstile.test.ts`: `enforceTurnstile`
      com verificação indisponível (fetch rejeita) ⇒ 403 localizado retryável e provider não
      invocado.

### Implementation for US4

- [ ] T017 [US4] Garantir rotas: `story-request-app.tsx` roteia `captcha_failed` ⇒
      chave localizada `story.error.captchaFailed` (catalog já em Setup), e o form permite novo
      desafio/retry (widget resetado).

**Checkpoint**: degradação segura e feature opt-in.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: gates e polish finais.

- [ ] T018 [P] Rodar `scripts/quickstart` headless de validação manual (chaves de teste Cloudflare
      `1x…AA` passa / `2x…AB` bloqueia) conforme `specs/019-.../quickstart.md`.
- [ ] T019 [P] Verificar que `/form`,`/reader`,`/demo/reader` não regrediram visualmente
      (`pnpm test:visual`), bundle de JS do `/demo` dentro do orçamento (`pnpm test:performance`),
      `.stories.tsx` do form atualizadas (estados default/loading/error).
- [ ] T020 Rodar os gates finais após a ÚLTIMA edição: `pnpm format` + `pnpm format:check`,
      `pnpm lint` (0 warnings), `pnpm typecheck`, `pnpm test:limited`, `pnpm build`.

**Checkpoint**: tudo verde; feature pronta para review/PR.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — começa imediato.
- **Foundational (Phase 2)**: depende de Setup (T001/T003) — **bloqueia** todas as histórias
  (T004 usa a env/secret; T005 usa a site key).
- **US1 (Phase 3)**: depende de Foundational (T005).
- **US2 (Phase 4)**: depende de Foundational (T004) e Setup (T001/T003).
- **US3 (Phase 5)**: paralela às implementações (tests/ADRs bem separados).
- **US4 (Phase 6)**: depende de US2 (T011) e Setup (T003).
- **Polish (Phase 7)**: depende de todas as histórias desejadas.

### User Story Dependencies

- **US1 (P1)**: independente (só widget + form).
- **US2 (P1)**: independente (só rota + verify) — pode rodar em paralelo a US1 (arquivos distintos:
  `turnstile.tsx`/`story-request-form.tsx` vs `turnstile-verify.ts`/`route.ts`).
- **US3 (P0)**: independente (tests + ADR).
- **US4 (P2)**: depende de US2 (mesmo handler/verify).

### Within Each User Story

- Testes (`T006…T017`) **escritos e falhando antes** da implementação correspondente.
- Infra de erro (Setup) antes do route/US2.
- Story completa antes de avançar à próxima prioridade.

### Parallel Opportunities

- Setup T002/T003 paralelos.
- US1 e US2 **podem** rodar em paralelo (arquivos não se cruzam).
- Tests dentro de uma história paralelos (arquivos distintos).

---

## Parallel Example: US1 + US2

```bash
# US1 — widget + form (arquivos: turnstile.tsx, story-request-form.tsx, story-request-app.tsx)
Task: "T006 turnstile.test.tsx" + "T007 story-request-form.test.tsx" + "T008 implement form wiring"
# US2 — rota + verify (arquivos: turnstile-verify.ts, route.ts, schemas/http-errors)
Task: "T009 turnstile-verify.test.ts" + "T010 stories-route.turnstile.test.ts" + "T011 implement route"
```

---

## Implementation Strategy

### MVP First (US1 only) 🎯
1. Setup (T001–T003)
2. Foundational T005 (widget) — T004 pode ficar para US2
3. US1 (T006–T008): `/demo` gera com o desafio invisível + token anexado
4. STOP + validar (quickstart: human demo feliz; submit sem widget bloqueado)
5. Deploy/demo se pronto

### Incremental
- Add US2 (T009–T011) → bots bloqueados → testar/entregar
- Add US3 (T012–T014) → invariantes + ADR
- Add US4 (T015–T017) → degradação/opt-in
- Polish (T018–T020)

### Parallel Team
- Dev A: US1; Dev B: US2 (após Foundational). US3/ADR podem ir junto.

---

## Notes

- **Test-first**: todos os testes das fases falham antes da implementação (AGENTS/Constitution II).
- **Fail-closed (US2/US4)**: nunca gerar sem verificação; indisponibilidade ⇒ 403 localizado.
- **[P]** = arquivos diferentes, sem dependência; evita conflitos de mesmo arquivo.
- **Cobertura**: `turnstile-verify.ts` ≥90% (módulo de segurança/validação); coverage global ≥80%.
- Commit por grupo lógico; validar já para a feature, não para cada linha.
- Tracker: `.specify/tasks/` deve refletir o progresso conforme concluído.