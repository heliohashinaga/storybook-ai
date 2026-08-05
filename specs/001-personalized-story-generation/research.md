# Research: Personalized Story Generation

**Feature**: `001-personalized-story-generation`  
**Date**: 2026-08-04

## Decision 1: Use a single full-stack Next.js application with TypeScript

**Decision**: Build one responsive web application with Next.js App Router, React, and strict
TypeScript. Use Route Handlers for the server-only story-generation boundary.

**Rationale**:

- The product needs a responsive browser reader plus a small server boundary for secret-bearing AI
  provider calls; a single application keeps the anonymous, non-persistent MVP simple.
- Route Handlers keep the public contract explicit and avoid a separately deployed API for one
  feature.
- TypeScript strict mode, Zod at every external boundary, and a feature-based module layout meet
  Constitution Principles I and II.

**Alternatives considered**:

- **Vite SPA plus a separate Express/Fastify API**: viable, but adds deployment, CORS, and contract
  coordination overhead without a current need for independently scaled services.
- **Client-direct AI provider calls**: rejected because credentials would be exposed and safety
  controls could be bypassed.
- **Native mobile app**: rejected because the clarified delivery target is a consumer web app.

**References**:

- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Next.js lazy loading](https://nextjs.org/docs/app/guides/lazy-loading)

## Decision 2: Do not collect direct child identifiers

**Decision**: Do not ask for, receive, process, transmit, log, or store a child's name or any other
direct identifier. Keep exact age and in-session stories in React state only; do not use a database,
cookies, local storage, session storage, analytics events, URL query parameters, or server logs for
that data. Set generation responses to `Cache-Control: no-store`.

The browser derives `ageBand` from the exact age and sends only `ageBand`, `locale`, and an
allow-listed `theme` to the generation route. The server and AI provider generate an anonymous,
age-appropriate protagonist and never receive direct child-identifying data.

**Rationale**:

- This exceeds FR-008 through FR-010's anonymous, no-persistence requirement by eliminating direct
  identifiers from the product flow altogether.
- Age band, locale, and positive theme still deliver relevant and age-appropriate stories without
  collecting a child's name.
- A server-side data store is unnecessary for the stated MVP and would increase privacy risk.

**Alternatives considered**:

- **Accounts and a story library**: explicitly deferred by the clarified Option B decision.
- **`sessionStorage`**: retains data across reloads and is unnecessary for the first release; React
  memory makes the privacy boundary unambiguous.
- **Collecting a name only in browser memory**: rejected by the product decision not to receive a
  child's name at all.

## Decision 3: Use an AI-provider adapter with structured story output

**Decision**: Introduce a server-only `StoryGenerationProvider` interface. The first adapter uses
OpenAI's API for structured narrative generation, image generation, and available moderation
capabilities. Provider model identifiers stay in environment variables rather than source code.

The provider MUST return JSON matching the server's schema: exactly three ordered scenes, each with
a localized plain-text title, plain-text narrative, and a safe illustration prompt. Zod validates
every provider response before it can be processed or returned.

**Rationale**:

- A provider adapter contains vendor-specific SDK code and permits later replacement without
  changing routes, UI, contracts, or test fixtures.
- Schema-constrained responses reduce malformed story handling and provide deterministic contract
  tests.
- Exactly three scenes bounds image-generation latency, response size, reader complexity, and PDF
  layout while still satisfying the multi-scene requirement. Vocabulary and plot complexity vary by
  the three approved age bands.

**Alternatives considered**:

- **Direct vendor SDK use throughout the route/UI**: rejected because it couples the product to one
  vendor and makes test isolation difficult.
- **Free-form text then parser heuristics**: rejected as fragile for localization and scene
  boundaries.
- **More than three scenes at launch**: deferred; it threatens the under-two-minute generation goal
  because each scene needs an illustration.

**Operational decision**: Production launch requires an approved provider data-processing review.
The implementation must verify the vendor's current data-use/retention controls and configure the
approved settings before real user traffic. This is a release gate, not application persistence.

**References**:

- [OpenAI Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs)
- [OpenAI moderation guide](https://platform.openai.com/docs/guides/moderation)
- [OpenAI enterprise privacy overview](https://openai.com/enterprise-privacy/)

## Decision 4: Enforce a defense-in-depth safety pipeline

**Decision**: Process every request through these gates, none of which may expose an unsafe
intermediate result:

1. Validate browser inputs locally and server inputs with Zod: supported locale, age band, and
   allow-listed positive theme; the browser collects exact age only to derive the band.
2. Build a server-owned generation instruction containing the fixed positive-value, age-band, and
   locale rules. Treat all submitted values as data, never as instructions.
3. Validate the returned structured story and illustration prompts against the schema and reject
   interpolation markers, markup, or identifiers.
4. Moderate the generated narrative and illustration prompts before image generation.
5. If a candidate is unsafe, discard it and regenerate once using a stricter safe-content
   instruction. Never return or log the rejected candidate.
6. If no safe candidate is produced after the bounded retry, return a generic, child-appropriate
   recoverable error with a safe-theme retry action.
7. Generate illustrations only from already-approved prompts; reject invalid/missing images and
   retry the missing illustration once before failing the request.

**Rationale**:

- Implements the clarified "block + auto-regenerate" behavior while preventing unsafe content from
  reaching the reader.
- Bounded retries prevent runaway cost and latency; tests can deterministically cover each branch.
- The allow-listed theme catalog removes a major prompt-injection and content-scope vector.

**Alternatives considered**:

- **One provider-side safety flag only**: rejected because it does not verify the final narrative or
  application rules.
- **Manual review before every story**: rejected because it cannot meet the two-minute success
  criterion.
- **Returning the rejected story with a warning**: rejected by FR-006.

## Decision 5: Launch with `pt-BR` and English plus three positive themes

**Decision**: Ship the application interface and generated stories in `pt-BR` (default) and English.
The initial allow-listed themes are `courage`, `friendship`, and `kindness`. Use `next-intl` for
static UI strings and send an exact locale token to the generation adapter.

**Rationale**:

- This implements the clarified language decision while keeping the localization/test matrix
  manageable.
- The named positive themes come directly from the feature description and form a safe bounded
  catalog for v1.
- The design exposes locale/theme catalogs as typed configuration so future expansion is additive.

**Alternatives considered**:

- **English-only launch**: rejected by the explicit `pt-BR` default requirement.
- **Arbitrary free-text themes**: rejected because it weakens safety and makes expected behavior
  untestable.
- **Broad language catalog at launch**: deferred until localized quality and safety evaluation exist.

## Decision 6: Return optimized images only for the active request; generate PDF in the browser

**Decision**: Generate each illustration in the server request, optimize it to a bounded WebP data
URI before returning it, and keep it only in browser memory. Dynamically import
`@react-pdf/renderer` when a parent selects Download/Print; construct the PDF locally from the
already-rendered story and images.

**Rationale**:

- A local PDF export preserves the anonymous model: the completed story never needs to be uploaded
  or stored server-side.
- Lazy-loading the PDF dependency prevents export code from slowing the first story request or
  reader view.
- A bounded response size keeps a three-scene story practical on mobile connections.

**Alternatives considered**:

- **Server-generated PDFs**: rejected because they require transmitting or retaining a final
  document at the server, which is unnecessary for the anonymous MVP.
- **Durable object storage for images**: rejected by the no-persistence MVP scope.
- **Returning unoptimized original images**: rejected because it risks mobile performance and
  excessive response sizes.

## Decision 7: Use tests and Storybook as first-class quality gates

**Decision**: Use Vitest + React Testing Library for unit/component tests, MSW/provider fakes for
integration and contract tests, Storybook with accessibility checks for component states, and
Playwright for end-to-end and visual regression checks. Tests never call live AI services.

**Rationale**:

- This meets Constitution Principle II's test-first and deterministic-test requirements.
- Storybook stories make default/loading/error/edge states executable UI documentation, satisfying
  Principle III.
- Provider fixtures make safety and failure paths repeatable without network timing or cost.

**Alternatives considered**:

- **Live AI calls in CI**: rejected as non-deterministic, slow, costly, and unsuitable for safety
  regression tests.
- **Manual visual checks only**: rejected by the constitution's visual-regression expectation.

**References**:

- [Storybook accessibility testing](https://storybook.js.org/docs/writing-tests/accessibility-testing)
- [Storybook component testing](https://storybook.js.org/docs/writing-tests/component-testing)
