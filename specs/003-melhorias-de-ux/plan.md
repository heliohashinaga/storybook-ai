# Implementation Plan: Melhorias de UX

## Summary

Melhorias incrementais de experiência de uso para o gerador de histórias infantis (anonymous by design), mantendo todos os invariantes de anonimato, acessibilidade AA e performance. Escopo aprovado pós-clarify:

- **P1** — Escolha visual de tema (cards com rótulo + descrição localizados).
- **P1** — Leitura em voz alta no leitor (local, sem rede, interrompida ao navegar; controle único **iniciar/parar**, sem botão dedicado de pausa — Clarification 2026-08-12).
- **P2** — Indicador de progresso de cena (além do texto "Cena X de Y"; reflete o **total real 3–5 variável** — Clarification 2026-08-12).
- **P2** — Feedback claro na exportação de PDF (gerando/erro/nova tentativa).
- **P2** — Modo escuro seguindo a preferência do sistema **com alternador manual transitório (não persistido)** (contraste AA, sem coleta — Clarification 2026-08-12).

## Technical Context

**Linguagem/Plataforma**: TypeScript strict, Next.js 16 (App Router) + React 19.
**Dependências primárias**: Tailwind v4 (tokens semânticos), next-intl (pt-BR/en), Zod (validação).
**Testes**: Vitest (unit/integration) + Playwright (E2E, a11y, visual, performance) + Storybook test-runner (a11y por story).
**Padrões do produto**: UI com tokens semânticos (nada de hex/vals ad-hoc), todo texto via next-intl (sem strings hardcoded), anonimato estrito, a11y AA, `prefers-reduced-motion` honorado, lazy import de `@react-pdf/renderer` (fora do bundle inicial).
**Observações**: leitura em voz alta usará Web Speech API (`speechSynthesis`) — recurso nativo do navegador, sem rede; controle único iniciar/parar (sem pausa dedicada; o estado `paused` permanece interno). Modo escuro via tokens semânticos + `prefers-color-scheme`, com alternador manual transitório (não persistido) que volta a seguir o sistema ao recarregar.

Todos os campos "NEEDS CLARIFICATION" do template estão resolvidos: a stack é a existente do produto (ADR 0003 single-locale, ADRs do projeto).

## Constitution Check

Avaliação das melhorias contra a constituição do projeto (Code Quality, Testing Standards, User Experience, Performance):

- **Code Quality (PASS)**: TS strict sem `any`; lint/format via scripts existentes; tokens semânticos; sem dead code.
- **Testing Standards (PASS)**: test-first; cada componente com `.stories.tsx` (default/edge/error) + a11y; testes determinísticos com fixtures/fakes; não chamar IA live.
- **User Experience (PASS)**: a11y AA; foco visível/keyboard; `prefers-reduced-motion`; `aria-live`/estados acessíveis na leitura em voz alta e feedback de export; todas as strings localizadas.
- **Performance (PASS)**: iniciais ≤250 KiB gzip; LCP ≤2.5s; navegação ≤100ms p75; geração ≤120s; lazy import do PDF.
- **Privacy/Anon (PASS)**: nenhuma melhoria coleta nome, idade exata, conteúdo ou identificador; leitura em voz alta é local; modo escuro não adiciona persistência.

**Gates**: sem violações. Todas as melhorias preservam os invariantes do produto; as únicas novas superfícies (fala, modo escuro) são locais/visuais e não tocam o contrato de anonimato.

## Project Structure

```text
src/features/story-request/components/story-request-form.tsx   # cards de tema visual
src/features/story-reader/ ...                                # leitura em voz alta, progresso de cena
src/features/story-export/ ...                                # feedback de exportação PDF
src/app/globals.css                                            # tokens de modo escuro (prefers-color-scheme)
src/components/ui/                                             # primitivas compartilhadas (ex: uso de tema)
```

## Phase 0: Outlines & Research (research.md)

Sem "NEEDS CLARIFICATION" pendentes (escopo e stack definidos no clarify). Pesquisa consolida as decisões:
- Leitura em voz alta: Web Speech `speechSynthesis` (suporte pt-BR/en, cancelamento por voz/cena, a11y via botão com estado).
- Modo escuro: tokens CSS + `prefers-color-scheme`, com alternador manual transitório via estado React (sem persistência) que volta a seguir o sistema ao recarregar; contraste AA em ambos os modos.
- Cards de tema: apresentação visual com dados localizados existentes (`catalog.theme` + `themeDescription`).
- Feedback de export: estados locais (gerando/erro/retry) com msgs localizadas.

## Phase 1: Design & Contracts (data-model.md, contracts/, quickstart.md)

- **data-model.md**: entidades de UX (escolha de tema, cena/leitor com controle de fala, estado de exportação, modo de aparência).
- **contracts/**: o produto não expõe APIs novas; os contratos de UI (acessibilidade, estados) são documentados em data-model.md e validados via Storybook/a11y. Sem `contracts/*` novo de API externa.
- **quickstart.md**: validação end-to-end das 5 melhorias (PT-BR e EN) sobre o fluxo existente.
