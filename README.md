<p align="center">
  <img src="docs/header.png" alt="Girl reading a book in an enchanted kingdom with a dragon, rabbit, and squirrel" width="100%">
</p>

# Storybook AI

Personalized children's story generator I created for my daughter. Choose an age
range, language, and theme; the app generates a three-scene story with
illustrations.

> **Status: implemented.** Personalized children's story generator, anonymous by design.
> The app lives in `src/` and runs against a deterministic fake provider for tests;
> see [Anonymous session behavior](#anonymous-session-behavior) and `specs/` for the
> full feature contract.

## Overview

- 🧒 **Age bands**: `2-4`, `5-7`, `8-12` — only the band (not the exact age) is
  sent over the network.
- 🎭 **Themes**: courage, friendship, kindness.
- 🌎 **Languages**: `pt-BR` (default) and `en`.
- 📖 **Three scenes** with generated illustrations and localized alternative text.
- 📄 **Browser-based PDF/print export** — no file is stored by the app.

## Stack

| Layer            | Technology                                                   |
| ---------------- | ------------------------------------------------------------ |
| Framework        | Next.js 16 (App Router) + React 19                           |
| Language         | Strict TypeScript (no `any`)                                 |
| Styling          | Tailwind (design-system tokens)                              |
| i18n             | next-intl                                                    |
| Validation       | Zod                                                          |
| AI (server-only) | OpenAI SDK through an isolated adapter + safety pipeline     |
| Images           | sharp (WebP, Node runtime)                                   |
| PDF              | @react-pdf/renderer (lazy, not in the browser)               |
| Testing          | Vitest + Testing Library, Storybook, Playwright (E2E/visual) |

## Prerequisites

- Node.js 22 LTS
- pnpm enabled through Corepack
- An credential for the AI provider (never production).

## Setup

```bash
corepack enable
pnpm install
cp .env.example .env.local
```

Configure development secrets (server-side only) in `.env.local`:

```dotenv
# OpenRouter provider — read ONLY by the server-only provider adapter.
OPENROUTER_API_KEY=replace-with-development-key
OPENROUTER_TEXT_MODEL=replace-with-approved-structured-output-model
OPENROUTER_IMAGE_MODEL=replace-with-approved-image-model
OPENROUTER_MODERATION_MODEL=replace-with-approved-moderation-model
```

> Development provider selection: set `STORIES_PROVIDER=fake` only for
> deterministic e2e/visual/performance/dev runs — it uses a fixed in-repo
> provider that never calls a live AI service (no credentials needed). The
> default `openrouter` provider requires the OpenRouter_* credentials above.

## Run locally

```bash
pnpm dev
```

Open `http://localhost:3000`. The default interface language is `pt-BR`.

## Required checks (before any merge)

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm storybook:test
pnpm test:e2e
pnpm test:visual
pnpm test:performance
pnpm build
```

| Command                           | Expected result                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm lint` / `pnpm format:check` | No lint warnings or formatting changes                                             |
| `pnpm typecheck`                  | Strict TypeScript with no new `any` in production code                             |
| `pnpm test`                       | Unit, component, API contract, and pipeline tests pass with fixtures/fakes         |
| `pnpm test:coverage`              | ≥80% overall; ≥90% for safety, validation, identifier exclusion, and orchestration |
| `pnpm storybook:test`             | All stories (default/loading/error/edge) and accessibility checks pass             |
| `pnpm test:e2e`                   | pt-BR and EN journeys with a fake provider; no live AI calls                       |
| `pnpm test:visual`                | No unintended diff in approved screenshots                                         |
| `pnpm test:performance`           | Initial JS ≤250 KiB gzip, LCP ≤2.5s, scene nav ≤100ms p75, generation ≤120s        |
| `pnpm build`                      | Production build serves the anonymous flow                                         |

## Structure

Feature-based layout implemented under `src/`:

```text
src/
├── app/                    # App Router (layout, page, Route Handler POST /api/stories)
├── components/ui/          # Shared primitives with design tokens
├── features/               # story-request, story-generation/server, story-reader, story-export
├── i18n/config.ts          # next-intl (pt-BR default + en)
└── lib/                    # env, http-errors, rate-limit
```

## Documentation

- **Specification and plans**: [`specs/001-personalized-story-generation/`](specs/001-personalized-story-generation/) — `spec.md`, `plan.md`, `quickstart.md`, `tasks.md`, and the OpenAPI contract.
- **Project constitution** (principles, quality, testing, UX, performance): [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
