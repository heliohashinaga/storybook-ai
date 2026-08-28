# ADR 0014 — Cloudflare Turnstile na rota demo (anti-bot)

- Status: **Proposto** (aguardando aprovação do dono, feature 019)
- Decisores: manutenção do `storybook-ai` (dono do projeto)
- Data: 2026-08-20
- Contextos relacionados: AGENTS.md ("Non-Negotiable Privacy Rules"); Constitution.md
  (Governance); ADR 0013 (exceção `NEXT_PUBLIC_*` do Clerk); feature `019-cloudflare-turnstile-demo`;
  `specs/010-security-hardening`.

> Emenda ao AGENTS.md conforme governança do `constitution.md` (amendments exigem documentação e
> aprovação humana). Este ADR registra a **relaxação deliberada** do "zero contato de terceiros" do
> caminho anônimo, **sem** tocar no invariante de **identidade/cookie** da criança (non-negotiável).

## Contexto

O `/demo` é a única rota pública e anônima (sem login, sem cookie, sempre disponível) que dispara a
geração de histórias. Por não ter gate de autenticação, é o alvo natural de inundação automatizada
(bots/DoS). As demais superfícies já são protegidas: `/form` é auth-gated + rate-limit por IP;
`/api/narrate` em demo responde 204 (sem custo) e o TTS real é auth-gated; a tela de login é
protegida nativamente pelo Clerk (lockout, IP limit) e o sign-up é invite-only.

A feature 019 adiciona uma barreira anti-bot **não-interativa e invisível** no formulário do demo:
uma prova de uso único (Cloudflare Turnstile) é exigida e verificada server-side em `POST /api/stories`
**antes** de qualquer geração, **somente no modo demo** (anônimo). O playground autenticado e o
`/demo/reader` (somente leitura) ficam intactos.

## Decisão

1. **Adotar Cloudflare Turnstile** (modo **non-interactive**) como barreira anti-bot **apenas** no
   caminho anônimo do demo (`POST /api/stories` em modo demo).
2. **Escopo mínimo**: sem prova válida (ausente/inválida/expirada/replay) ou com verificador
   indisponível (**fail-closed**), a requisição é recusada com `403 captcha_failed` e o gerador
   nunca é invocado.
3. **Exceção `NEXT_PUBLIC_*` registrada**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` é uma chave
   **publishable** (não-secreta, por design exposta ao browser) — mesma natureza da
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (exceção do ADR 0013). `TURNSTILE_SECRET_KEY` permanece
   **server-only**, nunca exposta.
4. **Privacidade preservada**: o widget non-interactive **não grava cookie, não usa `localStorage`
   nem coleta identidade**; a prova é anônima, curta e de uso único, e viaja em **header**
   (`cf-turnstile-token`), não no corpo fechado do contrato (`ageBand|locale|theme|sceneCount`). O
   app **não persiste** token nem associa prova a história/identidade.
5. **Relaxação registrada (única)**: o `/demo` passa a **contatar terceiros**
   (`challenges.cloudflare.com`) para emitir/validar a prova, e o CSP ganha essa origem. Isso **não**
   relaxa o invariante de identidade/cookie — apenas o "zero contato externo". Não há cookie de
   sessão, rastreamento nem identificador; nada é persistido.
6. **Opt-in**: sem as chaves, a feature fica **desligada** e o `/demo` se comporta como hoje
   (nenhuma regressão em deploys demo-only/CI/fake).

## Alternativas consideradas

| Alternativa                                    | Por que foi rejeitada                                                                                                                                                                   |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Turnstile no login/sign-in                     | Clerk não oferece Turnstile para sign-in; exigiria um custom sign-in flow (alto custo) para proteger algo que o Clerk já protege nativamente (lockout/IP limit). Sign-up é invite-only. |
| Turnstile no `/demo/reader`                    | É somente leitura (sem POST de geração); não é superfície anti-bot.                                                                                                                     |
| Apenas cap server-side (concorrência/fairness) | Complementar recomendado (follow-up), mas não substitui uma barreira anti-bot por prova; mantido fora do núcleo 019.                                                                    |
| Turnstile no `/api/narrate`                    | Em demo responde 204 (sem custo); TTS real é auth-gated. Inócuo.                                                                                                                        |

## Consequências

- **AGENTS.md/privacidade**: registra que o `/demo` (caminho não autenticado) passa a usar uma
  prova anti-bot de terceiro (Turnstile non-interactive), **mantendo** o invariante de anonimato da
  criança/cookie. A exceção `NEXT_PUBLIC_TURNSTILE_SITE_KEY` entra no AGENTS (como ADR 0013).
- **Segurança**: CSP ganha `https://challenges.cloudflare.com` em `script/frame/connect/style/img/
worker-src` — relaxamento **rotulado no diff** em `next.config.ts`. Falta de prova ou falha de
  rede do verificador ⇒ **fail-closed** (`403 captcha_failed`), nunca gera sem verificação.
- **Cobertura**: `turnstile-verify.ts` é módulo de segurança/validação → cobertura ≥90% (agenda de
  testes), `server-only`.
- **Dependência externa**: uptime da barreira do demo depende do `challenges.cloudflare.com`
  (não do provedor de IA). Aceita para a demo; opt-in minimiza superfície.
- **Testes herméticos**: `siteverify` (fetch) e `window.turnstile` sempre mockados; nenhuma chave
  real/live em CI (AGENTS II).

## Referências

- `specs/019-cloudflare-turnstile-demo/{spec,plan,tasks,research,quickstart}.md`
- `specs/019-cloudflare-turnstile-demo/contracts/demo-anti-bot.md`
- ADR 0013 (exceção publishable do Clerk); `constitution.md` (Governance)
- Cloudflare Turnstile docs (modes; siteverify)
