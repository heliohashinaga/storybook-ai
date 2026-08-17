# Fake-content catalog (spec 012)

Deterministic, anonymous story/illustration fixtures used by the **fake provider**
(`STORIES_TEST_MODE=fake`). Captured **once** with the real providers (DeepSeek/seedream via
`*_MODEL` env), then committed — the fake mode never calls a live AI service.

## Files

```
{theme}-{locale}-{sceneCount}.json   e.g. courage-pt-BR-3.json, empathy-en-5.json, generic-en-4.json
```

`theme` is one of the 6 enum themes plus the virtual `generic` fallback (authored neutral cells
with captured illustrations — used for future/out-of-catalog themes).

## Fixture shape (FR-002)

```jsonc
{
  "theme": "courage", // "courage"|"friendship"|"kindness"|"curiosity"|"perseverance"|"empathy"|"generic"
  "locale": "pt-BR", // "pt-BR"|"en"
  "sceneCount": 3, // 3|4|5
  "story": {
    "title": "...",
    "scenes": [{ "ordinal": 1, "title": "...", "body": "...", "altText": "..." }],
  },
  "illustrations": ["data:image/webp;base64,..."], // one per scene (512×512, q70)
  "meta": {
    "model": "openrouter/bytedance-seed/seedream-5-0-lite",
    "capturedAt": "...",
    "sha256": "...",
  },
}
```

## How to (re)capture

```bash
# Plan + budget estimate — no network, no credentials required
pnpm exec tsx scripts/generate-fake-content.ts --dry-run

# Selective capture (subset flags: --themes, --locales, --counts, --limit)
pnpm exec tsx scripts/generate-fake-content.ts --themes empathy --locales en
pnpm exec tsx scripts/generate-fake-content.ts --limit 2 --locales pt-BR   # smoke test

# Full catalog (36 enum + 6 generic = 42 files)
pnpm exec tsx scripts/generate-fake-content.ts
```

**Constraints** (AGENTS.md / spec 012): never in CI; requires the real env (keys + `*_MODEL`);
each narrative passes the real Moderator gate (rejected output is discarded, never saved);
anonymity pre-flight + unit scan; budgets: ≤ 60 KB per scene image, ≤ 8 MB total.
