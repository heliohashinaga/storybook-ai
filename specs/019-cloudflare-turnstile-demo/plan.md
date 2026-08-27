# Implementation Plan: Proteção anti-bot da rota demo (Cloudflare Turnstile)

**Branch**: `feature/019-cloudflare-turnstile-demo` | **Date**: 2026-08-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/019-cloudflare-turnstile-demo/spec.md` + decisões do
dono (proteger **o `/demo`**, não login; modo **não-interativo**; prova **single-use**; demo
anônima preservada; `/form`, `/reader` e `/demo/reader` intactos) + ADR de privacidade a registrar.

## Summary

Proteger o `/demo` — a única rota **pública e anônima** que dispara a geração de histórias — contra
inundação automatizada (bots/DoS). Uma barreira anti-bot **não-interativa e invisível** (Cloudflare
Turnstile) é adicionada ao formulário de pedido da demo: a `POST /api/stories` em **modo demo**
passa a exigir uma **prova de uso único**, validada **server-side** e de forma **independente**,
**antes** de qualquer geração. Sem prova válida, a geração não ocorre (o gerador offline/demo não é
invocado). A restrição aplica-se **somente** ao modo demo anônimo; o playground autenticado segue
com auth + rate-limit por IP. A prova é **efêmera, anônima e sem cookie** — a demo permanece sem
identidade/persistência.

## Technical Context

**Language/Version**: TypeScript strict; Next.js 16 (App Router); React 19; Tailwind v4 + tokens;
next-intl (pt-BR + en); Zod v4.

**Primary Dependencies**:
- **Adicionar**: **nenhuma lib server** — a verificação `siteverify` é uma chamada HTTP direta
  (`fetch`) ao endpoint fixo do Turnstile, dentro de um módulo `server-only`. No cliente, o widget
  é carregado via **script oficial** `https://challenges.cloudflare.com/turnstile/v0/api.js`
  (injetado dinamicamente) — **sem pacote npm** cliente (mantém bundle leve e controla o CSP).
- **Config (fora do código)**: um par de chaves Turnstile no painel Cloudflare — **site key**
  (pública, browser) + **secret key** (server-only).

**Storage**: N/A — zero persistência adicionada. A prova é **efêmera** (curta, de uso único),
validada contra o serviço externo e **não** armazenada pelo app.

**Auth / Sessions**: inalterado. A proteção incide no `POST /api/stories` **somente quando o modo
é `demo`** (viz. `resolveGenerationMode`). O playground autenticado e o `/api/narrate` não são
tocados.

**Privacy invariants (inalterados)**: payload `POST /api/stories` permanece fechado
(`ageBand|locale|theme|sceneCount`, Zod `.strict()`); a prova viaja em **header**
(`cf-turnstile-token`), **não** no corpo — não amplia o enum de entidades do servidor; `Cache-
Control: no-store`; `/demo` sem cookie/identidade; relaxação documentada: a demo passa a **contatar
terceiros** (challenges.cloudflare.com) sem identidade/cookie (ADR 0014 + Constitution).

**Testing**: Vitest (unit/component), Storybook (stories + a11y), Playwright (e2e). **Hermético**:
`siteverify` mockado via `fetch`; `window.turnstile` mockado; **nenhuma** chamada live nem chave
real em testes.

**Target Platform**: Web (browser + Route Handler server).

## Constitution Check

*GATE — reavaliado após o design. Sem violações permissíveis sem justificativa.*

- **I (Code Quality)**: módulos novos pequenos e focados; sem `any`; 1 novélo `server-only`
  (`turnstile-verify.ts`) + 1 cliente (`turnstile.tsx`). ✅
- **II (Testing)**: test-first; `turnstile-verify` com testes herméticos (fetch mockado); widget
  com `window.turnstile` mockado; asserts de invariante de privacidade. ✅
- **III (UX)**: widget não-interativo invisível (sem fricção); erro localizado/retryável;
  a11y (`aria-busy`, foco no erro, fallback). Storybook cobre o wrapper do form com as novas
  mensagens. ✅
- **IV (Performance)**: script Turnstile **lazy** (não no bundle inicial); sem pipeline pesado
  extra; verificação é 1 round-trip externo antes da geração. Budget de JS da rota observado. ✅
- **Privacidade (AGENTS)**: NV. O **único** relaxamento é o "contato de terceiros" da demo —
  registrado em ADR 0014; identidade/cookie intactos; `NEXT_PUBLIC_TURNSTILE_SITE_KEY` é
  **exceção consciente** à regra "no `NEXT_PUBLIC_*`" (chave publishable não-secreta), como a do
  Clerk (ADR 0013). ✅

## Migration Map

### Remover
- Nada (feature additive).

### Adicionar
- `src/features/story-generation/server/turnstile-verify.ts` (`server-only`) — verificação
  `siteverify`. **Caminho fixo** (resolução da análise 019): junto aos demais módulos server
  usados pela rota, mantém `server-only` + regra de cobertura ≥90% de módulo de segurança.
- `src/features/story-request/components/turnstile.tsx` (`'use client'`) — injeta o script,
  renderiza o desafio não-interativo e expõe o token (single-use) ao submit.
- Testes: `tests/unit/turnstile-verify.test.ts`, `tests/unit/turnstile.test.tsx` ; criação
  (novo arquivo dedicado) `tests/contract/stories-route.turnstile.test.ts` (modo demo — sem
  acoplar o enforcement ao teste do handler base) e `tests/e2e/security-headers.spec.ts`.

### Reescrever / tocar
- `src/features/story-request/components/story-request-form.tsx`: renderizar o widget e, no
  submit, obter o token e anexá-lo ao `POST /api/stories` via header `cf-turnstile-token`;
  **reset** do widget após uso/falha; se o token não estiver disponível (widget não resolve),
  **bloquear** o submit com mensagem localizada retryável (nunca envia sem prova).
- `src/features/story-request/components/story-request-app.tsx`: rotear o erro `captcha_failed`
  (nova) para mensagem localizada.
- `src/app/api/stories/route.ts`: quando `mode === "demo"` **e** Turnstile configurado, ler o
  header e validar a prova **antes** de gerar; sem prova/validação falha → `403 captcha_failed`;
  falha de rede do verificador → **fail-closed** (rejeita com erro retryável localizado). Provider
  nunca chamado nesses casos.
- `src/features/story-generation/server/schemas.ts` + `src/lib/http-errors.ts`: novo `HttpError`
  `captcha_failed` (403, `retryable: true`) e novo membro no enum de `safeErrorSchema`.
- `src/features/story-reader/client/story-response.ts`: mapear `captcha_failed` no
  `errorForStatus`.
- Catalogs `story-request/locales/{en,pt-BR}.json`: `error.captchaFailed`.
- `src/lib/env.ts` (`.strict()` whitelist + `KNOWN_KEYS`): adicionar
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (opcional) e `TURNSTILE_SECRET_KEY` (opcional, server-only).
  Ausentes → feature desligada (demo como hoje).
- `next.config.ts` (CSP — relaxamento rotulado): adicionar `https://challenges.cloudflare.com` e
  `https://challenges.cloudflare.com` além dos já existentes, em
  `script-src`/`frame-src`/`connect-src` (e `style-src`/`img-src` se o widget exigir), com
  comentário "EXPLICIT RELAXATION".
- Contratos: `specs/001-personalized-story-generation/contracts/story-generation.openapi.yaml` —
  adicionar o headerdocument e o erro `captcha_failed` (403) na rota `/stories` (modo demo).
- `.env.example`: bloco opcional Turnstile com as 2 chaves.

### Testes
- **Unit server** `turnstile-verify.test.ts`: sucesso; inválido; rede falhou (rejeita/fail-closed);
  sem secret (desligado).
- **Unit client** `turnstile.test.tsx`: script injetado; token recebido; widget não carrega →
  estado de erro; reset após uso.
- **Contrato rota** `stories-route.test.ts` (modo demo): sem token → 403 e provider **não**
  chamado; token inválido → 403; token válido → 200. Modo playground: token **não** exigido.
- **Privacidade**: asserts de que `/demo` continua sem cookie/identidade; payload fechado.
- **E2E** `security-headers.spec.ts`: CSP contém `challenges.cloudflare.com`.

## Phases

1. **Setup/Foundational**: env schema (+chaves opcionais), CSP, contrato (OpenAPI) + erro
   `captcha_failed`, i18n.
2. **US1 — Fluxo demo humano**: widget não-interativo no form + anexo do token no header; demo
   gera normalmente (sem fricção).
3. **US2 — Bloqueio de bots**: `turnstile-verify` server-side em `/api/stories` (modo demo) antes
   da geração; sem prova → 403; provider não invocado.
4. **US3 — Privacidade e superfícies intactas**: asserts de invariante; `/form`/`/reader`/
   `/demo/reader` inalterados; ADR 0014 + relaxation CSP.
5. **US4 — Degradação/opt-in**: feature desligada sem configuração; falha de rede do verificador →
   erro localizado retryável (fail-closed).
6. **Polish**: format, lint, typecheck, build, stories/visual, budget de JS.

## Risks & Mitigations

- **Contato de terceiros na demo (privacidade)**: non-interactive **sem cookie/identidade**;
  registrado em ADR 0014 como relaxação deliberada (não silenciosa) do "zero contato externo",
  **não** do invariante de identidade.
- **Indisponibilidade do verificador**: **fail-closed** → erro localizado retryável; opt-in (sem
  chave = demo como hoje); opcionalmente um cap server-side (concorrência/fairness do bucket
  anônimo) como 2ª camada (fora do escopo núcleo — ver Open Questions do spec).
- **Token de uso único / replay**: cada submissão resolve um novo token; widget resetado após uso
  e falha; replay de token já consumido é rejeitado server-side.
- **Widget não resolve no cliente** (rede/JS do visitante): submit bloqueado com erro acessível;
  nunca envia pedido sem prova.
- **Bundle**: script Turnstile lazy no `/demo`; não entra no bundle inicial; verificar budget com
  `pnpm test:performance`.
- **CSP**: relaxamento mínimo e rotulado para `challenges.cloudflare.com`; testes de header
  cobrem.
- **Testes não-herméticos**: `siteverify` e `window.turnstile` sempre mockados; sem chaves reais em
  CI.

## Open Decisions (do spec)

- **Fail-closed** confirmado (Open Questions #1): nunca gerar sem verificação.
- **Cap server-side complementar** (Open Questions #2): **fora do núcleo** desta feature (registrado
  como follow-up recomendado), para não ampliar o escopo da barreira anti-bot.