---
name: design-system
description: |
  Design system skill for the Storybook AI web app — design tokens (Tailwind),
  accessible shared primitives in src/components/ui, Storybook story conventions
  (default/loading/error/edge) + a11y testing, and visual regression workflow.
  Companion to the `nextjs` skill (which owns App Router, RSC, privacy/safety).
  Use when tasks touch src/components/ui, .storybook, stories, tokens, Tailwind
  classes, visual regression, or accessibility/contrast/keyboard behavior.
---

# Design System Skill — Storybook AI

Companion skill to `nextjs`. The `nextjs` skill owns framework rules, RSC
boundaries, and privacy/safety; this skill owns **every pixel, story, and
accessibility contract** of the UI. Follow both on any UI change.

## Non-Negotiables

1. **Tokens only.** Zero ad-hoc values: no raw hex, px, or arbitrary Tailwind
   values. Style exclusively with design tokens. Inline styles are forbidden
   (exception: computed dynamic values that tokens cannot express — justify them).
2. **Primitives first.** Never build bespoke styling on top of raw elements when a
   `src/components/ui` primitive exists. New primitives go in `components/ui` with
   full story + a11y coverage; feature-specific composites live in
   `src/features/<feature>/components/`.
3. **Accessibility is a contract, not a check.** Contrast AA, keyboard-navigable,
   visible focus, correct ARIA, localized alt text — a component is *done* only
   when these hold in every state.
4. **Storybook mirrors the app.** Storybook behavior (interactions, a11y, states)
   must be identical to the real app. Stories are the living component
   documentation and the a11y test surface (`pnpm storybook:test`).

## Design Tokens

- Live as Tailwind theme config / CSS variables (`globals.css`), the **single
  source of truth**. Never duplicate token values in component files.
- Taxonomy (align with what the scaffold defines; update names here once real):
  - **Color**: semantic (background/surface/text/subtle/accent/success/warning/
    danger/focus + disabled), not literal (never `blue-500` in component code).
  - **Typography**: type scale (display/title/body/caption), weights, line-height.
  - **Spacing**: scale (xs→xl), consistent gaps; no magic numbers.
  - **Radius / Shadow / Motion**: tokenized; motion must respect
    `prefers-reduced-motion`.
- Dark mode, if added, must be a token swap — never conditional hex values.
- New tokens require design-system review and appear in Storybook's
  token/styling documentation story.

## Primitives (`src/components/ui`)

- API contract: intentional, minimal props; expose `variant`/`size`/state props
  (disabled, loading, error) instead of loose `className` pass-through.
- Forward refs where the element identity matters (inputs, focus targets).
- No business logic, no i18n message IDs inside primitives — callers supply
  localized strings.
- States are first-class: every interactive primitive must define and render
  disabled, loading (aria-busy), focus-visible, and error states.

## Accessibility Bar (required)

- **Contrast**: AA (4.5:1 normal text) at minimum; verify in a11y tests.
- **Keyboard**: full tab order, no focus traps (except intentional modals with
  escape), visible focus indicator, no hover-only interactions.
- **ARIA**: correct roles/labels, `aria-live` for async updates (generation
  progress, errors), `aria-busy` during loading.
- **Alt text**: every illustration has localized, meaningful alt text; decorative
  images are `alt=""` + `aria-hidden`.
- **Motion**: respect `prefers-reduced-motion`; no content flashing.

## Storybook Conventions

- Co-locate `.stories.tsx` next to components; `pnpm storybook:test` runs stories
  + a11y checks in CI.
- A feature component's stories must cover every state it can render, e.g.:
  normal, validation error, loading/progress, safe retry, rate-limit,
  scene first/middle/last, export-disabled/export-ready.
- Story args drive behavior exactly as the app does (same context, same i18n
  catalogs). No story-only forks of behavior.
- Document tokens/styling decisions in a dedicated styling story per surface.

## Visual Regression

- `pnpm test:visual` (Playwright): approved screenshots are the baseline; any
  change must be intentional. Unintended diffs block the PR — no blind "update
  baseline" without review.
- Cover core surfaces (form, reader, export) at the supported viewports.

## Testing

- Component tests (Vitest + Testing Library): behavior and accessibility
  assertions (roles, labels, focus), not implementation details. Contribute to
  the ≥80% coverage gate (≥90% for validation/a11y-critical paths).
- Storybook tests: every story renders without errors and passes a11y checks.
- Visual tests: baseline → intentional diff → approve.

## Design-System DoD (every UI change)

1. Tokens only; no ad-hoc values or inline styles.
2. Existing primitive used or new primitive added with full coverage.
3. Keyboard + contrast + ARIA verified in all states (a11y tests green).
4. All strings localized via next-intl (`pt-BR` default + `en`).
5. Stories added/updated for every state; `pnpm storybook:test` green.
6. Visual regression: intentional diffs only.

## Common Pitfalls

- Raw hex / arbitrary Tailwind values sneaking into feature components.
- Inline styles or conditional styles duplicating token values.
- Hover-only interactions (breaks keyboard/touch).
- Alt text with hardcoded language instead of localized copy.
- Stories that render a forked behavior different from the app.
- Blindly accepting visual-regression baseline updates.
