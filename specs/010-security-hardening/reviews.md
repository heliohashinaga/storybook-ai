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

## Pendências (revisão futura)

- **PR #3 (SCA):** atualizar `next`/`next-intl`/`@storybook/nextjs`; aceitar só
  com `pnpm audit` 0 high/medium runtime + Dependabot alinhado.
- **PR #4 (headers):** validar CSP real no browser (console sem violação),
  não apenas lint; verificar default/error/reader.
- **PR #5 (CodeQL):** workflow verde + 0 alerts novos.
