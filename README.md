# storybook-ai

Gerador de histórias infantis personalizadas, **anônimo por design**. A criança escolhe idade, idioma e tema; a aplicação gera uma história de três cenas com ilustrações — sem coletar nome ou qualquer identificador direto.

> **Status: planejamento.** O repositório contém apenas artefatos de especificação (`specs/`). O app será scaffoldado em Next.js a partir deste plano.

## Visão geral

- 🧒 **Idade por faixa etária**: `2-4`, `5-7`, `8-12` — apenas a faixa (não a idade exata) cruza a rede.
- 🎭 **Temas**: coragem, amizade, gentileza.
- 🌎 **Idiomas**: `pt-BR` (padrão) e `en`.
- 📖 **Três cenas** com ilustração gerada e texto alternativo localizado.
- 📄 **Export PDF/impressão** no navegador — nenhum arquivo é armazenado pelo app.
- 🔒 **Privacidade**: sem contas, sem cookies, sem persistência. Nome da criança jamais toca UI, rede ou logs.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Linguagem | TypeScript estrito (sem `any`) |
| Estilo | Tailwind (tokens do design system) |
| i18n | next-intl |
| Validação | Zod |
| IA (server-only) | OpenAI SDK via adapter isolado + pipeline de segurança |
| Imagens | sharp (WebP, runtime Node) |
| PDF | @react-pdf/renderer (lazy, no browser) |
| Testes | Vitest + Testing Library, Storybook, Playwright (E2E/visual) |

## Pré-requisitos

- Node.js 22 LTS
- pnpm habilitado via Corepack
- Credencial de desenvolvimento do provedor de IA aprovada (nunca produção) e aprovação de processamento de dados antes de tráfego real de crianças.

## Setup

```bash
corepack enable
pnpm install
cp .env.example .env.local
```

Configure os segredos de desenvolvimento (só server-side) em `.env.local`:

```dotenv
OPENAI_API_KEY=replace-with-development-key
OPENAI_TEXT_MODEL=replace-with-approved-structured-output-model
OPENAI_IMAGE_MODEL=replace-with-approved-image-model
```

`.env.local` é gitignored e nunca deve conter dados de crianças, histórias geradas ou arquivos exportados.

## Rodar localmente

```bash
pnpm dev
```

Abra `http://localhost:3000`. O idioma padrão da interface é `pt-BR`.

## Checks obrigatórios (antes de qualquer merge)

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm storybook:test
pnpm test:e2e
pnpm test:visual
pnpm build
```

| Comando | Resultado esperado |
|---|---|
| `pnpm lint` / `pnpm format:check` | Sem warnings de lint ou mudanças de formatação |
| `pnpm typecheck` | TypeScript estrito sem `any` novo em código de produção |
| `pnpm test` | Unit, componente, contrato de API e pipeline passam com fixtures/fakes |
| `pnpm test:coverage` | ≥80% geral; ≥90% em safety, validação, exclusão de identificadores e orquestração |
| `pnpm storybook:test` | Todas as stories (default/loading/error/edge) e acessibilidade passam |
| `pnpm test:e2e` | Jornadas pt-BR e EN com provider fake; nenhuma chamada a IA real |
| `pnpm test:visual` | Sem diff não intencional nos screenshots aprovados |
| `pnpm build` | Build de produção serve o fluxo anônimo |

## Estrutura (planejada)

```text
src/
├── app/                    # App Router (layout, page, Route Handler POST /api/stories)
├── components/ui/          # Primitivos compartilhados com design tokens
├── features/               # story-request, story-generation/server, story-reader, story-export
├── i18n/config.ts          # next-intl (pt-BR default + en)
└── lib/                    # env, http-errors, rate-limit
```

## Documentação

- **Especificação e planos**: [`specs/001-personalized-story-generation/`](specs/001-personalized-story-generation/) — `spec.md`, `plan.md`, `quickstart.md`, `tasks.md`, contrato OpenAPI.
- **Constituição do projeto** (princípios, qualidade, testes, UX, performance): [`.specify/memory/constitution.md`](.specify/memory/constitution.md).

## Contribuindo

Aplique a skill de projeto `nextjs` (`.pi/skills/nextjs/SKILL.md`) — ela codifica as regras de anonimato, testes em camadas, Storybook e budgets de performance. Alterações de contrato exigem atualização da spec e das stories correspondentes.
