# GLOSSARY.md

Linguagem canônica do `storybook-ai`. Implementação segue o glossário — em caso
de divergência, o glossário vence e o código é corrigido.

## Porteiro

Gate de acesso ao playground. Quem sabe o segredo entra; sem identidade, sem
conta, sem lista de usuários. Implementado como senha única compartilhada +
JWT httpOnly (`__Host-gatekeeper`, TTL 24h). Ver `docs/adr/0015-senha-unica-porteiro.md`.

## Sessão de porteiro

Cookie httpOnly `__Host-gatekeeper` (`Secure`, `SameSite=Lax`, `Path=/`,
`Max-Age=86400`). Carrega só `{ gate: true }` — nenhum e-mail/nome/sub de
usuário, nada persistido, nada enviado a providers de IA.

## Playground

Caminho autenticado (`/form`, `/reader`) com geração LLM real. Exige sessão de
porteiro válida (`requireSession()`); sem ela, redirect ao porteiro (`/`).

## Demo anônima

Caminho público (`/`, `/demo`, `/demo/reader`) com provider fake determinístico.
Nunca recebe cookie, nunca toca LLM real. Orçamento anônimo compartilhado via
`ANONYMOUS_GLOBAL_KEY` quando não há IP confiável.
