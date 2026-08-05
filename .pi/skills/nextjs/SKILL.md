---
name: nextjs
description: |
  Next.js 16 (App Router) + React 19 skill for the Storybook AI web app. Covers
  RSC vs client components, Route Handlers, Server Actions, server-only provider
  adapters, next-intl i18n, @react-pdf/renderer export, and the project's
  privacy/safety and test-tier rules. UI tokens, primitives, Storybook stories,
  a11y, and visual regression belong to the companion `design-system` skill.
  Use when tasks touch src/app, src/features, src/lib, or tests under this repo.
---

# Next.js Skill — Storybook AI

Single full-stack Next.js 16 App Router + React 19 application. Follow language
practices from the `typescript` skill (strict TS, Zod, feature-based structure)
and UI practices from the `design-system` skill (tokens, primitives, Storybook,
a11y, visual regression). This skill adds the framework rules and the project's
non-negotiables.

## Core Non-Negotiables

1. **Anonymous only.** Never collect, send, log, or persist a child's name or any
   other direct identifier. The browser derives an `ageBand` from exact age in
   memory and posts **only** `ageBand`, `locale`, `theme` to `POST /api/stories`.
   Exact age stays purely in React in-memory state — never serialized.
2. **Server gets only derived data.** `ageBand` (2-4 | 5-7 | 8-12), `locale`
   (pt-BR default | en), `theme` (courage | friendship | kindness). No account,
   no cookies, no durable storage, no story cache.
3. **No provider leakage.** AI vendor calls are isolated behind a server-only
   provider adapter (`story-generation/server`). UI never sees raw provider output.
4. **Safe failure.** Provider/safety/image failures never return raw content —
   only sanitized, localized retry states. Exactly three scenes; a partial image
   set is never a successful story (retry once, else typed error).

## Toolchain & Commands

| Task | Command |
|---|---|
| Dev | `pnpm dev` |
| Lint | `pnpm lint` |
| Format check | `pnpm format:check` |
| Strict typecheck | `pnpm typecheck` (tsc `--noEmit` with `strict` + `noUncheckedIndexedAccess`) |
| Unit/integration/contract tests | `pnpm test` (Vitest + React Testing Library) |
| Coverage | `pnpm test --coverage` — feature target ≥80% overall, ≥90% safety/validation/orchestration |
| Storybook | `pnpm storybook` (dev) / `pnpm storybook:test` (component + a11y checks) |
| E2E | `pnpm test:e2e` (Playwright: functional, keyboard, anonymous/export) |
| Visual regression | `pnpm test:visual` |
| Build | `pnpm build` (production) |

CI also enforces a production build and performance budgets. All normal tests use
deterministic fixtures and **never call a live AI service**.

## Source Layout

```text
src/
├── app/                    # App Router: layout, page, globals.css, root not-found/error
│   ├── api/stories/route.ts# ONLY server entry point (Route Handler)
│   ├── layout.tsx / page.tsx / globals.css
├── components/ui/          # Shared, tokenized accessible primitives (no stories here unless reused)
├── features/               # Feature-based modules (see below) — the core of the app
├── i18n/config.ts          # next-intl config (pt-BR default + en)
└── lib/                    # env, http-errors, rate-limit (app-shell helpers, no features)
```

Features are self-contained: `story-request`, `story-generation/server`,
`story-reader`, `story-export`. Each has `components/` (+ co-located `.stories.tsx`),
and `client/` or `server/` for boundary logic. `story-generation/server` holds
`schemas.ts`, `story-generation-provider.ts`, `openai-story-generation-provider.ts`,
`safety-pipeline.ts`, `image-optimizer.ts` (sharp), `generate-story.ts`.

## App Router + React 19 Rules

- **Server Components by default.** Only add `'use client'` when interactivity,
  hooks, or browser state is required. Keep the server/client split explicit.
- **Boundary schema before client interactivity:** validate `ageBand`/`locale`/`theme`
  on the client (`story-preferences-schema.ts`) for fast field errors, and **re-validate
  on the server** in the route before any provider call.
- **Route Handler** (`src/app/api/stories/route.ts`) is the only server entry point.
  It must respond with `Cache-Control: no-store`. Prefer direct handler logic /
  form actions over proliferating many routes (route is the single documented
  OpenAPI contract).
- **`server-only`:** any module importing the provider adapter, OpenAI SDK, or
  sharp must be server-only and must not be imported by client code.
- **Hooks (React 19):** use `useActionState` / `useTransition` / `useOptimistic`
  for form + pending states; `use` for async. Avoid `useEffect` for derived state.
- **Session state:** exact age and generated stories live in React in-memory state
  (e.g. `story-session-context.tsx`). Never write to localStorage/indexedDB/cookies.
- **next/image / sharp:** images are optimized on the Node server runtime and
  returned as transient WebP data URIs via `image-optimizer.ts`; do not serve raw
  provider images.

## i18n (next-intl)

- Locales: `pt-BR` (default) and `en`. Message catalogs per feature under
  `src/features/*/locales/{pt-BR,en}.json`. No hardcoded user-facing strings.
- All UI strings, validation messages, and recovery/retry copy must be localized.

## UI / Design System

UI work follows the **`design-system` skill**: design tokens (Tailwind),
`src/components/ui` primitives, Storybook stories + a11y testing, and the
visual-regression workflow. No ad-hoc hex/px values; every scene image needs
localized alt text. Co-locate `.stories.tsx` next to feature components and run
`pnpm storybook:test` in CI.

## Testing Tiers

1. **Unit** — pure logic: `age-band`, schemas, `story-response`, `safety-pipeline`.
2. **Integration/contract** — route + provider pipeline against `story-generation.openapi.yaml`;
   provider/moderation/image APIs fully faked (MSW or provider fakes).
3. **E2E (Playwright)** — `generate-pt-br`, `generate-english`, `safety-regeneration`,
   `anonymous-session-and-export`.
4. **Visual** — `reader.spec.ts` regression.

Tests must assert no direct identifier is accepted by the form/API and does not
appear in HTTP payloads, logs, or provider fake inputs.

## Privacy / Safety Rules (apply on every change)

- Exact age → derive `ageBand` on the client; only the band crosses the network.
- Never include a child name anywhere: UI, request, logs, analytics, provider payload.
- The safely-generated story's narrative must avoid interpolation markers or
  direct-identification placeholders.
- On unsafe candidate: moderate → auto-regenerate **once** with stronger safe
  constraints → if still unsafe, return only a generic localized safe error.
- Rate limit (`lib/rate-limit.ts`) is anonymous: short-lived pseudonymous key only,
  never a direct identifier, story content, or profile.

## Performance Budgets

- Full generation (story + safety + 3 illustrations) ≤120 s end-to-end.
- Initial form/reader LCP p75 ≤2.5 s (mid-tier mobile/4G).
- Initial route JS ≤250 KiB gzip (excludes scene images and lazy PDF code).
- Scene navigation after assets load ≤100 ms p75.
- **Lazy-load the PDF module** (`@react-pdf/renderer`) via dynamic import only when
  the user triggers export — not on initial route.
- Three-scene cap; bounded/parallel image generation; respond `no-store`.

## Common Pitfalls

- Leaking exact age or a direct identifier to the server/provider/logs.
- Importing a server-only module (provider adapter, sharp, OpenAI SDK) into client
  code — breaks the `server-only` boundary and the build.
- Raw provider/moderation output reaching the UI or HTTP response without passing
  the safety pipeline.
- Missing `Cache-Control: no-store` on `POST /api/stories`.
- Hardcoding UI copy instead of next-intl catalogs.
- Eagerly importing the PDF renderer (kills the 250 KiB budget).
