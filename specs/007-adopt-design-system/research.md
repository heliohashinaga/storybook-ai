# Research: Adotar o design system e o frontend do protótipo

**Phase 0 output** — resolve os trade-offs do Technical Context e fundamenta o design em
`data-model.md`, `contracts/` e `quickstart.md`.

## 1. Origens da identidade visual (fonte da verdade)

**Unknown**: De onde vêm os valores visuais e como reconciliá-los com o design system atual.

**Decision**: O `protótipo` é a **fonte da verdade visual** (README: "redesenha o mockup"
do `storybook-ai`). Portamos seus tokens **semânticos oklch** (paleta quente creme/coral/terracota +
acento vivo, com variantes claro e escuro), tipografia **Baloo 2** (display) + **Nunito** (corpo),
raios largos (`--radius: 1.25rem`), e os **shadows `soft`/`lift`** para a base do app de produção,
substituindo a paleta hex atual (purple `#5b21b6`, ver `globals.css`) por valores oklch
revalidados para AA.

**Rationale**:
- Mantém o **princípio de tokens semânticos** já vigente em `tailwind.config.ts` (o código de
  componentes só referencia tokens, nunca hex — ver `button.tsx`, `progress.tsx`, `choice-card.tsx`).
- Preserva a **taxonomia semântica** existente (`background/surface/text/subtle/accent/focus/
  success/warning/danger/disabled`) para não quebrar todas as referências; apenas os **valores**
  mudam para oklch quente, e **novos tokens de radius/shadow/font-display** são adicionados.
- Evita adicionar libs de UI; as primitivas `components/ui` já são token-based e só precisam de
  ajustes de classe (raio, sombra, hover).

**Alternatives considered**:
1. *Copiar o `index.tsx` do protótipo literalmente*: duplicaria estado/i18n/estrutura e violaria a
   separação por features — rejeitado (espec: não copiar telas auto-contidas).
2. *Manter a paleta hex atual e só ajustar radições*: não atenderia a FR-001/SC-001 (identidade nova).

## 2. Fontes self-hosted (Baloo 2 + Nunito)

**Unknown**: Como carregar as fontes sem inflar o bundle inicial (orçamento ≤250 KiB gzip).

**Decision**: Usar o `next/font` do Next.js (self-hosted, gzip/woff2) no `app/layout.tsx`, carregando
**Baloo 2** (weights display: bold/extrabold) para `--font-display` e **Nunito** (400/700) para
`--font-sans`, registradas pelos tokens `--font-display` / `--font-sans` em `globals.css`.

**Rationale**: O `next/font` subseta e auto-otimiza (formatos modernos, `display: swap`, cache
imutável), mantendo o bundle/FOIT controlados dentro do orçamento. `h1–h3` usam `--font-display`
(via `@layer base`), corpo usa `--font-sans` (padrão atual).

**Alternatives considered**: importação CSS externa (Google Fonts) — aumentar latência/render e
dependência de rede; rejeitada. Build-time fontes estáticas manuais — mais manutenção.

## 3. Expansão de temas 3 → 6 (Q1-B)

**Unknown**: O que muda no pipeline anônimo quando o conjunto de temas passa a ter 6 valores.

**Decision**: Ampliar o **value union** de `Theme` de `courage/friendship/kindness` para
`+ curiosidade/perseverança/empatia` em **exatamente um lugar tipado** e fazer todo o derivativo
fluir daí:

- `src/features/story-request/client/story-preferences-schema.ts` → `themeValues` (fonte do app).
- `src/features/story-generation/server/schemas.ts` → `themeSchema` (`z.enum` com os 6).
- `src/lib/story-catalog.ts` → `themeCatalog` (label + description, derivado de `themeValues`).
- Catálogos next-intl `catalog.theme.*` e `catalog.themeDescription.*` (pt-BR/en).
- `src/features/story-generation/server/agents/planner.ts` → `purposeFor()` mapeia os 3 novos a um
  `movement` de intenção (ex.: `curiosity/perseverance/empathy`).
- `src/features/story-generation/server/fixed-dev-provider.ts` → fixture determinística devolve
  uma história anônima dedicada por tema (para fakes/visual/e2e cobrirem os 6).

**Rationale**: O novo tema é apenas uma **categoria anônima** no payload — o mesmo campo `theme`
já enviado hoje; não há campo novo nem dado pessoal (FR-008/SC-007). O moderador é
**content-based** (ver `safety-pipeline`/`moderator.ts`: não ramifica por tema), então a cobertura
de segurança dos 3 novos é a mesma pipeline (SC-007). `purposeFor()` é o único lugar que deriva
intenção do tema; ampliá-lo é trivial e testável por unidade.

**Alternatives considered**: tema ad-hoc/string livre — quebra validação Zod e o catálogo tipado;
rejeitado. Manter 3 e ignorar o protótipo — contraria a decisão Q1-B e SC-007.

## 4. Idade: slider vs. input numérico

**Unknown**: O protótipo usa um range slider (2–9); o app usa um `<input type="number">`.

**Decision**: **Manter o input numérico validado** existente (2–9, com `aria-invalid`, foco e
erro), **restilizado** na nova linguagem (raio, focus ring, sombra). O slider é tratado como
melhoria de UX opcional, fora do campo desta entrega (o contrato/validação já é sólido).

**Rationale**: Preserva determinismo e acessibilidade de teclado/validação já testados; a troca para
slider adicionaria risco de UX/peculiaridades sem ganho de privacidade (a idade segue apenas em
memória, agregada em `ageBand`).

**Alternatives considered**: slider igual ao protótipo — adiciona complexidade de acessibilidade
(aria-valuetext, foco) sem valor; rejeitado nesta entrega.

## 5. Layout/componentes do protótipo a portar

**Unknown**: Quais elementos concretos do `routes/index.tsx` do protótipo devem vir.

**Decision**: Portar a **linguagem visual e os padrões de disposição**, reimplementando nas
primitivas/features existentes:
- **Topo**: marca (ícone `BookOpenText` + nome + tagline) + alternância de idioma + alternância de
  tema (funde/separa da `ThemeToggle` atual).
- **Formulário**: cards de tema com **emoji**, nome e descrição (via `ChoiceCard` + catálogo),
  seletor de cenas, botão primário grande (`Wand2` + "Criar história").
- **Geração**: estágios nomeados ("Escrevendo…", "Ilustrando…", "Verificando a segurança…") + barra
  de progresso + aviso de envio bloqueado — `aria-busy`/`aria-live` preservados
  (estende `StoryGenerationProgress`), com id strings via catálogos.
- **Leitor**: cena com destaque visual, indicador de progresso (dots/segmentos), botões
  Anterior/Próxima, "Ler em voz alta" (play/stop, `aria-pressed`), rodapé "Baixar como PDF" e
  alternância de histórias na sessão.
- **Modo escuro**: paleta dark do protótipo em todas as telas, alternância manual sem persistência
  (precedência do sistema na primeira carga) — mantém o comportamento do `theme-toggle` atual.

**Rationale**: preserva `aria-live/aria-busy`/`aria-pressed`/foco teclado (constitution III), a
i18n por catálogos e o comportamento do Storybook == app (DoD). Cada componente portado mantém suas
stories/estados.

**Alternatives considered**: portar telas inteiras do protótipo como bloco — duplicação/risco;
rejeitado em favor da adaptação por feature.

## 6. Volume/escala

**Decision**: Sem persistência; identidade em tokens no build; 6 temas no catálogo tipado derivado.
Nenhum identificador gravado; cache não-persistente já coberto nas features 004/005.

**Rationale**: personal, não-comercial; foco em coerência visual, AA, determinismo e catálogo.
