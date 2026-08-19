# Feature Specification: Mobile UX Refinements (melhorar experiência mobile)

**Feature Branch**: `016-mobile-ux-refinements`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "melhorar experiência mobile: tem uns textos que quebram, botões muito grandes"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Texto legível sem quebras/overflow no celular (Priority: P1)

Um cuidador acessa o app no celular e percorre o formulário de pedido (temas de história) e o
resumo do pedido. Nenhum texto estoura a largura da tela, é cortado sem explicação, ou quebra no
meio de uma palavra de forma feia — especialmente textos longos localizados (descrições de tema,
nomes de idioma, unidade de número de cenas) tanto em português quanto em inglês.

**Why this priority**: Legibilidade é o bloqueador de UX mais visível — texto quebrado/overflow
impede o entendimento e gera impressão de app quebrado. É a queixa mais concreta do usuário.

**Independent Test**: Navegar o formulário e o reader em um viewport estreito (360px) e confirmar
que nenhuma superfície rola horizontalmente e nenhum texto é cortado ou quebrado em meio-palavra,
nas duas línguas.

**Acceptance Scenarios**:

1. **Given** um viewport de 360px de largura, **When** o usuário abre o formulário de pedido e o
   reader, **Then** nenhuma superfície apresenta rolagem horizontal nem texto que ultrapassa o
   contêiner.
2. **Given** descrições de tema e nomes de idioma longos em pt-BR e en, **When** renderizados em
   tela estreita, **Then** o texto quebra em quebras de palavra limpas, sem sobrepor elementos
   adjacentes nem ser cortado.

---

### User Story 2 - Controles proporcionais no mobile (Priority: P2)

No celular, os elementos clicáveis (botões de número de cenas, cartões de tema, botões de idioma,
ações OAuth, CTA principal) são fáceis de tocar e mantêm o tamanho mínimo acessível de toque, mas
não dominam a tela com altura/padding excessivos que não combinam com o conteúdo.

**Why this priority**: Botões muito grandes tornam a tela "pesada" e empurram o conteúdo para fora
da dobra; porém, reduzir abaixo do mínimo acessível de toque quebraria a barra de acessibilidade.

**Independent Test**: Inspecionar os controles no formulário e no login em um viewport estreito e
confirmar que cada alvo de toque mantém o tamanho acessível mínimo, ao mesmo tempo em que a altura
e o padding visual em tela estreita são proporcionais ao conteúdo (sem "exagero").

**Acceptance Scenarios**:

1. **Given** uma tela de celular, **When** o usuário interage com os controles do formulário,
   **Then** cada alvo de toque atende ao tamanho acessível mínimo estabelecido.
2. **Given** uma tela de celular, **When** os cartões de tema, botões de cenas, idioma e o CTA são
   exibidos, **Then** a densidade visual (altura/padding) é proporcional ao conteúdo, sem dominar a
   área útil.

---

### User Story 3 - Título da história legível no reader mobile (Priority: P3)

No reader em tela de celular, o título da história permanece legível: títulos longos quebram em até
duas linhas e continuam visíveis, em vez de serem cortados/exibidos pela metade de forma abrupta.

**Why this priority**: Importante para a leitura, mas menor em impacto geral que os overflow da
US1; trata-se do acabamento do reader em telas estreitas.

**Independent Test**: Renderizar uma história com título longo no reader em viewport estreito e
confirmar que o título permanece visível (quebra em até 2 linhas), sem ser cortado.

**Acceptance Scenarios**:

1. **Given** uma história com título longo, **When** exibida no reader em tela de celular,
   **Then** o título permanece legível, quebrando em até duas linhas em vez de ser cortado.

---

### Edge Cases

- **E-001 Tela muito estreita (320px)**: nenhuma superfície deve rolar horizontalmente nem
  esconder texto; quebras de palavra devem permanecer limpas.
- **E-002 Texto longuíssimo (título/tema via conteúdo fake)**: strings muito longas devem ser
  tratadas com quebra controlada (linhas múltiplas) e nunca estourar o contêiner.
- **E-003 Zoom/escala de fonte do navegador**: ao aumentar a fonte do sistema, o layout no mobile
  não deve introduzir overflow ou cortes novos.
- **E-004 Foco de teclado**: com controles menores, o foco visível e a operação por teclado devem
  permanecer intactos (sem elementos que só funcionem por toque).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Em telas de pequena largura (dispositivos móveis), nenhum texto voltado ao usuário
  pode ultrapassar o seu contêiner nem ser cortado sem um meio visível de revelá-lo.
- **FR-002**: Strings localizadas longas (descrições de tema, nomes de idioma, unidade de cenas)
  em pt-BR e en devem quebrar limpo em quebras de palavra, sem sobrepor vizinhos.
- **FR-003**: O título da história no reader deve permanecer totalmente legível em telas móveis,
  quebrando em até duas linhas em vez de ser cortado.
- **FR-004**: Todo controle interativo deve manter o tamanho acessível mínimo de toque/teclado e,
  em tela móvel, apresentar densidade visual proporcional ao conteúdo (sem altura/padding
  excessivos que dominem a área útil).
- **FR-005**: A operação por teclado, o foco visível e a semântica acessível dos controles devem
  permanecer intactos após os ajustes (nada deve virar exclusivo de toque).
- **FR-006**: O comportamento e o estilo exibidos no Storybook devem permanecer idênticos aos do
  aplicativo real para os mesmos estados e larguras de viewport.
- **FR-007**: Todo texto visível deve continuar proveniente dos catálogos localizados existentes
  (pt-BR e en); nenhuma string nova deve ser escrita em código.

### Key Entities

Não há novas entidades de dados: trata-se de refinamento de apresentação sobre o fluxo e conteúdo
existentes (formulário de pedido, login e reader). Nenhuma mudança em dados ou modelo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em viewports de 320px e 360px de largura, nenhuma superfície voltada ao usuário
  apresenta rolagem horizontal ou overflow fora do contêiner (verificável por inspeção a cada
  largura).
- **SC-002**: Todas as strings localizadas de amostra (pt-BR e en) — descrições de tema, nome de
  idioma, unidade de cenas — renderizam sem quebra em meio de palavra nem corte em viewport de
  360px.
- **SC-003**: 100% dos controles interativos atendem ao tamanho acessível mínimo de alvo
  (toque/teclado) e nenhum deles excede esse mínimo.
- **SC-004**: Títulos de história com comprimento de até ~2 linhas permanecem completamente
  legíveis no reader em tela móvel.
- **SC-005**: A suíte de testes automatizados (unitária, de componentes e de acessibilidade em
  Storybook) passa sem novas violações, e os baselines visuais das telas afetadas são atualizados
  de forma intencional e aprovada.

## Assumptions

- Mobile é definido como viewport de pequena largura (≈ ≤640px), com foco em celulares em retrato
  de 320–428px.
- Reaproveitam-se os tokens de design e primitivas compartilhadas existentes; não há cores, fontes
  ou geometrias novas.
- O tamanho mínimo acessível de alvo segue o padrão recomendado (≥ 44px) e não será reduzido; os
  ajustes atuam em densidade/padding e dimensões não críticas.
- A mudança é puramente de apresentação: não altera conteúdo, modelo de dados nem a superfície de
  privacidade (a rota demo permanece sem cookies; nenhum identificador novo).
- A localização continua pelos catálogos existentes (pt-BR + en); nenhuma string hardcoded nova.
- Baselines visuais das telas afetadas podem exigir re-aprovação intencional e serão atualizados
  como parte da entrega.
