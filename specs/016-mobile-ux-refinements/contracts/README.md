# Contracts: Mobile UX Refinements

**Branch**: `016-mobile-ux-refinements` | **Date**: 2026-08-19

## Interface externa

Esta feature **não altera nenhuma interface externa do projeto**.

- **API (HTTP)**: os únicos endpoints de servidor permanecem `POST /api/stories`
  (`ageBand | locale | theme | sceneCount`) e `POST /api/narrate` (`sceneText ⊆ 2000`, `locale`),
  ambos `Zod .strict()` e `Cache-Control: no-store` — **sem mudança** de contrato.
- **OpenAPI**: o documento existente `specs/001-personalized-story-generation/contracts/story-generation.openapi.yaml`
  permanece válido e **não é editado** por esta feature.
- **Auth**: sessão OAuth/JWT e superfície de privacidade (anônimo por design, demo cookie-less)
  permanecem **inalteradas**.

Como não há alteração de contrato, não se criam arquivos de contrato novos além desta nota de
registro ("no API surface change"). Os ajustes desta feature são exclusivamente de apresentação no
cliente.
