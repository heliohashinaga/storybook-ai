# ADR 0006 — Reduce maximum age to 9; top band becomes `8-9`

- **Status**: Accepted
- **Data**: 2026-08-12
- **Decisores**: Manutenção do storybook-ai
- **Related**: ADR 0003, ADR 0005; Spec 001 (age input, FR-005), Spec 002 (scene-count curve)

## Context

Storybook-ai produces personalized, illustrated multi-scene children's stories
(3–5 scenes). Historically the app accepted a validated exact age of **2–12**,
derived locally into three age bands: `2-4`, `5-7`, `8-12`.

In the scene-count feature (Spec 002) the attention-curve mapping assumed
`8–12 ≈ 5 scenes`. Questioning whether **5 scenes is enough for a 12-year-old**
raised the deeper issue: by ages 10–11 children transition from concrete to
formal operational thought and typically read middle-grade fiction
(35k–60k words) and full chapter books rather than illustrated picture-story
apps. A 5-scene illustrated story is below what that age consumes, and
increasing scene counts further collides with the still-unmeasured cost of
more illustrations (each scene = 1 image + moderation, latency budget).

### Options considered

1. **Raise scene capacity for the 8–12 band** (6–7 scenes). Dismissed for now:
   latency/cost not yet measured; a larger scene count for only the oldest band
   complicates the shared generation pipeline and the "no partial set"
   invariant.
2. **Reduce the maximum age instead** (chosen), so that **every accepted age**
   receives a story length that is genuinely appropriate. This avoids serving
   11–12-year-olds a format we cannot yet size correctly.
3. Keep the full 2–12 range unchanged. Rejected: leaves 5 scenes under-sized
   for 11–12.

## Decision

- The maximum accepted age is reduced from **12 to 9**.
- The age bands become **`2-4`, `5-7`, `8-9`** (the top band is narrowed from
  `8-12`).
- The age input is validated as an integer **2–9** (client-side fast error;
  the server still receives only the derived `ageBand`).
- `deriveAgeBand` maps `≤4 → 2-4`, `≤7 → 5-7`, else → `8-9`, and rejects ages
  outside 2–9.
- Ages 10–12 are no longer in the accepted range.

Rationale: research on reading development shows the value of an illustrated
picture-story format is strongest for early/transitional readers and that the
switch to middle-grade/novel expectations begins around age 10. Capping at 9
keeps 5 scenes (and the whole illustrated format) well-suited to every
accepted age, rather than forcing an under-sized experience on the oldest
ages.

## Consequences

- **Positive**: every accepted age gets a genuinely appropriate story length;
  privacy is preserved (still only `ageBand` crosses the network / a test
  asserting no exact age is sent remains in force); no changes to the scene
  count or latency budget.
- **Negative**: the app no longer serves 10–12-year-olds. This is a deliberate
  audience-scoping decision; future re-expansion of the top band would reopen
  this ADR and revisit scene capacity.
- **Compatibility**: contract `AgeBand` enum changes to `['2-4','5-7','8-9']`;
  this is a personal, non-commercial project with a single deployable client,
  so no external consumers are affected.
- **Test impact**: unit/contract/integration/e2e age-band expectations updated;
  the age-band derivation logic remains deterministic and test-covered.

## Reference changes

- `src/features/story-request/client/age-band.ts` — type + `deriveAgeBand`
- `src/features/story-request/client/story-preferences-schema.ts` — `ageBandValues` + `age` bounds
- `src/features/story-generation/server/schemas.ts` — `ageBandSchema`
- `src/features/story-request/components/story-request-form.tsx` — validation + `max="9"`
- Locales `pt-BR` / `en` — placeholder + `errorRange`
- Spec 001: `spec.md`, `plan.md`, `quickstart.md`, `data-model.md`, `tasks.md`, `checklists/requirements.md`, `contracts/story-generation.openapi.yaml`
- Spec 002: `spec.md`, `quickstart.md`, `research.md`, `data-model.md`, `contracts/story-generation.openapi.yaml`
- `README.md`, ADR 0003
