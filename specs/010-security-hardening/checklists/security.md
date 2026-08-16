# Checklist — Verificação de Segurança (regressão + aceite)

Usado após cada PR da `010-security-hardening` para garantir que nada quebrou
e que os invariantes de privacidade/segurança seguem de pé.

## Privacidade (não-negociável)
- [ ] Nenhum identificador direto (nome/child-id) em UI/API/logs/storage/payloads
- [ ] Servidor recebe só `ageBand` | `locale` | `theme` | `sceneText`
- [ ] Sem cookie/localStorage/indexDB/cache de história duradoura
- [ ] `POST /api/stories` responde `Cache-Control: no-store`
- [ ] Módulos provider/OpenAI/sharp só sob `server-only` (nada no client bundle)

## SSRF (PR #1)
- [ ] `fetchSafeImage()` usa `redirect: "manual"`
- [ ] `Location` revalidado com `isSafeImageUrl()` antes de seguir
- [ ] Cap de 1 hop; redirect encadeado → `unsafe-url`
- [ ] Alvo interno/metadata nunca buscado (teste cobre)

## Rate-limit (PR #2)
- [ ] HFF só confiado com `trustForwardedFor` (VERCEL=1/TRUST_PROXY=1)
- [ ] Usa apenas o hop direito (proxy), não o esquerdo forjável
- [ ] Sem header confiável → `ANONYMOUS_GLOBAL_KEY` (não `"unknown"`)
- [ ] Valor não-IP → `null` (nunca vira chave)
- [ ] XFF forjado ignorado quando sem proxy (teste de rota cobre)

## SCA (PR #3) — ✅
- [x] `pnpm audit --prod` sem CVEs no caminho de runtime (0 vulns)
- [x] nanoid high (>60 caminhos) resolvido via override 3.3.18 no `pnpm-workspace.yaml`
- [x] `pnpm build` e `pnpm test` verdes após atualizar deps (next 16.3.1, next-intl 4.13.6, @storybook/nextjs 10.5.8)
- [ ] `image-size`/`elliptic` dev-only: aguardar upstream publicar patches (≥2.0.3 / ≥6.6.2)

## Headers (PR #4) — ✅
- [x] Rotas servem CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
- [x] HSTS condicionado a produção (não em dev)
- [x] default/error/reader sem violação de CSP no console (E2E browser)
- [x] Imagens `data:` e `next/font` renderizam (CSP `img-src data:`/`style-src inline`)
- [x] E2E de headers verdes; falhas visual/perf pré-existentes confirmadas no baseline

## CodeQL (PR #5) — ✅ coberto pelo GitHub Default Setup
- [x] Scan ativo em push + PR → `main`/branches protegidas + schedule semanal (default setup)
- [x] Linguagens: JS/TS + GitHub Actions; query suite Default (high-precision)
- [x] Sem workflow manual; 0 custo extra de CI; não usar advanced setup

## Gates finais
- [ ] `pnpm lint` (0 warnings)
- [ ] `pnpm format:check` (sem drift — `pnpm format` em arquivos novos/editados)
- [ ] `pnpm typecheck` (strict, sem `any` novo)
- [ ] `pnpm test` (≥80% global; ≥90% safety/validation/orchestration)
- [ ] `pnpm build`
