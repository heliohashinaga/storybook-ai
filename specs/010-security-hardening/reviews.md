# Reviews — Hardening de Segurança 2026

Registro de decisões e estações de revisão da feature. Atualizado conforme cada
PR avança; o status `CONCLUÍDO` aqui deve bater com `docs/security-audit-2026.md`
e com os status em `tasks.md`/`plan.md`.

## Estações

### ✅ PR #1 — SSRF por redirect — aprovado (`3857eb3`)
- **Implementação:** `fetchSafeImage()` (`provider-core/image-client.ts`):
  `redirect: "manual"` + revalidação do `Location` + cap de 1 hop.
- **Revisão (test-first):** 3 testes novos falharam antes da correção (durante o
  desenvolvimento eles estavam falhando: `redirect→interno`, `redirect público`,
  `chain 2 hops`) e passaram após. Regressão no teste "failed image URL fetch"
  (`openrouter-story-generation-provider.test.ts`) foi causada por *drop* do
  cheque `.ok` na refatoração e corrigida restaurando o cheque.
- **Gates:** `pnpm test` (640), `typecheck`, `lint`, `format:check`, `build` ✅.
- **Decisões:** **1 hop, não N** — o custo da revalidação DNS por hop e a
  redução de superfície pesaram contra seguir cadeias longas; provedores
  legítimos (CDN) raramente encadeiam.
- **Nota:** hop único já revalidado pelo mesmo resolver; um segundo redirect é
  tratado como `unsafe-url` (não como fallback silencioso).

### ✅ PR #2 — Rate-limit — aprovado (`6f87644`)
- **Implementação:** `resolveClientIp()` + `ANONYMOUS_GLOBAL_KEY` +
  `trustForwardedForEnv()`; rotas `stories`/`narrate` e `generation-runtime.ts`
  injetam `trustForwardedFor`.
- **Revisão (test-first):** 8 testes unit novos para `resolveClientIp`
  (rightmost, HFF único, não-IP → null, **HFF não confiado sem proxy**,
  fallback `x-real-ip`, linha com vírgula, `ANONYMOUS_GLOBAL_KEY` não é
  identificador) + 1 teste de rota (HFF forjado ignorado → 2º request 429).
- **Descoberta importante:** o teste de rota falhou primeiro **porque o batch de
  edição da rota `stories` tinha um membro sem match** (edição em lote é
  atômica) — a rota ainda usava o código antigo. Confirmado ao re-executar após
  aplicar a edição correta: o teste passa.
- **Gates:** `pnpm test` (649), `typecheck`, `lint`, `format:check`, `build` ✅.
- **Decisões:** `trustForwardedFor` é **campo obrigatório** nos deps (força cada
  chamador a decidir explicitamente); HFF é confiado apenas atrás de proxy
  controlado (`VERCEL=1`/`TRUST_PROXY=1`); valor não-IP nunca vira chave.

### ✅ PR #4 — Headers de segurança — aprovado
- **Implementação:** `next.config.ts` `headers()` global; CSP calibrada
  (checklists/csp.md) + `nosniff`/`XFO:DENY`/`Referrer-Policy`/HSTS (produção).
- **Revisão (test-first + validação real):** E2E `security-headers.spec.ts`
  (headers presentes; browser carrega `/`, `/reader`, 404 **sem violação de
  CSP no console**).
- **Decisões:** `script-src 'unsafe-inline'` (sem nonce) — app sem HTML perigoso
  (auditoria confirmou ausência de `dangerouslySetInnerHTML`/`eval`/`innerHTML`)
  e nonce exigiria `middleware.ts` (maior superfície); HSTS só produção.
- **Verificação de baseline:** as 5 falhas de E2E (2 perf-budget, 2 reader-visual
  por seletor `idade`, 1 smoke locale pt-BR) foram confirmadas **pré-existentes**
  rodando a mesma suíte com `next.config.ts` sem headers (stash→build→run→pop):
  **zero falhas novas** introduzidas por PR #4.

### ✅ PR #3 — SCA — aprovado (com ressalva)
- **Implementação:** `next@16.3.1`, `next-intl@4.13.6`, `@storybook/nextjs@10.5.8`;
  override `nanoid: 3.3.18` em `pnpm-workspace.yaml`.
- **Descoberta de processo:** pnpm 11 **ignora o campo `pnpm` em `package.json`**
  (aviso `The "pnpm" field in package.json is no longer read`) — overrides
  precisam estar em `pnpm-workspace.yaml`, que já tinha um bloco `overrides`.
  Primeira tentativa (`package.json`) não surtiu efeito; corrigido.
- **Resultado:** `pnpm audit --prod` = **0 vulnerabilidades** (runtime limpo;
  nanoid high >60 caminhos resolvido).
- **Ressalva registrada:** restam 2 high + 1 low **dev-only** (`image-size` ×2,
  `elliptic`) via Storybook. Os patches upstream citados pela auditoria
  (`image-size ≥2.0.3`, `elliptic ≥6.6.2`) **não existem no registry**
  (verificado: `pnpm view` mostra 2.0.2 e 6.6.1 como últimas). Sem correção
  possível até upstream publicar — acompanhar Dependabot/upstream.
- **Gates:** `pnpm test` 649/649, `build`, `typecheck`, `lint`, `format:check` ✅;
  E2E: 25 passed + mesmas 5 falhas pré-existentes (0 novas).

## Pendências (revisão futura)

- **PR #5 (CodeQL):** workflow verde + 0 alerts novos.
- **SCA residual (dev-only):** re-checar quando `image-size ≥2.0.3` e
  `elliptic ≥6.6.2` forem publicados; limpar `pnpm audit` completo e Dependabot.
