<p align="center">
<img src="docs/header.png" alt="Girl reading a book in an enchanted kingdom with a dragon, rabbit, and squirrel" width="100%">
</p>

# Storybook AI

Personalized children's story generator I created for my daughter. Choose an age
range, language, and theme; the app generates a multi-scene story (3–5 scenes)
with illustrations.

## Overview

- 🧒 **Age bands**: `2-4`, `5-7`, `8-9`.
- 🎭 **Themes**: courage, friendship, kindness — chosen via **visual theme cards**.
- 🌎 **Languages**: `pt-BR` (default) and `en`.
- 📖 **Scenes** (3–5, variable) with generated illustrations, localized alternative text, and a **scene-progress indicator**.
- 🔊 **Read-aloud** of the current scene spoken locally in-browser (Web Speech — no network transmission) with a single start/stop control and accessible announcements.
- 📄 Browser-based **PDF export** with loading and failure/retry feedback.
- 🌓 **Dark mode** following the system preference, plus a session-only manual toggle (no persistence).

All new interactive surfaces (theme cards, read-aloud control, scene progress, PDF export, dark-mode toggle) are keyboard-navigable, expose visible focus, meet WCAG AA contrast, and honor `prefers-reduced-motion`.

## How story generation works

A story is produced by a single server-side pipeline under `src/features/story-generation/`:

1. **Outline + writing** – the allow-listed inputs (`ageBand`, `locale`, `theme`) are re-validated server-side (`Cache-Control: no-store`) and a single generation call lays out the scenes and writes the localized text for each one (title + body), together with each scene's illustration prompt.
2. **Review** – every scene's text and its illustration prompt are moderated (AI text + image moderation) and checked against template markers and direct identifiers (`{name}`, “child's name”); anything unsafe is auto-regenerated once, otherwise it fails as `unsafe_unrecoverable`.
3. **Illustration** – only **approved** illustration prompts are rendered to optimized WebP images.
4. **Final validation** – every scene is given localized `altText` and validated against the response schema before the story is returned; failures map to typed, localized errors (400/422/429/502/504).

All AI-vendor calls stay behind the server-only provider adapter (`story-generation/server`); raw provider output never reaches the client, and unsafe, partial or structurally invalid stories are never delivered.

## Stack

| Layer            | Technology                                      |
| ---------------- | ----------------------------------------------- |
| Framework        | Next.js 16 + React 19                           |
| Language         | TypeScript                                      |
| Styling          | Tailwind                                        |
| i18n             | next-intl                                       |
| Validation       | Zod                                             |
| AI (server-only) | OpenRouter SDK adapter + safety pipeline        |
| Images           | sharp                                           |
| PDF              | @react-pdf/renderer                             |
| Testing          | Vitest + Testing Library, Storybook, Playwright |

## Prerequisites

- Node.js 22 LTS
- pnpm enabled through Corepack
- A credential for the AI provider.

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

Open `http://localhost:3000`.

## CI

All quality gates run automatically on pushes and pull requests to `main` and
`develop` via the [CI workflow](.github/workflows/ci.yml): format, lint, strict
typecheck, unit tests with coverage gates, production build, Storybook/a11y,
E2E, visual, and performance budgets. No manual step is required before merging.

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

## License

This project is made available for **personal and educational purposes** with
**all rights reserved**. See the [`LICENSE`](LICENSE) file for details, and the
[disclaimer](#disclaimer--limitation-of-liability) below for the terms covering
AI-generated content.

## Disclaimer & Limitation of Liability

> This is a personal, non-commercial project built as a hobby and learning exercise.
> It is **not** a regulated product, medical, educational, or therapeutic service, and
> is provided **as-is**, without warranty of any kind.

### AI-generated content

- **Story text and illustrations are generated by third-party AI models**, not by a
  human author or editor. AI output is inherently probabilistic and may contain
  errors, inconsistencies, inaccuracies, or content that is unexpected, unsuitable,
  or incorrect for a given context.
- The project applies automated safety screening and age-appropriateness checks
  before presenting a story. These checks are **best-effort** and are **no guarantee**
  that every item of generated content is appropriate, accurate, or error-free.
- The Author accepts **no responsibility** and **no liability** for any use of the
  generated content, including its accuracy, suitability, safety, or any direct,
  indirect, incidental, consequential, or special damages arising from its use.

### Content intended for children

- The reader is responsible for exercising appropriate care and judgment.
  Content is auto-generated; the Author cannot guarantee that it is always
  suitable, age-appropriate, or free of values, themes, or wording you may not
  want. Caregivers should review generated stories and their child's use of the
  app, especially for unsupervised use.
- The project is **anonymous by design**: it does not collect, store, or transmit a
  child's name, exact age, or any direct identifier. It should **not** be relied
  upon as a privacy, safety, or compliance guarantee for any specific regulatory
  regime.

### As-is, without warranty

- The project is provided "AS IS". To the fullest extent permitted by applicable
  law, the Author disclaims all warranties, express or implied (including
  merchantability and fitness for a particular purpose), and all liability for
  any damages — whether direct, indirect, incidental, consequential, special, or
  punitive — arising out of or related to the use of or inability to use this
  project, its generated content, or its instructions.
- This disclaimer does not limit rights that cannot be excluded or limited under
  your local applicable law.

### License & copyright

- No license is granted by mere inspection or use of this repository. Copyright
  and all other rights are reserved unless and until a license is explicitly
  added. Nothing here gives you a right to use the Author's name, likeness,
  trademarks, or original materials without prior written permission.
