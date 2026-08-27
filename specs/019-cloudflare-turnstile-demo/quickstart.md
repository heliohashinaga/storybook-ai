# Quickstart — Validação da proteção anti-bot do `/demo`

Guia para validar a feature de ponta a ponta. Referências: [spec.md](spec.md), [plan.md](plan.md),
[contracts/demo-anti-bot.md](contracts/demo-anti-bot.md).

## Pré-requisitos

- Par de chaves Turnstile no painel Cloudflare (site key + secret key). Para validação **local/
  hermética**, use as **chaves de teste oficiais** da Cloudflare:
  - sempre passa: site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`
  - sempre bloqueia: site `2x0000000000000000000000AB`, secret `2x0000000000000000000000000000000AB`
- Gerar a demo em modo fake (nenhuma IA live): `STORIES_TEST_MODE=fake`.

## Setup

```bash
# .env.local (exemplo — nunca commitar chaves)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
STORIES_TEST_MODE=fake

pnpm install
pnpm dev   # http://localhost:3000
```

Sem as chaves, a feature fica **desligada** e o `/demo` se comporta como hoje (validação de
opt-in).

## Cenários de validação (servidor)

Com o servidor dev rodando e o fake provider:

```bash
# 1. DEMO sem token → 403 captcha_failed (gerador não chamado)
curl -i -X POST http://localhost:3000/api/stories \
  -H 'content-type: application/json' \
  -d '{"ageBand":"5-7","locale":"pt-BR","theme":"courage"}'
# expect: HTTP/1.1 403 {"code":"captcha_failed",...} + Cache-Control: no-store

# 2. DEMO com token (chave de teste= sempre passa) → 200
curl -i -X POST http://localhost:3000/api/stories \
  -H 'content-type: application/json' \
  -H 'cf-turnstile-token: dummy-always-pass-token' \
  -d '{"ageBand":"5-7","locale":"pt-BR","theme":"courage","sceneCount":3}'
# expect: HTTP/1.1 200 (história fake, no-store)
```

## Cenários de validação (navegador/UX)

- **Human demo feliz**: `/demo` → escolher tema/idade/cenas → "Criar história" → gera. O desafio
  resolve **invisível** (non-interactive), sem passo extra.
- **Widget indisponível** (bloquear `challenges.cloudflare.com` via DevTools/offline): o submit é
  **bloqueado** com a mensagem localizada retryável (`story.error.captchaFailed`); nenhum pedido é
  enviado sem prova; reabilitar a rede e re-solver no retry.
- **Sem configuração** (remover as chaves): `/demo` gera normalmente (feature off).
- Ainda **sem cookie/identidade**: inspecionar `Application → Cookies/Local Storage` em `/demo` —
  nada novo aparece.

## Testes automatizados

```bash
pnpm test:limited                 # unit + contract (siteverify e window.turnstile mockados)
pnpm lint && pnpm format:check && pnpm typecheck
pnpm build
pnpm test:e2e -- security-headers # CSP contém challenges.cloudflare.com
pnpm test:performance             # budget de JS do /demo (script lazy) respeitado
```

## Critérios de aceite (mapeamento)

- US1 → cenário "human demo feliz".
- US2 → curl #1 (403, gerador não chamado) + token replay rejeitado.
- US3 → cenário "sem cookie/identidade" + asserts de payload fechado.
- US4 → falha do verificador → erro localizado retryável (fail-closed); sem chave → feature off.