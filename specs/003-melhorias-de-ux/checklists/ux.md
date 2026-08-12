# UX Requirements Quality Checklist: Melhorias de UX

**Purpose**: Validate the quality, clarity, completeness and coverage of the UX requirements in `spec.md` before implementation.
**Created**: 2026-08-12
**Feature**: [spec.md](../../003-melhorias-de-ux/spec.md)

## Requirement Completeness

- [X] CHK001 - Are the five UX user stories (theme visual, leitura em voz alta, progresso, exportação PDF, modo escuro) each backed by explicit functional requirements? [Completeness, Spec §US1–US5]
- [X] CHK002 - Is an explicit accessibility (a11y AA) requirement present for every interactive element (theme picker, read-aloud control, progress, export button, theme toggle)? [Completeness, Spec §FR-UX-003/004/999]
- [X] CHK003 - Are error/empty states specified for all unassisted flows (e.g., PDF export failure, speech unsupported, theme/image edge)? [Completeness, Gap]
- [X] CHK004 - Is the anonymous contract (only `ageBand`/`locale`/`theme`) specified at every interaction surface (form, read-aloud, export, dark mode)? [Completeness, Spec §FR-UX-002/004/007/999]

## Requirement Clarity

- [X] CHK005 - Is the "modo claro e escuro" requirement unambiguous about persistence (session-only, reverts to system on reload)? [Clarity, Spec §FR-UX-007, §SC-UX-005]
- [X] CHK006 - Is the read-aloud control's interaction model precisely defined (single start/stop, no dedicated pause) so implementers cannot infer differently? [Clarity, Spec §FR-UX-003, Clarification 2026-08-12]
- [X] CHK007 - Is the progress indicator's relationship to the textual "Cena X de Y" count unambiguous across the variable 3–5 scene total? [Clarity, Spec §FR-UX-005, §SC-UX-003]
- [X] CHK008 - Is the scope of speech (reader scenes only, excluding form labels) explicitly delimited to avoid over-building? [Clarity, Spec §FR-UX-003, Clarification 2026-08-12]

## Requirement Consistency

- [X] CHK009 - Do FR-UX-007 (dark mode) and SC-UX-005 both mandate the manual session toggle without contradicting the "no persistence" anonymity rule? [Consistency, Spec §FR-UX-007/999]
- [X] CHK010 - Is the terminology for scene count (variable 3–5) consistent across FR-UX-005, SC-UX-003 and the progress indicator requirement? [Consistency]
- [X] CHK011 - Do all five user stories consistently reference the same "no direct identifier" anonymity invariant? [Consistency, Spec §FR-UX-001/002/999]

## Acceptance Criteria Quality

- [X] CHK012 - Are success criteria objectively measurable (e.g., "100% de histórias", "≥4.5:1 contraste") rather than qualitative for each of US1–US5? [Acceptance Criteria, Spec §SC-UX-001..006]
- [X] CHK013 - Can "sem instrução" in SC-UX-007 be verified, or does it need a concrete evaluation method? [Measurability, Spec §SC-UX-007]
- [X] CHK014 - Is "feedback de progresso / nova tentativa" for PDF export specified with observable success/error outcomes? [Acceptance Criteria, Spec §SC-UX-004]

## Scenario Coverage

- [X] CHK015 - Are requirements defined for the primary flow of each story (select theme → read aloud → follow progress → export)? [Coverage, Spec §US1–US4]
- [X] CHK016 - Are exception flows covered (e.g., export failure with retry, speech synthesis unsupported, manual dark-mode toggle on a dark system)? [Coverage, Gap]

## Edge Case Coverage

- [X] CHK017 - Is the behavior specified for a manual dark-mode override while the system already prefers dark (toggle should switch to light)? [Edge Case, Gap, Spec §SC-UX-005]
- [X] CHK018 - Is the read-aloud edge case defined for the final scene (progress at 5/5, "next" disabled with narration active)? [Edge Case, Gap]
- [X] CHK019 - Is the max-scene (5) progress indicator explicitly validated to reflect the real total (not a fixed 3)? [Edge Case, Spec §SC-UX-003]

## Non-Functional Requirements

- [X] CHK020 - Are performance budgets (e.g., initial JS ≤250 KiB gzip, lazy PDF export) restated or referenced for these UX additions? [Non-Functional, Spec §FR-UX-999]
- [X] CHK021 - Is `prefers-reduced-motion` honored by explicit requirement for the (non-animated) progress indicator and transitions? [Non-Functional, Gap, Spec §US3]
- [X] CHK022 - Is the anonymity invariant quantified/verified for the new UI (no persistence, no network, no storage) across read-aloud and dark mode? [Non-Functional, Spec §FR-UX-004/007/999]

## Dependencies & Assumptions

- [X] CHK023 - Are the assumptions (native Web Speech, system-following dark mode, variable 3–5 scenes) explicitly documented rather than implicit? [Assumption, Spec §Assumptions]
- [X] CHK024 - Is the dependency on semantic tokens (`--color-*`) and locale catalogs documented for all visual/status text? [Dependency, Gap]
