# Data Model: Personalized Story Generation

**Feature**: `001-personalized-story-generation`  
**Persistence model**: Browser memory only. There is no database, account, cookie-backed profile,
local storage, session storage, or server-side story store in v1. The only server-side ephemeral
state is the anonymous rate-limit record: a short-lived pseudo-anonymous key (e.g., salted,
rotated hash of IP) that is not modeled as an entity, is never a direct identifier, and holds no
story content or profile data.

## Privacy Boundary

The product does **not collect a child's name or any other direct child identifier**. The browser
keeps the exact age only in active React state to derive an age band. The generation route and AI
provider receive only the derived age band, locale, and allow-listed theme.

| Data | Where it may exist | Where it must not exist |
|------|--------------------|-------------------------|
| Child name or direct identifier | Nowhere in the application flow | Browser form/state, request payloads, server logs, provider prompts, analytics, URLs, durable browser storage |
| Exact child age | Active browser input/state only | Generation route/provider payloads, logs, analytics, durable storage |
| Age band | Browser state, generation payload, returned story | Durable application storage |
| Theme/locale | Browser state, generation payload, returned story | Durable application storage |
| Generated narrative/images | Server process memory during generation; browser memory while tab remains open; local exported file chosen by parent | Database, object store, HTTP cache, application logs |

Rendering uses normal React text escaping. Generated text is plain text only and is never inserted
as HTML.

## Enumerations and Configuration

| Name | Values | Rule |
|------|--------|------|
| `Locale` | `pt-BR`, `en` | `pt-BR` is preselected. Unsupported values are rejected. |
| `AgeBand` | `2-4`, `5-7`, `8-9` | Derived locally from a validated integer age 2 through 9; never free-form server input. |
| `Theme` | `courage`, `friendship`, `kindness` | Allow-list only; free-form themes are out of scope for v1. |
| `StoryStatus` | `idle`, `validating`, `generatingStory`, `moderating`, `generatingImages`, `ready`, `failed` | Drives the request/reader UI. |
| `SafetyDecision` | `approved`, `regenerated`, `rejected` | `rejected` is never shown as content; it only determines a safe recovery UI. |

## Client-Only Entities

### `StoryPreferences`

Represents the non-identifying information a parent enters for the active browser session.

| Field | Type | Validation / Notes |
|------|------|--------------------|
| `age` | integer | Required; 2–9 inclusive. Held client-side only. |
| `locale` | `Locale` | Required; defaults to `pt-BR`. |
| `theme` | `Theme` | Required; one of the allow-listed themes. |

### `StorySession`

An in-memory React state container for one open application tab.

| Field | Type | Validation / Notes |
|------|------|--------------------|
| `preferences` | `StoryPreferences \| null` | Reused for another story during the same visit; cleared on tab close/reload. |
| `stories` | `GeneratedStory[]` | Ordered newest-first, held only in memory. |
| `activeStoryId` | UUID or `null` | Selects a reader item. |
| `status` | `StoryStatus` | One active generation at a time. |
| `failure` | `GenerationFailure \| null` | Sanitized user-facing recovery state; never stores unsafe provider output. |

### `GeneratedStory`

A browser-ready, anonymous story created from the approved server response.

| Field | Type | Validation / Notes |
|------|------|--------------------|
| `id` | UUID | Generated in the browser; not a database ID. |
| `locale` | `Locale` | Must equal the active request locale. |
| `ageBand` | `AgeBand` | Derived from the exact age. |
| `theme` | `Theme` | Must equal the active request theme. |
| `title` | string | Localized plain text. |
| `scenes` | `GeneratedScene[N]` | Exactly `N` sequential scenes; `N = 3` is the v1 validated constant (scene-count extension point). |
| `createdAt` | ISO timestamp | Display-only session metadata; not persisted. |

### `GeneratedScene`

| Field | Type | Validation / Notes |
|------|------|--------------------|
| `ordinal` | integer | Exactly 1–3 in v1 (`N = 3` constant, future-extensible); unique and ordered. |
| `title` | string | Localized, short reader heading. |
| `body` | string | Plain text only. |
| `illustrationDataUri` | string | Optimized WebP `data:` URI held in memory only; bounded size. |
| `altText` | string | Localized, age-appropriate illustration description. |

## Server/API Entities

### `GenerateStoryRequest`

The payload accepted by `POST /api/stories`. It intentionally has **no direct identifier and no
exact age**.

| Field | Type | Validation / Notes |
|------|------|--------------------|
| `ageBand` | `AgeBand` | Required; Zod enum. |
| `locale` | `Locale` | Required; Zod enum. |
| `theme` | `Theme` | Required; Zod enum. |

### `SafeGeneratedStory`

The validated, safety-approved server response.

| Field | Type | Validation / Notes |
|------|------|--------------------|
| `locale` | `Locale` | Echoes the validated request. |
| `ageBand` | `AgeBand` | Echoes the validated request. |
| `theme` | `Theme` | Echoes the validated request. |
| `title` | string | Localized plain text. |
| `scenes` | `SafeGeneratedScene[N]` | Exactly `N` sequential scenes; `N = 3` is the v1 validated constant (scene-count extension point). |
| `safetyDecision` | `approved \| regenerated` | `rejected` is represented by an error response instead. |

### `SafeGeneratedScene`

| Field | Type | Validation / Notes |
|------|------|--------------------|
| `ordinal` | integer | 1–N in v1 (1–3), unique, contiguous. |
| `title` | string | Localized plain text. |
| `body` | string | Localized plain text; word range is set per age band in provider schema. |
| `illustrationPrompt` | string | Server-internal after moderation; never returned to browser. |
| `illustrationDataUri` | string | Optimized WebP data URI returned only after image generation succeeds. |
| `altText` | string | Localized and validated description. |

### `GenerationFailure`

| Field | Type | Validation / Notes |
|------|------|--------------------|
| `code` | `invalid_input`, `unsupported_locale`, `unsafe_unrecoverable`, `rate_limited`, `generation_unavailable`, `generation_timeout` | Stable UI/contract code. |
| `messageKey` | string | Localized UI key, not a raw provider message. |
| `retryable` | boolean | Enables a safe retry action where applicable. |

## Validation Rules

1. The browser validates `StoryPreferences` before deriving the API payload; the server repeats all
   API payload validation and ignores any extraneous property.
2. `age` is mapped deterministically: `2–4 → 2-4`, `5–7 → 5-7`, `8–9 → 8-9`.
3. Stories must contain exactly `N` scenes (v1: `N = 3`); each `ordinal` must be unique,
   contiguous, and in ascending reader order. The count is a validated constant, not scattered
   hardcoded "3" values, so a future variable scene count stays a localized change.
4. Provider text must be plain text in the requested locale. Interpolation/template tokens,
   markup, and direct identifiers are invalid and trigger rejection/regeneration.
5. Provider output is schema-validated, moderation-approved, and image-complete before it can
   become `SafeGeneratedStory`.
6. Illustration prompts and image bytes are transient. Images are optimized server-side to WebP and
   capped by an implementation-defined response-size limit recorded in performance tests.
7. Session state is cleared by a full reload or tab close and is never serialized by the app.
8. The server rejects an API payload containing a name or any unrecognized property rather than
   silently accepting it.

## State Transitions

```text
idle
  → validating
  → generatingStory
  → moderating
  → generatingImages
  → ready

validating → failed(invalid_input)
generatingStory → failed(generation_unavailable | generation_timeout)
moderating → generatingStory (one stricter regeneration only)
moderating → failed(unsafe_unrecoverable)
generatingImages → generatingImages (retry a failed image once)
generatingImages → failed(generation_unavailable | generation_timeout)
ready → idle (start another story; preserve current session stories)
failed → validating (parent retries or changes a supported input)
```

## Relationships

```text
StorySession 1 ── 0..N GeneratedStory
GeneratedStory 1 ── 3 GeneratedScene
StoryPreferences 1 ── 0..N GeneratedStory (in-memory association only)
GenerateStoryRequest 1 ── 1 SafeGeneratedStory (per HTTP request, not stored)
SafeGeneratedStory 1 ── 3 SafeGeneratedScene
```

No relationship represents a durable user, profile, library, database record, or object-storage
asset in v1.
