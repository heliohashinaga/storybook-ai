# Tarefas — Hardening de Segurança 2026

Legenda: ✅ concluído · ⏳ pendente. Cada tarefa é verificável por teste/gate.

## T1 · SSRF por redirect (PR #1) — ✅
- [x] T1.1 `fetchSafeImage()` com `redirect: "manual"` (escrever teste primeiro)
- [x] T1.2 revalidar `Location` via `isSafeImageUrl()` antes de seguir
- [x] T1.3 cap de **1 hop** (redirect encadeado → `unsafe-url`)
- [x] T1.4 `Location` ausente / alvo inseguro → `unsafe-url`
- [x] T1.5 corpo final buscado uma única vez; `.ok` preservado
- [x] T1.6 testes: redirect→interno, redirect público único, chain de 2 hops
  (todos verdes; `pnpm test`, `typecheck`, `lint`, `format:check`, `build`)

## T2 · Rate-limit (PR #2) — ✅
- [x] T2.1 `resolveClientIp()`: só confia em HFF/`x-real-ip` com `trustForwardedFor`
- [x] T2.2 usa apenas o hop **direito** (o da direita, acrescentado pelo proxy)
- [x] T2.3 valor não-IP → `null`; sem header confiável → `null`
- [x] T2.4 `ANONYMOUS_GLOBAL_KEY` agrega anônimos quando não há IP (não `"unknown"`)
- [x] T2.5 `trustForwardedForEnv()` (VERCEL=1 | TRUST_PROXY=1)
- [x] T2.6 rotas `stories`/`narrate` + `generation-runtime.ts` injetam `trustForwardedFor`
- [x] T2.7 teste: HFF forjado ignorado sem proxy confiável (2º request → 429)
- [x] T2.8 gates verdes (`pnpm test` 649, `typecheck`, `lint`, `format:check`, `build`)

## T3 · SCA — atualizar dependências (PR #3) — ⏳
- [ ] T3.1 `pnpm audit` inventário: confirmar `nanoid@3.3.17`, `image-size` ×2, `elliptic`
- [ ] T3.2 atualizar `next`, `next-intl`, `@storybook/nextjs` (mínimo p/ limpar transitivos)
- [ ] T3.3 `pnpm audit` → 0 high/medium no caminho de runtime
- [ ] T3.4 alinhar alertas do GitHub Dependabot (0 abertos de severidade alta)
- [ ] T3.5 regressão: `pnpm build`, `pnpm test`, `test:e2e`, `storybook:test`

## T4 · Headers de segurança HTTP (PR #4) — ✅
- [x] T4.1 teste de regressão primeiro: rota deve servir os 5 headers (falha hoje)
- [x] T4.2 bloco `headers()` em `next.config.ts` (CSP + HSTS + nosniff + XFO + Referrer)
- [x] T4.3 CSP calibrada (ver `checklists/csp.md`): scripts inline do Next, `img-src data:`, `next/font`
- [x] T4.4 HSTS condicionado a produção; demais headers sempre
- [x] T4.5 default/error/reader carregam **sem violação de CSP** no console (E2E browser)
- [x] T4.6 E2E verdes (headers + CSP); tipo pré-existente de falhas visual/perf confirmado no baseline

## T5 · CodeQL na CI (PR #5) — ⏳
- [ ] T5.1 workflow `.github/workflows/codeql-analysis.yml` (javascript-typescript, autobuild, sarif upload)
- [ ] T5.2 rodar em `schedule` + push/PR da branch padrão
- [ ] T5.3 0 alerts high/medium novos introduzidos por mudanças novas
- [ ] T5.4 workflow verde sem estourar budget de CI

## T6 · Documentação e sync — ⏳ (em andamento)
- [x] T6.1 `AGENTS.md` seção **Security Hardening** (baseline audit; reflete PR #1/#2)
- [x] T6.2 `docs/security-audit-2026.md` status de remediação (PR #1/#2 CONCLUÍDO)
- [x] T6.3 este diretório `specs/010-security-hardening/` (spec/plan/tasks/reviews/quickstart/checklist/csp)
- [ ] T6.4 atualizar status aqui em `reviews.md` conforme #3/#4/#5 avançarem
