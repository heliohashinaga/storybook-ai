# Provider Interface Contract — must NOT change

**Feature**: `008-refactor-provider-core` | **Contract status**: `UNCHANGED` (behavior-preserving refactor)
**Source of truth at runtime**: `src/features/story-generation/server/story-generation-provider.ts`

## Purpose

This refactor extracts an internal `provider-core/` shared module. The **public/provider contract**
below is **frozen**: the extraction must not alter any of these signatures, payloads, env vars,
prompts, timeouts, or routing. This document is a review checklist, not a new interface definition.

## Public seam — `StoryGenerationProvider`

Defined in `story-generation-provider.ts` (unchanged). Implementations are chosen by the orchestrator;
raw provider/OpenAI output never reaches the client.

```ts
export interface StoryGenerationProvider {
  generateStory(input: ProviderStoryInput): Promise<GeneratedStoryCandidate>;
  moderateText(text: string): Promise<ModerationDecision>;
  moderateImage(prompt: string): Promise<ModerationDecision>;
}
```

Types used (all defined in `story-generation-provider.ts` / `schemas.ts`, unchanged):
- `ProviderStoryInput { ageBand, locale, theme, sceneCount }`
- `ProviderScene { ordinal, title, body, illustrationPrompt }`
- `GeneratedStoryCandidate { title, scenes }`
- `ModerationDecision { safe, reason? }`
- `ProviderError(ProviderErrorKind)`, `ProviderErrorKind = "unavailable" | "timeout" | "invalid_structured_output"`

## Provider factory signatures (unchanged)

Adapters keep their factory seam used by `generation-runtime.ts`:

- `createOpenRouterStoryProvider(deps?: OpenRouterDeps): StoryGenerationProvider`
- `createOpenCodeStoryProvider(deps?: OpenCodeDeps): StoryGenerationProvider`

And the illustration factories (routed by `generation-runtime.ts` based on provider):

- `createOpenRouterIllustration(...)` / `createOpenCodeIllustration(...)`

These names, their deps interfaces, and their runtime routing (`route.provider === "opencode-go" ? … : …`)
remain byte-stable from the consumer's perspective.

## Shared core — internal module (NEW, not a public contract)

`provider-core/` is an **internal reorg**. It exposes helpers that the adapters import; it is NOT a
public API and does NOT replace `StoryGenerationProvider`. Boundary:

- `provider-core/schemas.ts` — `sceneCandidateSchema`, `storyCandidateSchema`, `moderationSchema`
- `provider-core/chat-json.ts` — `parseChatJson`
- `provider-core/prompts.ts` — `NARRATIVE_SYSTEM_PROMPT`, `narrativeUserPrompt`, `MODERATION_SYSTEM_PROMPT`
- `provider-core/moderation.ts` — `moderate(...)`
- `provider-core/provider-errors.ts` — `toProviderError`
- `provider-core/image-client.ts` — `postImages(...) -> { bytes, mediaType }` + WebP normalize via `image-optimizer.ts`

All modules imported under `server-only`.

## Env vars / routing / prompts — unchanged

- Env keys: `OPENROUTER_API_KEY`, `OPENCODE_GO_API_KEY`, per-agent `*_MODEL`, `ILLUSTRATOR_MODEL` — no change in `env.ts`.
- `provider-routing.ts` capability→provider resolution — no change.
- Prompt **content** (`NARRATIVE_SYSTEM_PROMPT`, `MODERATION_SYSTEM_PROMPT`, `narrativeUserPrompt`) — no semantic change (diff empty; see plan Decisão-3).
- Timeouts/retries: text 60 s, image 120 s — unchanged (FR-005).

## Invariants (verifiable)

1. `grep` before vs after: each shared symbol defined exactly once (in `provider-core/`) (SC-001).
2. Public type/factory signatures above are present and unchanged.
3. No new `any`; no new direct identifier; `server-only` maintained; `POST /api/stories` remains the only server entry (FR-006).
4. Existing provider/illustration tests stay green with unchanged fixtures (SC-002).
