<!--
SYNC IMPACT REPORT
- Version change: 1.0.0 → 1.1.0 (MINOR)
- Principles reworked per user direction to focus on four pillars:
  code quality, testing standards, user experience consistency, performance requirements.
  The previous 5 inferred principles (Spec-First, AI-Assisted, Test-First, Storybook-Driven,
  Simplicity) were consolidated/expanded into these four focus areas. Test-First and
  Storybook-Driven intent are preserved and folded into Code Quality / Testing Standards / UX.
- Additional sections (Technology & Tooling, Development Workflow & Quality Gates, Governance)
  retained, with references updated to the new principles.
- No sections removed or superseded out of scope; this is a principles revision.
- TODO(TECH_STACK), TODO(TOOLING), TODO(CI_GATES) carried forward unchanged (still unresolved).
-->
# storybook-ai Constitution
**Version**: 1.1.0 | **Ratified**: 2026-08-04 | **Last Amended**: 2026-08-04

## Core Principles

### I. Code Quality (NON-NEGOTIABLE)
The codebase MUST remain readable, maintainable, and safe to change.
- Type safety is required: no `any` in new production code unless approved and justified.
- New and modified files MUST pass the project's lint and format checks (no new lint warnings).
- Prefer small, focused modules with clear responsibilities over large, sprawling ones.
- Dead code, commented-out blocks, and unused dependencies MUST be removed before merge.
- Public APIs MUST be documented at the point of use; changes to contracts MUST update the
  corresponding spec and Storybook stories.
- Duplication SHOULD be avoided; where abstraction is introduced, it MUST pay for itself in
  clarity or correctness (see Performance and UX for cost/benefit framing).

### II. Testing Standards (NON-NEGOTIABLE)
Every change MUST be verified by automated tests before merge.
- Test-first is enforced: write a failing test, confirm it fails for the right reason, implement
  until green, then refactor. A change without test coverage is not complete.
- Critical paths (auth, data mutation, payments, error handling) MUST reach a defined coverage
  threshold (TODO(COVERAGE_THRESHOLD): set exact % once CI is configured).
- Required test tiers:
  - Unit tests for logic and edge cases.
  - Integration tests for module/state interactions.
  - Storybook stories as living component tests and visual regression baselines.
- Tests MUST be deterministic: no dependence on wall-clock timing, network availability, or test
  ordering; flaky tests MUST be fixed or removed, never skipped silently.
- Test names MUST describe behavior and outcome, not implementation.
- A failing test is a release blocker; CI MUST not be bypassed to land code.

### III. User Experience Consistency
The product MUST feel coherent, accessible, and predictable across all surfaces.
- UI components MUST be built from shared, reusable primitives and design tokens (color, spacing,
  typography, radii) rather than one-off values. TODO(TOKENS): confirm the token source/spec once
  the design system is established.
- Every component MUST ship Storybook stories covering default, edge, and error states so behavior
  is documented and regression-checked consistently.
- Accessibility is a baseline requirement, not a stretch goal: keyboard operability, focus
  management, and semantic markup for interactive elements. Screen-reader-relevant states MUST be
  tested.
- Consistent terminology, empty states, loading states, and error messaging MUST be used across
  the application.
- Behavior MUST NOT diverge between Storybook and the live application; identical inputs MUST
  produce identical output and styling.

### IV. Performance Requirements
The product MUST meet measurable performance budgets and not regress.
- Bundle size SHOULD be kept within budget; large dependencies and heavy import-time work MUST be
  justified, and unused heavy code SHOULD be tree-shaken or lazy-loaded.
- Long tasks, render-blocking work, and avoidable re-renders MUST be avoided on critical user
  paths.  TODO(PERF_BUDGETS): define concrete numeric budgets (bundle size, LCP, TBT) once the
  metric tooling is in place.
- Performance regressions MUST be caught automatically in CI before merge; manual-only
  verification is insufficient.  TODO(PERF_CI): wire budget checks into the CI gate.
- Optimize for the common case first; premature micro-optimization that harms readability is
  disallowed (this qualifies Code Quality principle I's cost/benefit framing).
- Perceived performance (progress indicators, skeleton states, optimistic UI where safe) is part
  of the UX contract and MUST be considered in every interactive feature.

## Technology & Tooling

- TODO(TECH_STACK): Confirm the baseline language/framework for `storybook-ai` (e.g., TypeScript,
  React + Storybook). No source exists in the repo yet to infer this.
- TODO(TOOLING): Document package manager, lint/format tooling, and CI runner once chosen.
- All tooling choices MUST be recorded here and changes MUST be proposed as spec items before they
  land.

## Development Workflow & Quality Gates

- Every change flows through the Spec Kit lifecycle: clarify → spec → tasks → implement →
  converge.
- Each feature harvested from a spec writes its tasks to `.specify/tasks/` and tracks checklists
  through completion.
- Quality gates before merge MUST verify: lint/type checks pass (Principle I), automated tests
  pass with no flaky failures (Principle II), Storybook stories render and match the app
  (Principle III), and performance budgets hold (Principle IV).
  TODO(CI_GATES): enumerate exact automated gates once CI is set up.
- PRs and reviews MUST verify compliance with this constitution.

## Governance

This constitution supersedes ad-hoc practice. Amendments MUST be documented, follow semantic
versioning, and include a brief rationale. Compliance is reviewed as part of every spec and PR
cycle. For runtime development guidance, follow the tasks and checklists produced by the Spec Kit
commands.

Amendments are proposed by drafting the change (as a PR against this file or a spec item), getting
human approval, then applying and revalidating. Unreviewed amendments MUST NOT be ratified.
