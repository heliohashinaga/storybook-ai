# Checklist de Qualidade de Requisitos — Spec 009 Frontend Routes

Purpose/created: Requisitos satisfazem os padrões de escrita (completude, clareza,
consistência, mensurabilidade, cobertura), **não** verificação de implementação.
Preenchido: (autor/reviewer em PR de spec).

> **Fonte única de rastreio de aceite:** esta pasta de checklists é a fonte de
> verdade para o que é verificado. Esta checklist (`quality.md`) valida a
> **qualidade dos requisitos** (testes de escrita); as checklists `requirements.md`
> e `ux.md` espelham os itens de aceite da spec/§9 — manter em sincronia.

## Requirement Completeness
- [x] CHK001 São definidos requisitos para **todos** os modos de tela navegáveis (`form`, `reader`) e para o redirect de `/`? [Completeness, Spec §5]
- [x] CHK002 Estão documentados requisitos explícitos de **fora de escopo** (`/export`, `?story=`, `/steps`)? [Completeness, Spec §4/§11]
- [x] CHK003 Estão definidos requisitos de **privação/anonymidade** (sem dado em URL/param/hash) como invariante não-negociável? [Completeness, Spec §2]
- [x] CHK004 Há requisito cobrindo o estado **assíncrono** de geração (`submitting` permanece em `/form`, URL inalterada)? [Completeness, Spec §4/§6.2]
- [x] CHK005 Está especificado o requisito de **navegação entre histórias já criadas** dentro do `/reader` (multistória)? [Completeness, Spec §7]
- [x] CHK006 Estão definidos os requisitos de **export de PDF inline** (lazy, sem rota dedicada)? [Completeness, Spec §5/§7]

## Requirement Clarity
- [x] CHK007 A política de navegação (`replace` na transição `form→reader`; `push` em multistória) está expressa de forma **inequívoca**, sem duplo sentido? [Clarity, Spec §6.2/§7]
- [x] CHK008 Está claro o que acontece com o botão "voltar" do navegador (um `back` **sai do app**, não repassa o `/form`)? [Clarity, Spec §7/§8]
- [x] CHK009 O significado de "`/form` limpo" (rascunho sem preenchimento, sem aba de histórico) está **explicitamente** definido? [Clarity, Spec §7]
- [x] CHK010 O alvo de foco ao navegar (heading `<h1>` da tela de destino) está **especificado sem ambiguidade**? [Clarity, Spec §7]
- [x] CHK011 O termo "loading"/"progresso" está **consistentemente** mapeado para o estado `submitting` em toda a spec? [Clarity/Consistency, Spec §4/§6]

## Requirement Consistency
- [x] CHK012 As referências a `push`/`replace` estão **consistentes** entre §6.1, §6.2, §7, §8, §10 e §11? [Consistency]
- [x] CHK013 As menções ao botão "voltar" são coerentes entre §1, §7, §8 e §10 (voltar do navegador ≠ navegação interna para o `/form` limpo)? [Consistency]
- [x] CHK014 A lista de rotas (`/`, `/form`, `/reader`) é **idêntica** em §5, §11 e na tabela de rotas — sem rota órfã? [Consistency, Spec §5 vs §11]
- [x] CHK015 Os requisitos de a11y (foco, `aria-current`, `aria-busy`) estão alinhados entre §7, §8 e §9? [Consistency]
- [x] CHK016 Os **invariantes de privacidade** (§2) são consistentes com a especificação de rotas (§5) que transportam apenas o `path`? [Consistency]

## Acceptance Criteria Quality
- [x] CHK017 Os critérios de aceite são **mensuráveis/testáveis** (não afirmações vagas como "funciona bem")? [Measurability, Spec §9]
- [x] CHK018 Os gates de qualidade (lint 0 warnings, format:check, typecheck, cobertura ≥80%/≥90%, budget 250 KiB) são **quantificados**? [Measurability, Spec §9/§7]
- [x] CHK019 A condição do session gate ("`/reader` sem sessão ⇒ `redirect("/form")`") é objetiva e verificável? [Acceptance Criteria, Spec §6.3]
- [x] CHK020 O comportamento de "voltar" (replace → back sai do app) é **asserível** por teste (integrado no §8/§9)? [Measurability, Spec §8/§9]

## Scenario Coverage
- [x] CHK021 Estão cobertos os cenários **primários** (form → geração → reader; `top-nav` → form limpo)? [Scenario Coverage, Spec §7/§8]
- [x] CHK022 Está coberto o cenário **alternativo** de multistória (navegar entre histórias no `/reader` e voltar ao form limpo)? [Scenario Coverage, Spec §7]
- [x] CHK023 Estão cobertos os cenários de **exceção/erro** (falha de geração/retry, provider failure) sem mudar rota? [Scenario Coverage, Spec §8]
- [x] CHK024 Está coberto o cenário **deep-link/reload** (acesso direto a `/reader` sem sessão aterrissa em `/form`)? [Scenario Coverage, Spec §8]
- [x] CHK025 Há requisito para **critical path de localidade** (pt-BR e EN) sem reset da `locale` em navegações? [Scenario Coverage, Spec §7/§8]

## Edge Case Coverage
- [x] CHK026 Está definido o **edge case** de reload durante `submitting` (estado efêmero não recriável por rota)? [Edge Case, Spec §4/§6.2]
- [x] CHK027 Está definido o comportamento de **URL durante `POST /api/stories`** (permanece `/form`; não existe `/steps`)? [Edge Case, Spec §4]
- [x] CHK028 Está coberto o **edge case** de multistória sem `?story=` (rejeição de índice por URL)? [Edge Case, Spec §11]
- [x] CHK029 Está definido o comportamento do **ícone do app / logo no header** (navegação interna para o `/form` limpo)? [Edge Case, Spec §7]

## Non-Functional Requirements
- [x] CHK030 Os NFRs de **performance** (rota inicial ≤250 KiB gzip; `@react-pdf/renderer` lazy) estão especificados e quantificados? [Non-Functional, Spec §7]
- [x] CHK031 Os NFRs de **segurança/privacidade** (barreira `server-only`; `POST /api/stories` único entry point; sem persistência) estão especificados? [Non-Functional, Spec §2]
- [x] CHK032 Os NFRs de **acessibilidade** (foco, `aria-current`, `aria-live`/`aria-busy`, prefers-reduced-motion) estão definidos? [Non-Functional, Spec §7]

## Dependencies & Assumptions
- [x] CHK033 Está documentada a **dependência** em `StorySessionContext` como oráculo de sessão (exposição de `hasSession`/`storyCount`/`activeId`/`activeIndex`)? [Dependency, Spec §6.1]
- [x] CHK034 Está registrada a **assunção** de que o `LocaleProvider` permanece um nível acima das páginas e não é alterado pelas rotas? [Assumption, Spec §7]
- [x] CHK035 Estão documentados os **pressupostos** de roteamento (ex. `usePathname()` como única fonte de modo) e suas implicações? [Assumption, Spec §6.2]

## Ambiguities & Conflicts
- [x] CHK036 Não restam **ambigüidades** (ex. uso vago de "preservar foco") sem critério específico? [Ambiguity, Spec §7]
- [x] CHK037 Não há **conflito** entre a decisão de remover `/export` e qualquer menção residual a rota de export em seções anteriores? [Conflict, Spec §4/§11]
- [x] CHK038 Não há **conflito** entre "voltar real" (§1) e a política replace (§6.2) que faz o back sair do app? [Conflict, Spec §1 vs §6.2]
- [x] CHK039 Não há menção residual ao **event bus** (`requestHome`/`onHomeRequested`) contradita pela remoção exigida em §6/§7? [Conflict, Spec §6/§7]

## Traceability
- [x] CHK040 Cada requisito funcional é rastreável aos critérios de aceite (§9) e aos testes (§8) correspondentes? [Traceability]
- [x] CHK041 As decisões registradas em `## Clarifications` (Session 2026-08-15) estão refletidas nas seções §2–§9 (sem texto obsoleto remanescente)? [Traceability, Spec §1 Clarifications]
