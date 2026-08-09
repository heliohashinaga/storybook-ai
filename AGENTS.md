# AGENTS.md

Instructions for AI coding agents working in this repository. Root file — applies
to all work here. When a task touches `src/`, `.storybook/`, or tests, also
load the user-level generic `nextjs` and `design-system` skills (framework and
UI conventions).

## Project

**storybook-ai** — a Next.js 16 (App Router) + React 19 web app that generates
personalized children's stories, **anonymous by design**. The child picks age,
locale, and theme; the app returns a 3-scene story with illustrations. No name or
direct identifier is ever collected, sent, logged, or stored.

Repo is currently in **planning phase**: `specs/` contains the feature artifacts
(spec, plan, quickstart, tasks, OpenAPI contract) and `.specify/memory/constitution.md`
holds the governing constitution. Implementation has not been scaffolded yet;
`package.json` does not exist. Do not invent package scripts — match the names in
`specs/001-personalized-story-generation/quickstart.md`.

## Non-Negotiable Privacy Rules

- **No direct identifiers, ever.** Never add a name/child-identifier field to UI,
  API, logs, analytics, or provider payloads.
- The browser derives `ageBand` (`2-4 | 5-7 | 8-12`) from exact age in memory; the
  server receives **only** `ageBand`, `locale` (`pt-BR` default | `en`), `theme`
  (`courage | friendship | kindness`).
- **No persistence:** no cookies, localStorage, indexDB, durable storage, or story
  cache. Exact age and generated stories live in React in-memory state only.
- All AI-vendor calls stay behind a **server-only provider adapter**
  (`story-generation/server`); UI never sees raw provider output. Modules importing
  the provider/OpenAI SDK/sharp must be `server-only`.
- `POST /api/stories` responds `Cache-Control: no-store` and is the **only** server
  entry point.
- Unsafe provider output must never be shown, logged, or returned: moderate →
  regenerate **once** with stronger constraints → else return a generic localized
  safe error. Partial illustration sets are never a successful story.

## Commands

Run these from the repo root after implementation exists (they are the required
scripts, not yet present):

```bash
pnpm dev             # dev server, http://localhost:3000 (pt-BR default)
pnpm lint            # no warnings allowed
pnpm format:check    # prettier, no drift
pnpm typecheck       # strict TS, no new `any` in production code
pnpm test            # Vitest: unit, component, API-contract, pipeline (fixtures/fakes only)
pnpm test:coverage   # ≥80% overall; ≥90% safety/validation/orchestration
pnpm storybook:test  # every story (default/loading/error/edge) + a11y checks
pnpm test:e2e        # Playwright: pt-BR + EN journeys, fake provider
pnpm test:visual     # approved screenshots, no unintended diff
pnpm build           # production build must pass
```

### Chromium native deps (Playwright / Storybook / visual tests)

On a minimal Linux host, the headless Chromium that `storybook:test`, `test:e2e`
and `test:visual` launch may be missing a native library (`libasound.so.2`;
check with `ldd <chrome-headless-shell-binary> | grep "not found"`). If a test
fails at browser launch, first run the dependency setup, then re-run:

```bash
# Recommended (requires root): install all system deps Playwright needs
pnpm exec playwright install --with-deps chromium
# Or, without root: vendor the missing lib into .playwright-deps/ (gitignored)
sh scripts/setup-chromium-deps.sh
```

The three test scripts already wrap the runner via `scripts/run-with-chromium.sh`,
which prepends `.playwright-deps/lib` to `LD_LIBRARY_PATH`. This is an
environment/tooling concern, not part of the product; it is recorded in
`specs/001-personalized-story-generation/reviews.md` (infra note, commit `f1ca309`).

**Tests never call a live AI service.** Use deterministic provider fakes/MSW.
Never commit `.env.local` or real credentials.

### Vitest worker timeouts on constrained hosts

On a low-memory or heavily-loaded host, the default Vitest forks pool can
timeout (`Failed to start forks worker` / `Timeout waiting for worker to
respond`) even though the suite is healthy — it only appears when many workers
try to build the JSX/SVG transform cache in parallel. If `pnpm test` fails that
way, first confirm the machine is not maxed out (`uptime`, `free -h`), then
re-run with a bounded pool:

```bash
pnpm test:limited   # vitest run --pool threads --maxWorkers 2
```

This is a resource/tooling concern, not a product or test-correctness issue; it
is intentionally **not** the default so well-resourced machines and CI keep
full parallelism.

## Code Style

- TypeScript **strict**, no `any` in production code (justify and approve exceptions).
- Feature-based structure: `src/features/<feature>/{components,client,server,locales}`,
  shared primitives in `src/components/ui`, helpers in `src/lib`. No large sprawl.
- `'use client'` only where interactivity/hooks/browser state require it; Server
  Components by default.
- Validate with Zod at the boundary: client schema for fast field errors, **server
  re-validation** in the route before any provider call.
- UI: tokenized Tailwind design system + shared primitives only — no ad-hoc values.
  Use semantic design tokens (`background`/`text`/`accent`), never raw hex or
  color literals in component code. All user-facing strings (incl.
  validation/error/retry copy) through next-intl catalogs (`pt-BR` + `en`); no
  hardcoded strings.
- Remove dead code and unused deps before finishing; no commented-out blocks.
- Accessibility bar (all UI): AA contrast (≥ 4.5:1) for normal text, visible
  focus and full keyboard navigation, honor `prefers-reduced-motion`, and use
  `aria-live`/`aria-busy` for async/loading states.

## Testing Rules

- **Test-first:** write a failing test, confirm it fails for the right reason,
  implement until green, refactor.
- Tests are deterministic: no wall-clock, network, or ordering dependence; fix or
  delete flaky tests — never skip silently. Name tests by behavior, not
  implementation.
- Tiers: unit (pure logic/schemas/safety), integration/contract (route + pipeline
  against `story-generation.openapi.yaml`, APIs faked), E2E (Playwright),
  visual (reader regression).
- **Devloop `testPlan` alignment:** when a devloop slice carries a `testPlan`
  (authored by `feature-planner`, validated by `task-qa`, persisted in
  `.pi/devloop-sessions/<taskId>-plan.json`), its tiers map to the ones above:
  `unit` = Vitest unit, `contract` = API-contract/integration vs the OpenAPI
  contract, `e2e` = Playwright journeys (pt-BR + en), `visual` = Storybook
  stories (default/edge/error + a11y). Workers author tests against it;
  `tester-simple`/`tester-complex` verify its intents are fulfilled per tier.
- **Devloop retrospectives:** every `/devloop` run persists deterministic run
  facts to `.pi/devloop-sessions/<runId>.retro.json`/`.md` (root, not worktree).
  `/devloop-retro` lists/reads them (TUI card) and `--agent` generates
  recommendations via the read-only `retro` agent; `retro.recommend` in
  `.pi/devloop.json` auto-generates them after every terminal outcome
  (ready-to-merge **and** human-escalation). Prune with
  `/devloop-cleanup --retros [keep]`. These are local dev artifacts — never
  committed, and never contain user/child PII.
- Assert privacy invariants in tests: no direct identifier accepted by form/API,
  none in HTTP payloads, logs, or provider fakes.
- Every component ships co-located `.stories.tsx` covering default/edge/error
  states; Storybook behavior must match the app.

## Performance Budgets (enforced in CI)

- Full generation (story + safety + 3 images) ≤120 s end-to-end.
- Initial form/reader LCP p75 ≤2.5 s (mid-tier mobile/4G).
- Initial route JS ≤250 KiB gzip (excludes scene images; **lazy-import**
  `@react-pdf/renderer` only on export — never in the initial bundle).
- Scene navigation ≤100 ms p75 after assets load.

## Definition of Done

Before a PR/commit: all required checks pass; coverage gates met; no direct
identifier in payloads/logs/storage; stories + a11y pass; Storybook behavior
matches the app; budgets respected; spec/OpenAPI updated if a contract changed.

Commit messages: `:memo:`/gitmoji + Conventional Commits, e.g.
`:sparkles: feat(story-generation): add safety pipeline`.

## Deeper Docs

- Feature artifacts: `specs/001-personalized-story-generation/` (`spec.md`,
  `plan.md`, `quickstart.md`, `tasks.md`, `contracts/story-generation.openapi.yaml`)
- Constitution (principles, quality gates): `.specify/memory/constitution.md`
- Framework/project conventions: user-level generic `nextjs` + `design-system` skills

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
