<p align="center">
<img src="docs/header.png" alt="Girl reading a book in an enchanted kingdom with a dragon, rabbit, and squirrel" width="100%">
</p>

# Storybook AI

Personalized children's story generator I created for my daughter. Choose an age
range, language, and theme; the app generates a multi-scene story (3–5 scenes)
with illustrations.

## Overview

- 🧒 **Age bands**: `2-4`, `5-7`, `8-9`.
- 🎭 **Themes**: courage, friendship, kindness.
- 🌎 **Languages**: `pt-BR` (default) and `en`.
- 📖 **Scenes** `3–5` with generated illustrations.
- 🔊 **Read-aloud** of the current scene.
- 📄 **PDF export**.
- 🌓 **Dark mode**.

## How story generation works

You pick an age range, a language, and a theme (courage, friendship, kindness).
The app writes a story with 3–5 scenes — text plus illustrations made for that
age range — all in a single step. From there you can flip between scenes, listen
to each one read aloud, export it as a PDF, or change to dark mode.

**Anonymous by design** — the app works without a child's name or exact age,
and no direct identifier is collected, sent, or stored.

## Run locally

```bash
corepack enable
pnpm install
cp .env.example .env.local  # then fill in the provider keys
pnpm dev
```

Open `http://localhost:3000`.

> Set `STORIES_TEST_MODE=fake` (instead of real keys) for a fully offline,
> deterministic dev run — no AI calls are made.

## Architecture

A story is produced by a single server-side pipeline under
`src/features/story-generation/`:

1. **Outline + writing** – the allow-listed inputs (`ageBand`, `locale`,
   `theme`) are re-validated server-side and a single generation call lays out
   the scenes and writes the localized text (title + body) plus each scene's
   illustration prompt. Per-capability model routing: text/moderation →
   OpenCode, image → OpenRouter.
2. **Moderation** – every scene's text and illustration prompt are moderated
   (AI text + image); unsafe output is regenerated once, else fails as
   `unsafe_unrecoverable`.
3. **Illustration** – only **approved** prompts are rendered to optimized WebP.
4. **Final validation** – each scene gets localized `altText` and is validated
   against the response schema before it's returned; failures map to typed,
   localized errors (400/422/429/502/504).

All AI-vendor calls stay behind a server-only adapter
(`story-generation/server`); raw provider output never reaches the client, and
unsafe, partial, or structurally invalid stories are never delivered.

**Stack**: Next.js 16 + React 19 · TypeScript (strict) · Tailwind · next-intl ·
Zod · sharp · @react-pdf/renderer. AI (server-only): OpenRouter + OpenCode,
routed per capability. Tests: Vitest + Testing Library, Storybook, Playwright.

**Quality gates** (run automatically in CI on push/PR to `main` and `develop`):
`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:coverage:check`,
`pnpm build`, `pnpm storybook:test`, `pnpm test:e2e`, `pnpm test:visual`,
`pnpm test:performance`. See `package.json` and `.github/workflows/ci.yml`.

## Disclaimer

AI-generated content and caregiver responsibility are covered in the
[Disclaimer](DISCLAIMER.md).
