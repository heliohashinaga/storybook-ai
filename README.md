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
and no direct identifier is sent or stored; the only in-memory key is a short-lived,
salted **hash of the connecting IP** used for rate limiting.

## Run locally

### 1. Setup (one-time)

```bash
corepack enable
pnpm install
cp .env.example .env.local
```

Then fill in `.env.local` with your provider **keys** (used only when a model
carries the matching provider prefix) and your **models** (the first segment
of each `*_MODEL` selects the provider):

#### 🔑 Provider keys

| Variable              | Purpose                                                           |
| --------------------- | ----------------------------------------------------------------- |
| `OPENROUTER_API_KEY`  | Used when a model uses the `openrouter/` prefix (any capability)  |
| `OPENCODE_GO_API_KEY` | Used when a model uses the `opencode-go/` prefix (any capability) |

#### 🧠 Models (first segment = provider, unprefixed models are rejected at boot)

| Variable           | Default      | Example                          |
| ------------------ | ------------ | -------------------------------- |
| `TEXT_MODEL`       | — (required) | `opencode-go/qwen/qwen3.7-flash` |
| `MODERATION_MODEL` | — (required) | `opencode-go/qwen/qwen3.7-flash` |
| `IMAGE_MODEL`      | — (required) | `openrouter/qwen/qwen3.7-flash`  |
| `TTS_MODEL`        | — (optional) | `openrouter/qwen/qwen3.7-flash`  |

#### ⚙️ Mode

| Variable               | Default | Purpose                                                  |
| ---------------------- | ------- | -------------------------------------------------------- |
| `STORIES_TEST_MODE`    | unset   | `fake` → deterministic offline dev provider, no AI calls |
| `AI_NARRATION_ENABLED` | `false` | enable the AI neural voice (requires `TTS_MODEL`)        |

#### ⏱️ Rate limiting (anonymous, per IP)

| Variable                        | Default | Purpose                                |
| ------------------------------- | ------- | -------------------------------------- |
| `STORY_RATE_LIMIT_MAX_REQUESTS` | `10`    | max story-generation requests / window |
| `STORY_RATE_LIMIT_WINDOW_MS`    | `60000` | rate-limit window for story generation |
| `TTS_RATE_LIMIT_MAX_REQUESTS`   | `30`    | max narration requests / window        |
| `TTS_RATE_LIMIT_WINDOW_MS`      | `60000` | rate-limit window for narration        |

> Prefer `STORIES_TEST_MODE=fake` (instead of real keys) for a fully offline,
> deterministic dev run — no AI calls are made.

### 2. Run

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Architecture

A story is produced by a single server-side pipeline under
`src/features/story-generation/`:

1. **Outline + writing** – the allow-listed inputs (`ageBand`, `locale`,
   `theme`) are re-validated server-side and a single generation call lays out
   the scenes and writes the localized text (title + body) plus each scene's
   illustration prompt. Per-capability model routing: each `*_MODEL` prefix
   (`opencode-go/` or `openrouter/`) selects the provider — any provider can
   serve text, moderation, or image.
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

**Quality gates** are enforced in two layers.

- **Per commit** (fast, run by the pre-commit hook): lint (no warnings),
  formatting (no Prettier drift), and strict TypeScript (`pnpm lint`,
  `pnpm format:check`, `pnpm typecheck`).

- **Per push/PR to `main`/`develop`** (CI, run automatically):

  | Validation       | What it checks                                          |
  | ---------------- | ------------------------------------------------------- |
  | Lint             | no lint warnings                                        |
  | Format           | no Prettier drift                                       |
  | Typecheck        | strict TypeScript, no `any` in production               |
  | Test coverage    | ≥80% overall; ≥90% safety/validation/orchestration      |
  | Build            | production build compiles                               |
  | Storybook + a11y | every story renders + no accessibility violations       |
  | E2E              | pt-BR & EN journeys, fake provider, no live AI          |
  | Visual           | no unintended screenshot regression                     |
  | Performance      | LCP, route JS, scene navigation, and generation budgets |

  See `package.json` scripts and `.github/workflows/ci.yml`.

## Disclaimer

AI-generated content and caregiver responsibility are covered in the
[Disclaimer](DISCLAIMER.md).
