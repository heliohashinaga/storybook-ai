# Future Evolution: Multi-Agent System for Story Generation

**Status**: Future direction (out of MVP scope) | **Date**: 2026-08-04
**Feature**: `001-personalized-story-generation`

> This document captures a desired future architecture. It does **not** change the current MVP
> plan, which ships a single provider adapter behind the `StoryGenerationProvider` interface.

## Goal

Evolve story generation from a single monolithic provider call into a coordinated multi-agent
pipeline that separates planning, writing, review, and illustration responsibilities. This makes
each stage independently controllable, testable, and (where useful) parallelizable, while keeping
safety and privacy as first-class gates.

## Proposed Agents and Responsibilities

| Agent | Responsibility |
|-------|----------------|
| **Coordinator** | Orchestrates the pipeline; handles retries, flow control, and final assembly. Owns the overall request lifecycle and bounded-retry policy. |
| **Planner** | Produces the story outline (ordered scenes) from age band, theme, and locale. |
| **Writer** | Produces the story narrative from the planner's outline, matching the age band's vocabulary and tone. |
| **Reviewer** | Validates safety, tone, and age-appropriateness; simplifies language when needed. This is the authoritative safety gate. |
| **Illustrator** | Generates image prompts (always in English) and triggers image generation for each approved scene. |

## Proposed Workflow

```text
User input (age, theme, language)
  → Coordinator
      → Planner   (defines scene structure)
      → Writer    (generates narrative)
      → Reviewer  (validates safety/tone/age-appropriateness, may simplify)
      → Illustrator (image prompts in English → trigger image generation)
  → Final story assembled and returned
```

## Frontend/Backend Separation (Recommended Direction)

When the Multi-Agent System ships, extract the generation pipeline into a **dedicated internal
backend service**, decoupled from the web application:

```text
Frontend/API (Next.js, TypeScript)
  └─ internal call → Generation service (the MAS pipeline)
                      ├─ Coordinator / Planner / Writer / Reviewer / Illustrator
                      └─ provider adapter (illustrations, narrative, moderation)
```

**Rationale**: independent scaling of the heavy generation path; a tighter security/privacy
boundary (the web app never contacts the AI provider directly); asynchronous/long-running job
support; and reuse across multiple future clients.

**Key consequence**: this separation is what allows the generation service to be authored in
**Python** (e.g., LangGraph, which is more mature there) while the frontend remains TypeScript on
Next.js. The split is the enabler for LangGraph-in-Python; a single Next.js app would confine that
choice to TypeScript.

**Frontend remains**: Next.js + TypeScript. **Generation service may be**: Python/LangGraph or
TypeScript/LangGraph — to be confirmed in a spike. The `story-generation.openapi.yaml` contract
stays identical, and the privacy boundary (only age band, locale, and allow-listed theme cross the
boundary; no direct child identifier) is enforced the same way at the new service's public edge.

## Mapping to Current MVP

| MVP artifact | Future MAS role |
|--------------|-----------------|
| `story-generation-provider.ts` (interface) | Remains the boundary; the MAS implements it, so routes/UI/contracts are unchanged. |
| `generate-story.ts` (orchestration) | Evolves into the **Coordinator**. |
| Single "generate full story" provider step | Replaced by **Planner → Writer → Reviewer**. |
| `safety-pipeline.ts` + moderation | Formalized/strengthened as the **Reviewer** agent (non-negotiable gate). |
| Illustration generation | Becomes the **Illustrator** agent (image prompts in English). |

## Constraints Carried Forward (non-negotiable)

1. **Privacy**: No agent receives a child's name or any other direct identifier. The Coordinator
   passes only derived age band, locale, and allow-listed theme. The no-direct-identifier rule
   (FR-010) applies uniformly to every agent.
2. **Safety**: The **Reviewer** is the authoritative gate. No unsafe candidate may be returned or
   logged, matching the current "block + auto-regenerate once" behavior. Coordinator enforces a
   bounded retry.
3. **Contract**: The HTTP/API contract (`contracts/story-generation.openapi.yaml`) and the
   `GeneratedStory` response remain the same, so client, reader, export, and test fixtures do not
   change.
4. **Localization**: Narrative and UI text follow `locale` (`pt-BR` default, English). Illustration
   prompts are always in English, per the proposed design; this does not affect localized alt text
   or reader text.

## Open Design Questions (future)

- **Latency budget**: Five sequential agent calls may exceed the current ≤120 s end-to-end budget.
  Decide whether to relax the budget or parallelize permitted stages (e.g., Planner → Writer, with
  Reviewer on Writer output; Illustrator driven after Review). Recommend measuring before committing.
- **Orchestration machinery**: Choose the MAS runtime (in-process typed agent functions vs. an
  orchestration framework such as LangGraph). The frontend/backend split makes **LangGraph in
  Python** a viable option; confirm in a spike against a small prototype using the same provider
  fakes. Each agent must remain callable and testable in isolation.
- **Reviewer authority**: Confirm whether the Reviewer can both reject and independently "simplify
  language", and whether that rewrite requires a second review pass.
- **Cost control**: Establish per-story token/cost budgets; the Reviewer and bounded retries
  currently protect spend and must do so in the MAS too.

## Governance

This is an explicit future evolution and must not block the MVP. It will be specced as its own
feature (e.g., `002-multi-agent-story-generation`) through the Spec Kit flow (`/speckit-specify`,
`/speckit-plan`) before implementation. Until then, the MVP's single-adapter pipeline is the
committed scope.
